'use strict';

// =====================================================================
//  integration.test.js — اختبارات تكامل حيّة تُثبت RLS عبر API كاملة
//
//  السلسلة المُثبَتة: JWT login → authenticate middleware → requirePermission
//                      → withUserContext (GUC) → RLS في PostgreSQL
//
//  شرط التشغيل: process.env.DATABASE_URL مُعرَّف (CI فقط).
//  محلياً: المجموعة بأكملها تُتخطَّى تلقائياً (describe.skip).
//
//  بيانات الدخول: من 05_seed.sql — كلمة المرور الموحَّدة Passw0rd!
//    dr.ahmed        → doctor
//    patient.mohammed → patient  (patient_id = MRN-000001)
//    patient.fatima  → patient  (patient_id = MRN-000002)
//    reception.mariam → receptionist
//
//  المتغيرات البيئية المطلوبة في CI:
//    DATABASE_URL  → postgres://postgres:pass@localhost:5432/hospital
//    JWT_SECRET    → أي سلسلة (32+ حرف)
// =====================================================================

const request = require('supertest');
const app     = require('../src/app');

// ─── ثابت كلمة المرور الموحَّدة في seed ──────────────────────────────
const SEED_PASSWORD = 'Passw0rd!';

// ─── تشغيل المجموعة فقط عند توفر DATABASE_URL (CI) ─────────────────
const describeIfDB = process.env.DATABASE_URL ? describe : describe.skip;

// =====================================================================
//  توقف قاعدة البيانات بعد اكتمال جميع الاختبارات
// =====================================================================
afterAll(async () => {
  // نُغلق Pool الـ pg لمنع تعليق Jest بعد انتهاء الاختبارات
  const { pool } = require('../src/config/db');
  await pool.end();
});

