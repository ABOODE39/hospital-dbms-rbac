'use strict';

// =====================================================================
//  authController — تسجيل + تسجيل دخول + بيانات الحساب
//  register: يُنشئ user مرتبطاً بـ patient_id أو staff_id
//  login:    يتحقق bcrypt، يُصدر JWT يحوي roles+permissions
//  me:       يُعيد الملف الشخصي للمستخدم المصادَق
// =====================================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const { query, withUserContext } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError     = require('../utils/AppError');

// ---- دوال مساعدة داخلية ----

/** جلب صلاحيات المستخدم من قاعدة البيانات عبر أدواره */
async function fetchUserPermissions(userId) {
  const result = await query(
    `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p       ON p.id = rp.permission_id
      WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows.map((r) => r.code);
}

/** جلب أسماء أدوار المستخدم */
async function fetchUserRoles(userId) {
  const result = await query(
    `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows.map((r) => r.name);
}

/** إصدار Access Token */
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

// ---- POST /api/v1/auth/register ----
const register = asyncHandler(async (req, res) => {
  const { username, email, password, staff_id, patient_id } = req.body;

  // التحقق من المدخلات الأساسية
  if (!username || !email || !password) {
    throw new AppError('username و email و password مطلوبة', 400, 'VALIDATION_ERROR');
  }
  if (!staff_id && !patient_id) {
    throw new AppError('يجب ربط الحساب بـ staff_id أو patient_id', 400, 'VALIDATION_ERROR');
  }

  // التحقق من عدم تكرار username أو email
  const existing = await query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  if (existing.rows.length > 0) {
    throw new AppError('اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً', 409, 'DUPLICATE_USER');
  }

  // تشفير كلمة المرور — لا تُخزَّن الكلمة أبداً
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
  const password_hash = await bcrypt.hash(password, rounds);

  const result = await query(
    `INSERT INTO users (username, email, password_hash, staff_id, patient_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, staff_id, patient_id, is_active, created_at`,
    [username, email, password_hash, staff_id || null, patient_id || null]
  );

  const user = result.rows[0];
  res.status(201).json({ success: true, data: user });
});

// ---- POST /api/v1/auth/login ----
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError('username و password مطلوبان', 400, 'VALIDATION_ERROR');
  }

  // جلب المستخدم (بلا withUserContext — المستخدم لم يُصادَق بعد)
  const result = await query(
    `SELECT id, username, email, password_hash, staff_id, patient_id,
            is_active, failed_login_attempts
       FROM users
      WHERE username = $1`,
    [username]
  );

  const user = result.rows[0];

  // رسالة موحَّدة لمنع استطلاع الأسماء (username enumeration)
  const invalidCreds = new AppError('بيانات الدخول غير صحيحة', 401, 'INVALID_CREDENTIALS');

  if (!user) throw invalidCreds;

  // التحقق من الحساب المفعَّل
  if (!user.is_active) {
    throw new AppError('الحساب معطَّل — تواصل مع الإدارة', 403, 'ACCOUNT_DISABLED');
  }

  // التحقق من كلمة المرور
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    // زيادة عدد المحاولات الفاشلة — قفل بعد 5 محاولات
    const attempts = user.failed_login_attempts + 1;
    const shouldLock = attempts >= 5;
    await query(
      `UPDATE users SET failed_login_attempts = $1, is_active = $2, updated_at = NOW()
        WHERE id = $3`,
      [shouldLock ? 0 : attempts, !shouldLock, user.id]
    );
    if (shouldLock) {
      throw new AppError('تم قفل الحساب بعد 5 محاولات فاشلة', 403, 'ACCOUNT_LOCKED');
    }
    throw invalidCreds;
  }

  // إعادة تصفير المحاولات الفاشلة وتسجيل وقت الدخول
  await query(
    `UPDATE users SET failed_login_attempts = 0, last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [user.id]
  );

  // جلب الأدوار والصلاحيات لتضمينها في JWT
  const [roles, permissions] = await Promise.all([
    fetchUserRoles(user.id),
    fetchUserPermissions(user.id),
  ]);

  // بناء الـ payload وإصدار الرمز
  const tokenPayload = {
    sub:        user.id,
    staff_id:   user.staff_id,
    patient_id: user.patient_id,
    roles,
    permissions,
  };
  const accessToken = signAccessToken(tokenPayload);

  res.status(200).json({
    success: true,
    data: {
      access_token: accessToken,
      token_type:   'Bearer',
      expires_in:   process.env.JWT_EXPIRES_IN || '15m',
      user: {
        id:         user.id,
        username:   user.username,
        email:      user.email,
        staff_id:   user.staff_id,
        patient_id: user.patient_id,
        roles,
        permissions,
      },
    },
  });
});

// ---- GET /api/v1/auth/me ----
const me = asyncHandler(async (req, res) => {
  // req.user مُعبَّأ بالفعل من authenticate middleware
  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT id, username, email, staff_id, patient_id, is_active, last_login_at, created_at
         FROM users WHERE id = $1`,
      [req.user.id]
    );
  });

  const user = result.rows[0];
  if (!user) throw new AppError('المستخدم غير موجود', 404, 'USER_NOT_FOUND');

  res.status(200).json({
    success: true,
    data: {
      ...user,
      roles:       req.user.roles,
      permissions: req.user.permissions,
    },
  });
});

module.exports = { register, login, me };
