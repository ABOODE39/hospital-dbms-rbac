'use strict';

// =====================================================================
//  authenticate — middleware التحقق من JWT
//  يستخلص Bearer Token من Authorization header، يتحقق منه،
//  ويعبّئ req.user = { id, staff_id, patient_id, roles, permissions }
// =====================================================================

require('dotenv').config();
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

/**
 * authenticate
 * يُستخدم على أي مسار محمي: router.get('/...', authenticate, handler)
 */
function authenticate(req, res, next) {
  // استخلاص الرمز من: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return next(new AppError('الرمز مطلوب — أرسل Authorization: Bearer <token>', 401, 'TOKEN_MISSING'));
  }

  try {
    // التحقق من التوقيع والصلاحية
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // تعبئة req.user من الـ payload
    req.user = {
      id:          payload.sub,          // users.id
      staff_id:    payload.staff_id,     // قد يكون null للمريض
      patient_id:  payload.patient_id,   // قد يكون null للموظف
      roles:       payload.roles || [],
      permissions: payload.permissions || [],
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('انتهت صلاحية الرمز — جدِّد عبر /auth/refresh', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('رمز غير صالح', 401, 'TOKEN_INVALID'));
  }
}

module.exports = { authenticate };
