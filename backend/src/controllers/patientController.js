'use strict';

// =====================================================================
//  patientController — CRUD كامل لجدول patients
//
//  كل استعلام يمرّ عبر withUserContext لتفعيل RLS تلقائياً:
//    - سياسة patients_select: admin/receptionist يريان الكل؛
//      المريض سجله؛ الطبيب مرضاه عبر medical_records/appointments.
//    - سياسة patients_insert: receptionist/admin فقط.
//    - سياسة patients_update: receptionist/admin أو المريض لسجله.
//
//  هذا الملف هو النموذج الذي يحتذيه باقي الـ controllers:
//    1. استورد { withUserContext } من config/db
//    2. نفِّذ كل استعلام داخل withUserContext(req.user.id, req.user.roles, async(client)=>...)
//    3. الـ RLS يُطبَّق تلقائياً على مستوى PostgreSQL
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// ---- توليد MRN فريد ----
function generateMRN() {
  // صيغة: MRN-YYYYMMDD-XXXX (عشوائي 4 أرقام)
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `MRN-${date}-${suffix}`;
}

// =====================================================================
//  GET /api/v1/patients
//  قائمة المرضى مع بحث بالاسم/MRN وpagination (page-based)
//  الأدوار: receptionist, doctor, nurse, admin
// =====================================================================
const listPatients = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS يُصفّي الصفوف تلقائياً حسب دور المستخدم
    if (search) {
      return client.query(
        `SELECT id, medical_record_number, first_name, last_name,
                gender, date_of_birth, blood_type, phone, email, created_at
           FROM patients
          WHERE first_name ILIKE $1
             OR last_name  ILIKE $1
             OR medical_record_number ILIKE $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
        [search, limit, offset]
      );
    }
    return client.query(
      `SELECT id, medical_record_number, first_name, last_name,
              gender, date_of_birth, blood_type, phone, email, created_at
         FROM patients
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  });

  // إجمالي الصفوف لبناء meta
  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    if (search) {
      return client.query(
        `SELECT COUNT(*) FROM patients
          WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR medical_record_number ILIKE $1`,
        [search]
      );
    }
    return client.query('SELECT COUNT(*) FROM patients');
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

// =====================================================================
//  GET /api/v1/patients/:id
//  ملف مريض محدد — RLS يمنع الوصول إذا لم يكن المستخدم مُخوَّلاً
//  الأدوار: receptionist, doctor, nurse, admin, patient(own)
// =====================================================================
const getPatient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT id, medical_record_number, first_name, last_name, national_id,
              gender, date_of_birth, blood_type, phone, email, address,
              emergency_contact_name, emergency_contact_phone, created_at, updated_at
         FROM patients
        WHERE id = $1`,
      [id]
    );
  });

  // إذا لم تُعِد RLS أي صف: إمّا غير موجود أو غير مُخوَّل (نُعطي 404 للاثنين أماناً)
  if (result.rows.length === 0) {
    throw new AppError('المريض غير موجود أو ليس لديك صلاحية الوصول إليه', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/patients
//  تسجيل مريض جديد — يُولِّد MRN تلقائياً
//  الأدوار: receptionist, admin
// =====================================================================
const createPatient = asyncHandler(async (req, res) => {
  const {
    first_name, last_name, national_id, gender,
    date_of_birth, blood_type, phone, email, address,
    emergency_contact_name, emergency_contact_phone,
  } = req.body;

  // التحقق من الحقول الإلزامية
  if (!first_name || !last_name || !date_of_birth) {
    throw new AppError('first_name و last_name و date_of_birth مطلوبة', 400, 'VALIDATION_ERROR');
  }

  // التحقق من قيمة gender
  if (gender && !['M', 'F'].includes(gender)) {
    throw new AppError("gender يجب أن يكون 'M' أو 'F'", 400, 'VALIDATION_ERROR');
  }

  // توليد MRN فريد — إعادة المحاولة عند التكرار (نادر جداً)
  let mrn;
  let attempts = 0;
  while (attempts < 5) {
    mrn = generateMRN();
    const check = await withUserContext(req.user.id, req.user.roles, async (client) => {
      return client.query('SELECT id FROM patients WHERE medical_record_number = $1', [mrn]);
    });
    if (check.rows.length === 0) break;
    attempts++;
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // سياسة patients_insert في RLS ستُرفض تلقائياً إن لم يكن الدور receptionist/admin
    return client.query(
      `INSERT INTO patients
         (medical_record_number, first_name, last_name, national_id, gender,
          date_of_birth, blood_type, phone, email, address,
          emergency_contact_name, emergency_contact_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        mrn, first_name, last_name, national_id || null, gender || null,
        date_of_birth, blood_type || null, phone || null, email || null, address || null,
        emergency_contact_name || null, emergency_contact_phone || null,
      ]
    );
  });

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/patients/:id
//  تعديل البيانات الديموغرافية — RLS تمنع التعديل إن لم يكن مُخوَّلاً
//  الأدوار: receptionist, admin (المريض يُعدِّل سجله فقط عبر RLS)
// =====================================================================
const updatePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // الحقول المسموح بتعديلها (whitelist — منع mass assignment)
  const allowed = [
    'first_name', 'last_name', 'national_id', 'gender', 'date_of_birth',
    'blood_type', 'phone', 'email', 'address',
    'emergency_contact_name', 'emergency_contact_phone',
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  // بناء SET ديناميكي
  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `UPDATE patients
          SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, medical_record_number, first_name, last_name,
                  gender, date_of_birth, blood_type, phone, email,
                  address, updated_at`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('المريض غير موجود أو ليس لديك صلاحية تعديله', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { listPatients, getPatient, createPatient, updatePatient };
