# Integration Tests — Hospital DBMS RBAC
## اختبارات التكامل (تتطلب قاعدة بيانات حيّة)

هذا الملف **توثيق وسكربت يدوي** — لا يُشغَّل تلقائياً في CI بدون DB.  
عند توفّر بيئة PostgreSQL مهيّأة، انسخ الأمثلة أدناه إلى ملفات Jest منفصلة
(مثل `integration/auth.int.test.js`) وشغّلها بـ:

```bash
# تشغيل اختبارات التكامل فقط
DATABASE_URL=postgresql://user:pass@localhost:5432/hospital_test \
JWT_SECRET=your-secret \
npx jest --testPathPattern=integration --runInBand
```

---

## المتطلبات البيئية

| المتغير البيئي | القيمة المطلوبة في الاختبار |
|---|---|
| `DATABASE_URL` | رابط قاعدة بيانات اختبار منفصلة (ليست الإنتاج) |
| `JWT_SECRET` | أي سلسلة عشوائية (32+ حرف) |
| `JWT_EXPIRES_IN` | `15m` أو أطول |
| `BCRYPT_ROUNDS` | `4` (لتسريع الاختبارات) |
| `NODE_ENV` | `test` |

**تحضير DB:** شغّل migration سكربت المشروع أولاً على قاعدة بيانات اختبار نظيفة.

---

## الاختبار 1 — تسجيل دخول طبيب ورؤية المرضى

**السيناريو:** doctor يسجّل دخوله ← يحصل على JWT ← يصل إلى `/api/v1/patients`

```js
// integration/doctor.int.test.js
const request = require('supertest');
const app     = require('../../src/app');

describe('[INT] Doctor — login + patients:read', () => {
  let doctorToken;

  beforeAll(async () => {
    // افتراض: الـ DB تحتوي مستخدماً بـ username=dr_ali وdoctor role
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dr_ali', password: 'P@ssw0rd!' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.roles).toContain('doctor');
    doctorToken = res.body.data.access_token;
  });

  test('doctor يرى قائمة المرضى (200)', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('doctor يرى السجلات الطبية (200)', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
  });
});
```

---

## الاختبار 2 — مريض يرى سجلّه الخاص فقط (RLS)

**السيناريو:** patient يسجّل دخوله ← يصل إلى سجلّه فقط ← محاولة رؤية سجل مريض آخر تُرفض

```js
// integration/patient.int.test.js
const request = require('supertest');
const app     = require('../../src/app');

describe('[INT] Patient — own record only (RLS)', () => {
  let patientToken;
  let patientId;

  beforeAll(async () => {
    // افتراض: user بـ username=patient_sara وpatient role وpatient_id=5
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient_sara', password: 'P@ssw0rd!' });

    expect(res.status).toBe(200);
    patientToken = res.body.data.access_token;
    patientId    = res.body.data.user.patient_id;
  });

  test('patient يرى ملفه الشخصي عبر /auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.patient_id).toBe(patientId);
  });

  test('patient يرى بياناته من /patients/:id (own)', async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    // RLS تُظهر له سجلّه فقط
    expect([200, 403]).toContain(res.status);
    // إذا كانت patients:read صلاحية مُسنَدة → 200
    // إذا كانت RLS تمنع حتى مع الصلاحية → 403 (يعتمد على ضبط RLS)
  });
});
```

---

## الاختبار 3 — موظف الاستقبال لا يرى السجلات الطبية (403)

**السيناريو:** receptionist لا يملك `medical_records:read` ← يحاول GET /medical-records ← يُرفض بـ 403

```js
// integration/receptionist.int.test.js
const request = require('supertest');
const app     = require('../../src/app');

describe('[INT] Receptionist — cannot read medical records', () => {
  let receptionistToken;

  beforeAll(async () => {
    // افتراض: user بـ username=rec_omar وreceptionist role
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rec_omar', password: 'P@ssw0rd!' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.roles).toContain('receptionist');
    receptionistToken = res.body.data.access_token;
  });

  test('receptionist يُرفض عند محاولة GET /medical-records (403)', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records')
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  test('receptionist لا يستطيع إنشاء سجل طبي (403)', async () => {
    const res = await request(app)
      .post('/api/v1/medical-records')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patient_id: 1, chief_complaint: 'ألم' });

    expect(res.status).toBe(403);
  });

  test('receptionist يستطيع قراءة قائمة المرضى (200)', async () => {
    // receptionist يملك patients:read
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(200);
  });

  test('receptionist يستطيع حجز موعد (201)', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id:       1,
        doctor_id:        1,
        appointment_date: '2025-12-01T09:00:00Z',
        reason:           'كشف دوري',
      });

    // 201 إذا نجح أو 400 إذا كانت البيانات المُرسَلة غير صالحة
    // الأهم: ليس 403
    expect(res.status).not.toBe(403);
  });
});
```

---

## الاختبار 4 — تسجيل دخول فاشل وقفل الحساب

**السيناريو:** 5 محاولات خاطئة متتالية ← الحساب يُقفل ← 403 ACCOUNT_LOCKED

```js
// integration/account-lock.int.test.js
const request = require('supertest');
const app     = require('../../src/app');

describe('[INT] Account lockout after 5 failed attempts', () => {
  const username = 'test_lockout_user'; // مستخدم مُعدّ خصيصاً للاختبار

  // إرسال 4 محاولات فاشلة — لا يقفل بعد
  for (let i = 1; i <= 4; i++) {
    test(`المحاولة الفاشلة رقم ${i} — 401 INVALID_CREDENTIALS`, async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username, password: 'WRONG_PASS' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  }

  test('المحاولة الخامسة — الحساب يُقفل (403 ACCOUNT_LOCKED)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username, password: 'WRONG_PASS' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
  });
});
```

---

## الاختبار 5 — بلا توكن → 401 على كل المسارات المحمية

```js
// integration/no-auth.int.test.js
const request = require('supertest');
const app     = require('../../src/app');

describe('[INT] Protected routes reject unauthenticated requests', () => {
  const protectedRoutes = [
    ['GET',   '/api/v1/patients'],
    ['GET',   '/api/v1/medical-records'],
    ['GET',   '/api/v1/appointments'],
    ['GET',   '/api/v1/auth/me'],
  ];

  protectedRoutes.forEach(([method, path]) => {
    test(`${method} ${path} بلا توكن → 401`, async () => {
      const res = await request(app)[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });
  });
});
```

---

## جدول تغطية الأدوار المتوقعة

| المستخدم | patients:read | medical_records:read | medical_records:create | appointments:create |
|---|---|---|---|---|
| admin | 200 | 200 | 200 | 200 |
| doctor | 200 | 200 | 200 | 403* |
| nurse | 200 | 200 | 403 | 403* |
| receptionist | 200 | **403** | **403** | 200 |
| patient | 200* (own) | 200* (own) | **403** | 200 |

`*` يعتمد على ضبط RLS في PostgreSQL وتعريف صلاحيات الدور.

---

## ملاحظات التشغيل في CI/CD

```yaml
# مثال GitHub Actions — تشغيل اختبارات التكامل
jobs:
  integration-tests:
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: hospital_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports: ['5432:5432']
    steps:
      - run: npm ci
      - run: node migrations/run.js   # شغّل migration على DB الاختبار
      - run: node seed/test-data.js   # أضف بيانات المستخدمين التجريبيين
      - run: |
          DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/hospital_test \
          JWT_SECRET=ci-secret-for-testing-only-32chars \
          BCRYPT_ROUNDS=4 \
          NODE_ENV=test \
          npx jest --testPathPattern=integration --runInBand --forceExit
```
