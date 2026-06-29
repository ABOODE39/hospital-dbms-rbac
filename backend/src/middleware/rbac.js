'use strict';

// =====================================================================
//  RBAC Middleware — فحص الدور والصلاحية من req.user
//  يعمل بعد authenticate (يفترض وجود req.user)
// =====================================================================

const AppError = require('../utils/AppError');

/**
 * requireRole — يتحقق أن المستخدم يحمل أحد الأدوار المطلوبة
 *
 * مثال: requireRole('admin', 'receptionist')
 * يكفي دور واحد (OR) — المستخدم بدور admin أو receptionist يمرّ
 *
 * @param  {...string} roles - أسماء الأدوار المسموح بها
 * @returns {Function} middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('غير مصادَق', 401, 'UNAUTHENTICATED'));
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      return next(
        new AppError(
          `هذه العملية تتطلب أحد الأدوار: ${roles.join(', ')}`,
          403,
          'INSUFFICIENT_ROLE',
          { required: roles, assigned: userRoles }
        )
      );
    }

    next();
  };
}

/**
 * requirePermission — يتحقق أن المستخدم يحمل كل الصلاحيات المطلوبة
 *
 * الصلاحيات مُضمَّنة في JWT عند الـ login (من role_permissions).
 * مثال: requirePermission('patients:read', 'appointments:create')
 * يجب توافر كل الصلاحيات (AND)
 *
 * @param  {...string} codes - رموز الصلاحيات بصيغة 'resource:action'
 * @returns {Function} middleware
 */
function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('غير مصادَق', 401, 'UNAUTHENTICATED'));
    }

    const userPermissions = req.user.permissions || [];
    const missing = codes.filter((c) => !userPermissions.includes(c));

    if (missing.length > 0) {
      return next(
        new AppError(
          'صلاحيات غير كافية لهذه العملية',
          403,
          'INSUFFICIENT_PERMISSIONS',
          { required: codes, missing }
        )
      );
    }

    next();
  };
}

/**
 * requireAnyPermission — يتحقق أن المستخدم يحمل على الأقل إحدى الصلاحيات (OR)
 *
 * مثال: requireAnyPermission('prescriptions:dispense', 'prescriptions:update')
 * يكفي توافر صلاحية واحدة منها للسماح بالعملية.
 *
 * @param  {...string} codes - رموز الصلاحيات بصيغة 'resource:action'
 * @returns {Function} middleware
 */
function requireAnyPermission(...codes) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('غير مصادَق', 401, 'UNAUTHENTICATED'));
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = codes.some((c) => userPermissions.includes(c));

    if (!hasAny) {
      return next(
        new AppError(
          'صلاحيات غير كافية لهذه العملية',
          403,
          'INSUFFICIENT_PERMISSIONS',
          { required_any: codes, assigned: userPermissions }
        )
      );
    }

    next();
  };
}

module.exports = { requireRole, requirePermission, requireAnyPermission };
