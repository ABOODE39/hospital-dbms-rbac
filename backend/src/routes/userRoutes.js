'use strict';

// =====================================================================
//  مسارات إدارة المستخدمين — /api/v1/users (admin فقط)
//
//  Permission matrix (كل الصلاحيات حصرية لـ admin):
//    users:read   — GET /users , GET /users/:id
//    users:create — POST /users
//    users:update — PATCH /users/:id
//    users:manage_roles — POST /users/:id/roles , DELETE /users/:id/roles/:role_id
//
//  الأدوار والصلاحيات:
//    roles:read   — GET /roles
//    roles:read   — GET /permissions
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  assignRoles,
  removeRole,
  listRoles,
  listPermissions,
} = require('../controllers/userController');

// كل مسارات إدارة المستخدمين تتطلب مصادقة
router.use(authenticate);

// ─── المستخدمون ───────────────────────────────────────────────────────

// GET /api/v1/users — قائمة المستخدمين (admin)
router.get(
  '/',
  requirePermission('users:read'),
  listUsers
);

// POST /api/v1/users — إنشاء حساب جديد (admin)
router.post(
  '/',
  requirePermission('users:create'),
  createUser
);

// GET /api/v1/users/:id — تفاصيل مستخدم (admin)
router.get(
  '/:id',
  requirePermission('users:read'),
  getUser
);

// PATCH /api/v1/users/:id — تعديل الحساب: is_active / failed_login_attempts (admin)
router.patch(
  '/:id',
  requirePermission('users:update'),
  updateUser
);

// POST /api/v1/users/:id/roles — تعيين أدوار (admin)
router.post(
  '/:id/roles',
  requirePermission('users:manage_roles'),
  assignRoles
);

// DELETE /api/v1/users/:id/roles/:role_id — سحب دور (admin)
router.delete(
  '/:id/roles/:role_id',
  requirePermission('users:manage_roles'),
  removeRole
);

// ─── الأدوار والصلاحيات (للإدارة والعرض) ─────────────────────────────

// GET /api/v1/roles — قائمة الأدوار مع صلاحياتها (admin)
router.get(
  '/roles/list',
  requirePermission('roles:read'),
  listRoles
);

// GET /api/v1/permissions — قائمة جميع الصلاحيات (admin)
router.get(
  '/permissions/list',
  requirePermission('permissions:read'),
  listPermissions
);

module.exports = router;
