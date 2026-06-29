'use strict';

// =====================================================================
//  userController — إدارة المستخدمين (users + user_roles) — admin فقط
//
//  RLS (02_rbac_rls.sql — القسم ج-8 — users):
//    SELECT:        admin OR id = app_current_user_id()
//    INSERT:        admin فقط
//    UPDATE USING:  admin OR id = app_current_user_id()
//    DELETE USING:  admin فقط
//
//  RLS (02_rbac_rls.sql — القسم ج-9 — user_roles):
//    SELECT:  admin OR user_id = app_current_user_id()
//    INSERT:  admin فقط
//    DELETE:  admin فقط
//
//  الصلاحيات (كلها admin):
//    users:read   — admin
//    users:create — admin
//    users:update — admin
//    users:delete — admin (سحب أدوار)
// =====================================================================

const bcrypt      = require('bcryptjs');
const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

const BCRYPT_ROUNDS = 12;

// =====================================================================
//  GET /api/v1/users
//  قائمة المستخدمين مع pagination وفلتر role/is_active
//  الأدوار: admin فقط
// =====================================================================
const listUsers = asyncHandler(async (req, res) => {
  const page      = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit     = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset    = (page - 1) * limit;
  const { is_active, role } = req.query;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];

    if (is_active !== undefined) {
      conditions.push(`u.is_active = $${params.push(is_active === 'true')}`);
    }

    // فلتر حسب الدور عبر JOIN
    if (role) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.name = $${params.push(role)}
         )`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    // لا نُعيد password_hash في أي حال
    return client.query(
      `SELECT u.id,
              u.username,
              u.email,
              u.staff_id,
              u.patient_id,
              u.is_active,
              u.last_login_at,
              u.failed_login_attempts,
              u.created_at,
              u.updated_at,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name))
                FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS roles
         FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
         ${where}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  });

  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];
    if (is_active !== undefined) {
      conditions.push(`u.is_active = $${params.push(is_active === 'true')}`);
    }
    if (role) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.name = $${params.push(role)}
         )`
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return client.query(`SELECT COUNT(*) FROM users u ${where}`, params);
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
});

// =====================================================================
//  GET /api/v1/users/:id
//  تفاصيل مستخدم محدد مع أدواره وحالة الحساب
//  الأدوار: admin فقط
// =====================================================================
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT u.id,
              u.username,
              u.email,
              u.staff_id,
              u.patient_id,
              u.is_active,
              u.last_login_at,
              u.failed_login_attempts,
              u.created_at,
              u.updated_at,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name))
                FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS roles
         FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1
        GROUP BY u.id`,
      [id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('المستخدم غير موجود', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/users
//  إنشاء حساب مستخدم جديد (موظف أو مريض) — admin فقط
//  يُجزِّئ كلمة المرور بـ bcrypt قبل التخزين
// =====================================================================
const createUser = asyncHandler(async (req, res) => {
  const { username, email, password, staff_id, patient_id } = req.body;

  // التحقق من الحقول الإلزامية
  if (!username || !email || !password) {
    throw new AppError('username و email و password مطلوبة', 400, 'VALIDATION_ERROR');
  }

  // القيد: حساب إمّا موظف أو مريض (CHECK في DB لكن نتحقق مبكراً)
  if (!staff_id && !patient_id) {
    throw new AppError(
      'يجب ربط الحساب بـ staff_id أو patient_id',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (staff_id && patient_id) {
    throw new AppError(
      'الحساب إمّا لموظف (staff_id) أو لمريض (patient_id)، ليس كلاهما',
      400,
      'VALIDATION_ERROR'
    );
  }

  // التحقق من قوة كلمة المرور (حد أدنى 8 أحرف)
  if (password.length < 8) {
    throw new AppError('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400, 'VALIDATION_ERROR');
  }

  // تجزئة كلمة المرور — لا تُخزَّن الكلمة الصريحة أبداً
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS تتحقق أن المنشئ admin
    return client.query(
      `INSERT INTO users (username, email, password_hash, staff_id, patient_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, staff_id, patient_id, is_active, created_at`,
      [username, email, password_hash, staff_id || null, patient_id || null]
    );
  });

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/users/:id
//  تعديل حساب: تفعيل/تعطيل, إعادة تعيين failed_login_attempts — admin
// =====================================================================
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // whitelist الحقول — admin لا يُعدِّل password_hash هنا (endpoint مستقل)
  const allowed = ['is_active', 'failed_login_attempts', 'email'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  // دائماً نُحدِّث updated_at
  updates.updated_at = new Date().toISOString();

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `UPDATE users
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING id, username, email, staff_id, patient_id,
                  is_active, failed_login_attempts, updated_at`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('المستخدم غير موجود', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/users/:id/roles
//  تعيين أدوار للمستخدم — يُضيف سجلات user_roles — admin فقط
//  Body: { role_ids: [1, 2, ...] }
// =====================================================================
const assignRoles = asyncHandler(async (req, res) => {
  const { id }      = req.params;
  const { role_ids } = req.body;

  if (!Array.isArray(role_ids) || role_ids.length === 0) {
    throw new AppError('role_ids يجب أن يكون مصفوفة تحتوي معرّفات دور واحد على الأقل', 400, 'VALIDATION_ERROR');
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // التحقق من وجود المستخدم
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      throw new AppError('المستخدم غير موجود', 404, 'RESOURCE_NOT_FOUND');
    }

    // إدراج الأدوار مع تجاهل التكرار (ON CONFLICT DO NOTHING)
    const inserted = [];
    for (const roleId of role_ids) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [id, roleId]
      );
      inserted.push(roleId);
    }

    // إعادة الأدوار الحالية للمستخدم
    return client.query(
      `SELECT ur.role_id AS id, r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.name`,
      [id]
    );
  });

  res.status(200).json({
    success: true,
    message: `تم تعيين الأدوار بنجاح`,
    data: { user_id: parseInt(id, 10), roles: result.rows },
  });
});

// =====================================================================
//  DELETE /api/v1/users/:id/roles/:role_id
//  سحب دور من مستخدم — admin فقط
// =====================================================================
const removeRole = asyncHandler(async (req, res) => {
  const { id, role_id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING *`,
      [id, role_id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('الدور غير مُعيَّن لهذا المستخدم', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    message: 'تم سحب الدور بنجاح',
    data: result.rows[0],
  });
});

// =====================================================================
//  GET /api/v1/roles
//  قائمة الأدوار مع صلاحياتها — admin فقط
// =====================================================================
const listRoles = asyncHandler(async (req, res) => {
  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT r.id,
              r.name,
              r.description,
              r.created_at,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', p.id, 'code', p.code, 'description', p.description))
                FILTER (WHERE p.id IS NOT NULL),
                '[]'
              ) AS permissions
         FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
        GROUP BY r.id
        ORDER BY r.name`
    );
  });

  res.status(200).json({ success: true, data: result.rows });
});

// =====================================================================
//  GET /api/v1/permissions
//  قائمة جميع الصلاحيات المتاحة — admin فقط
// =====================================================================
const listPermissions = asyncHandler(async (req, res) => {
  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT id, code, description, created_at
         FROM permissions
        ORDER BY code`
    );
  });

  res.status(200).json({ success: true, data: result.rows });
});

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  assignRoles,
  removeRole,
  listRoles,
  listPermissions,
};