// =====================================================================
//  (1) طبيب يسجّل دخوله ثم يجلب قائمة المرضى — يتوقع 200
//
//  RLS path: withUserContext يضبط app.current_user_id + app.current_role
//            → سياسة patients SELECT تسمح لـ doctor
// =====================================================================
describeIfDB('[INT-1] Doctor login → GET /patients → 200', () => {
  let doctorToken;

  beforeAll(async () => {
    // dr.ahmed — doctor (من 05_seed.sql، السطر 139)
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dr.ahmed', password: SEED_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.roles).toContain('doctor');

    doctorToken = res.body.data.access_token;
  });

  test('GET /api/v1/patients يُرجع 200 ومصفوفة', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // يجب أن يُرى على الأقل مريض واحد (seed يحتوي 8 مرضى)
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/medical-records يُرجع 200 للطبيب', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// =====================================================================
//  (2) مريض يسجّل دخوله ثم يجلب السجلات الطبية
//      RLS يضمن: يرى سجلّه فقط (patient_id المربوط بـ JWT)
//      المريض الثاني (patient.fatima) لا يظهر في نتائج المريض الأول
//
//  patient.mohammed → MRN-000001  → سجل طبي موجود في seed
//  patient.fatima   → MRN-000002  → سجل طبي منفصل في seed
// =====================================================================
describeIfDB('[INT-2] Patient RLS — يرى سجلّه فقط لا سجلات غيره', () => {
  let mohammedToken;
  let mohammedPatientId;
  let fatimaPatientId;

  beforeAll(async () => {
    // تسجيل دخول patient.mohammed
    const res1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient.mohammed', password: SEED_PASSWORD });

    expect(res1.status).toBe(200);
    expect(res1.body.data.user.roles).toContain('patient');
    mohammedToken     = res1.body.data.access_token;
    mohammedPatientId = res1.body.data.user.patient_id;

    // نحصل على patient_id لـ fatima للتحقق لاحقاً
    const res2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient.fatima', password: SEED_PASSWORD });

    expect(res2.status).toBe(200);
    fatimaPatientId = res2.body.data.user.patient_id;
  });

  test('patient.mohammed له patient_id مختلف عن patient.fatima', () => {
    expect(mohammedPatientId).toBeTruthy();
    expect(fatimaPatientId).toBeTruthy();
    expect(mohammedPatientId).not.toBe(fatimaPatientId);
  });

  test('GET /api/v1/medical-records يُرجع فقط سجلات محمد (RLS)', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records')
      .set('Authorization', `Bearer ${mohammedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // RLS تُفلتر: كل الصفوف المُرجَعة يجب أن تخص محمد فقط
    const records = res.body.data;
    for (const record of records) {
      expect(record.patient_id).toBe(mohammedPatientId);
    }

    // لا يوجد أي سجل يخص فاطمة في نتائج محمد
    const fatimaRecords = records.filter((r) => r.patient_id === fatimaPatientId);
    expect(fatimaRecords.length).toBe(0);
  });

  test('GET /api/v1/auth/me يُعيد patient_id الصحيح', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${mohammedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.patient_id).toBe(mohammedPatientId);
  });
});

// =====================================================================
//  (3) موظف استقبال يحاول جلب السجلات الطبية — يتوقع 403
//
//  receptionist لا يملك medical_records:read (من 02_rbac_rls.sql)
//  requirePermission يرفض قبل وصول الاستعلام لـ PostgreSQL
//
//  reception.mariam → receptionist (من 05_seed.sql، السطر 144)
// =====================================================================
describeIfDB('[INT-3] Receptionist → GET /medical-records → 403', () => {
  let receptionistToken;

  beforeAll(async () => {
    // reception.mariam — receptionist (من 05_seed.sql)
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'reception.mariam', password: SEED_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.roles).toContain('receptionist');

    receptionistToken = res.body.data.access_token;
  });

  test('GET /api/v1/medical-records يُرجع 403 لموظف الاستقبال', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records')
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  test('POST /api/v1/medical-records يُرجع 403 لموظف الاستقبال', async () => {
    const res = await request(app)
      .post('/api/v1/medical-records')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patient_id: 1, chief_complaint: 'ألم' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  test('GET /api/v1/patients يُرجع 200 لموظف الاستقبال (له patients:read)', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// =====================================================================
//  (4) بيانات دخول خاطئة — يتوقع 401
//
//  أربعة سيناريوهات: username صحيح + password خاطئ،
//  username غير موجود، بلا username، بلا حقول.
// =====================================================================
describeIfDB('[INT-4] بيانات دخول خاطئة → 401', () => {
  test('password خاطئ لـ dr.ahmed → 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dr.ahmed', password: 'WrongPass123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('username غير موجود → 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nonexistent.user', password: SEED_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('جسم فارغ → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('طلب بلا Authorization header → 401 TOKEN_MISSING على مسار محمي', async () => {
    const res = await request(app)
      .get('/api/v1/patients');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  test('token مزيّف → 401 TOKEN_INVALID على مسار محمي', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.fake.signature');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

// =====================================================================
//  (5) سلامة RLS: طبيب يرى كل السجلات، مريض يرى سجلّه فحسب
//      اختبار مقارنة مباشرة بين مجموعتي النتائج
// =====================================================================
describeIfDB('[INT-5] RLS مقارنة: doctor يرى الكل، patient يرى نفسه', () => {
  let doctorRecords;
  let patientRecords;
  let mohammedPatientId;

  beforeAll(async () => {
    // تسجيل دخول الطبيب
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dr.ahmed', password: SEED_PASSWORD });

    const doctorToken = doctorLogin.body.data.access_token;

    // تسجيل دخول المريض
    const patientLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient.mohammed', password: SEED_PASSWORD });

    const patientToken    = patientLogin.body.data.access_token;
    mohammedPatientId = patientLogin.body.data.user.patient_id;

    // جلب السجلات لكلّ منهما
    const [drRes, patRes] = await Promise.all([
      request(app)
        .get('/api/v1/medical-records')
        .set('Authorization', `Bearer ${doctorToken}`),
      request(app)
        .get('/api/v1/medical-records')
        .set('Authorization', `Bearer ${patientToken}`),
    ]);

    expect(drRes.status).toBe(200);
    expect(patRes.status).toBe(200);

    doctorRecords  = drRes.body.data;
    patientRecords = patRes.body.data;
  });

  test('الطبيب يرى أكثر سجلات مما يراه المريض (أو مساوٍ)', () => {
    // seed يحتوي 4 سجلات لـ 4 مرضى مختلفين؛
    // المريض يرى سجلّه الواحد فقط، الطبيب يرى ما أنشأه
    expect(doctorRecords.length).toBeGreaterThanOrEqual(patientRecords.length);
  });

  test('كل سجلات المريض تخصّه هو فحسب', () => {
    for (const record of patientRecords) {
      expect(record.patient_id).toBe(mohammedPatientId);
    }
  });
});
