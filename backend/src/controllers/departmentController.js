'use strict';

// =====================================================================
//  departmentController — إدارة أقسام المستشفى (departments)
//
//  صلاحيات الوصول حسب permission_matrix:
//    - list / get: جميع الموظّفين المصادَقين (authenticated)
//                  المرضى لا يصلون للأقسام
//    - create:     admin فقط
//    - update:     admin فقط (الموقع، الهاتف، رئيس القسم)
//
//  RLS (02_rbac_rls.sql) على departments مخفّفة:
//    SELECT → TRUE للموظّفين المصادَقين (قراءة حرة لبيانات مرجعية تنظيمية)
//    INSERT/UPDATE/DELETE → WITH CHECK ( app_has_role('admin') )
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/departments
//  قائمة الأقسام مع رئيس القسم وعدد موظّفي كل قسم
//  الأدوار: جميع الموظّفين (authenticated) عدا patient
// =====================================================================
const listDepartments = asyncHandler(async (req, res) => {
  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT
          d.id,
          d.name,
          d.location,
          d.phone,
          d.head_staff_id,
          CONCAT(s.first_name, ' ', s.last_name) AS head_staff_name,
          s.staff_type AS head_staff_type,
          COUNT(st.id) AS staff_count,
          d.created_at
       FROM departments d
       LEFT JOIN staff s  ON s.id  = d.head_staff_id
       LEFT JOIN staff st ON st.department_id = d.id AND st.is_active = TRUE
       GROUP BY d.id, d.name, d.location, d.phone, d.head_staff_id,
                s.first_name, s.last_name, s.staff_type
       ORDER BY d.name ASC`
    );
  });

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: { total: result.rows.length },
  });
});

// =====================================================================
//  GET /api/v1/departments/:id
//  تفاصيل قسم محدد مع قائمة الموظّفين النشطين
//  الأدوار: جميع الموظّفين (authenticated)
// =====================================================================
const getDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // جلب بيانات القسم مع رئيسه
  const deptResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT
          d.id,
          d.name,
          d.location,
          d.phone,
          d.head_staff_id,
          CONCAT(s.first_name, ' ', s.last_name) AS head_staff_name,
          s.staff_type AS head_staff_type,
          s.email AS head_staff_email,
          d.created_at
       FROM departments d
       LEFT JOIN staff s ON s.id = d.head_staff_id
       WHERE d.id = $1`,
      [id]
    );
  });

  if (deptResult.rows.length === 0) {
    throw new AppError('القسم غير موجود', 404, 'RESOURCE_NOT_FOUND');
  }

  // جلب الموظّفين النشطين في هذا القسم
  const staffResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT
          s.id,
          s.first_name,
          s.last_name,
          s.staff_type,
          s.phone,
          s.email,
          s.hire_date
       FROM staff s
       WHERE s.department_id = $1
         AND s.is_active = TRUE
       ORDER BY s.staff_type, s.last_name`,
      [id]
    );
  });

  res.status(200).json({
    success: true,
    data: {
      ...deptResult.rows[0],
      staff: staffResult.rows,
    },
  });
});

// =====================================================================
//  POST /api/v1/departments
//  إنشاء قسم جديد — admin فقط
// =====================================================================
const createDepartment = asyncHandler(async (req, res) => {
  const { name, location, phone, head_staff_id } = req.body;

  // name إلزامي
  if (!name || !name.trim()) {
    throw new AppError('name مطلوب', 400, 'VALIDATION_ERROR');
  }

  // التحقق من وجود الموظّف المُعيَّن رئيساً (إن أُرسل)
  if (head_staff_id) {
    const staffCheck = await withUserContext(req.user.id, req.user.roles, async (client) => {
      return client.query(
        'SELECT id FROM staff WHERE id = $1 AND is_active = TRUE',
        [parseInt(head_staff_id, 10)]
      );
    });
    if (staffCheck.rows.length === 0) {
      throw new AppError(
        'الموظّف المُعيَّن رئيساً غير موجود أو غير نشط',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS WITH CHECK ( app_has_role('admin') ) تتحقق تلقائياً
    return client.query(
      `INSERT INTO departments (name, location, phone, head_staff_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        name.trim(),
        location ? location.trim() : null,
        phone   ? phone.trim()    : null,
        head_staff_id ? parseInt(head_staff_id, 10) : null,
      ]
    );
  });

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/departments/:id
//  تعديل القسم: الموقع، الهاتف، رئيس القسم — admin فقط
// =====================================================================
const updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // الحقول المسموح بتعديلها (whitelist — لا يُسمح بتعديل name إلا بإذن منفصل)
  const allowed = ['name', 'location', 'phone', 'head_staff_id'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  // التحقق من وجود الموظّف الجديد لرئاسة القسم إن أُرسل
  if (updates.head_staff_id) {
    const staffCheck = await withUserContext(req.user.id, req.user.roles, async (client) => {
      return client.query(
        'SELECT id FROM staff WHERE id = $1 AND is_active = TRUE',
        [parseInt(updates.head_staff_id, 10)]
      );
    });
    if (staffCheck.rows.length === 0) {
      throw new AppError(
        'الموظّف المُعيَّن رئيساً غير موجود أو غير نشط',
        400,
        'VALIDATION_ERROR'
      );
    }
    updates.head_staff_id = parseInt(updates.head_staff_id, 10);
  }

  // بناء SET ديناميكي
  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS UPDATE WITH CHECK ( app_has_role('admin') ) تتحقق تلقائياً
    return client.query(
      `UPDATE departments
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING id, name, location, phone, head_staff_id, created_at`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('القسم غير موجود', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment };
