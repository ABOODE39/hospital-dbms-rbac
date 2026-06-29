'use strict';

// =====================================================================
//  rbac.unit.test.js — اختبارات وحدة لـ requireRole و requirePermission
//
//  لا تحتاج اتصال بقاعدة البيانات أو شبكة.
//  تعمل بالكامل عبر mocks لـ req / res / next.
// =====================================================================

// منع dotenv من البحث عن ملف .env فعلي
jest.mock('dotenv', () => ({ config: jest.fn() }));

// منع AppError من استيراد أي تبعيات خارجية — نستخدمه مباشرة
const AppError = require('../src/utils/AppError');
const { requireRole, requirePermission } = require('../src/middleware/rbac');

// ---- دوال مساعدة لبناء mocks ----

/**
 * بناء req مع req.user اختياري
 * @param {object|null} user - { roles, permissions } أو null لمحاكاة بلا مصادقة
 */
function buildReq(user = null) {
  return { user };
}

/** next() mock — يُسجِّل ما يُستدعى به */
function buildNext() {
  return jest.fn();
}

// =====================================================================
//  requireRole
// =====================================================================

describe('requireRole — اختبارات الدور', () => {

  // ------------------------------------------------------------------
  //  1. بلا req.user → 401
  // ------------------------------------------------------------------
  describe('عندما لا يوجد req.user (بلا توكن / بلا مصادقة)', () => {
    test('يستدعي next بـ AppError 401 UNAUTHENTICATED', () => {
      const middleware = requireRole('admin');
      const req  = buildReq(null);       // لا يوجد user
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHENTICATED');
    });
  });

  // ------------------------------------------------------------------
  //  2. دور مسموح → next() بلا خطأ
  // ------------------------------------------------------------------
  describe('عندما يحمل المستخدم الدور المطلوب', () => {
    test('doctor يمرّ عبر requireRole("doctor")', () => {
      const middleware = requireRole('doctor');
      const req  = buildReq({ roles: ['doctor'], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(/* بلا وسيطات = مرّ */);
    });

    test('admin يمرّ عبر requireRole("admin", "receptionist")', () => {
      const middleware = requireRole('admin', 'receptionist');
      const req  = buildReq({ roles: ['admin'], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('receptionist يمرّ عبر requireRole("admin", "receptionist")', () => {
      const middleware = requireRole('admin', 'receptionist');
      const req  = buildReq({ roles: ['receptionist'], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('مستخدم يحمل أدواراً متعددة — يكفي دور واحد مطابق (OR)', () => {
      const middleware = requireRole('doctor');
      const req  = buildReq({ roles: ['patient', 'doctor'], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  // ------------------------------------------------------------------
  //  3. دور غير مسموح → 403
  // ------------------------------------------------------------------
  describe('عندما لا يحمل المستخدم الدور المطلوب', () => {
    test('patient يُرفض عند requireRole("doctor")', () => {
      const middleware = requireRole('doctor');
      const req  = buildReq({ roles: ['patient'], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('INSUFFICIENT_ROLE');
    });

    test('receptionist يُرفض عند requireRole("doctor", "nurse")', () => {
      const middleware = requireRole('doctor', 'nurse');
      const req  = buildReq({ roles: ['receptionist'], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('INSUFFICIENT_ROLE');
      // التحقق من أن الخطأ يحمل الأدوار المطلوبة والمُسنَدة
      expect(err.details).toMatchObject({
        required: ['doctor', 'nurse'],
        assigned: ['receptionist'],
      });
    });

    test('مستخدم بمصفوفة أدوار فارغة يُرفض', () => {
      const middleware = requireRole('admin');
      const req  = buildReq({ roles: [], permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });

    test('مستخدم بدون خاصية roles يُرفض (تعامل دفاعي)', () => {
      const middleware = requireRole('admin');
      // user موجود لكن بلا خاصية roles
      const req  = buildReq({ permissions: [] });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });
  });

  // ------------------------------------------------------------------
  //  4. أن next() لا يُستدعى مرتين
  // ------------------------------------------------------------------
  test('next يُستدعى مرة واحدة فقط في كل الحالات', () => {
    const middleware = requireRole('admin');
    const req  = buildReq({ roles: ['admin'], permissions: [] });
    const next = buildNext();

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// =====================================================================
//  requirePermission
// =====================================================================

describe('requirePermission — اختبارات الصلاحيات', () => {

  // ------------------------------------------------------------------
  //  1. بلا req.user → 401
  // ------------------------------------------------------------------
  describe('عندما لا يوجد req.user', () => {
    test('يستدعي next بـ AppError 401 UNAUTHENTICATED', () => {
      const middleware = requirePermission('patients:read');
      const req  = buildReq(null);
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHENTICATED');
    });
  });

  // ------------------------------------------------------------------
  //  2. صلاحية واحدة — مسموح
  // ------------------------------------------------------------------
  describe('صلاحية واحدة مطلوبة — المستخدم يحملها', () => {
    test('يمرّ عند توافر patients:read', () => {
      const middleware = requirePermission('patients:read');
      const req  = buildReq({ roles: ['doctor'], permissions: ['patients:read', 'appointments:read'] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('يمرّ عند توافر medical_records:create', () => {
      const middleware = requirePermission('medical_records:create');
      const req  = buildReq({ roles: ['doctor'], permissions: ['medical_records:create', 'medical_records:read'] });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  // ------------------------------------------------------------------
  //  3. صلاحيات متعددة — AND — كلها متوفرة
  // ------------------------------------------------------------------
  describe('صلاحيات متعددة مطلوبة (AND) — جميعها متوفرة', () => {
    test('يمرّ عند توافر patients:read AND appointments:create معاً', () => {
      const middleware = requirePermission('patients:read', 'appointments:create');
      const req  = buildReq({
        roles: ['receptionist'],
        permissions: ['patients:read', 'appointments:create', 'appointments:read'],
      });
      const next = buildNext();

      middleware(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  // ------------------------------------------------------------------
  //  4. صلاحية واحدة — غير مسموح → 403
  // ------------------------------------------------------------------
  describe('صلاحية مطلوبة غير متوفرة', () => {
    test('receptionist يُرفض عند محاولة medical_records:create', () => {
      const middleware = requirePermission('medical_records:create');
      const req  = buildReq({
        roles: ['receptionist'],
        permissions: ['patients:read', 'appointments:create'],
      });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('الخطأ يحمل قائمة الصلاحيات الناقصة (missing)', () => {
      const middleware = requirePermission('medical_records:create');
      const req  = buildReq({
        roles: ['receptionist'],
        permissions: ['patients:read'],
      });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.details).toMatchObject({
        required: ['medical_records:create'],
        missing:  ['medical_records:create'],
      });
    });
  });

  // ------------------------------------------------------------------
  //  5. صلاحيات متعددة (AND) — بعضها ناقص → 403
  // ------------------------------------------------------------------
  describe('صلاحيات متعددة — إحداها ناقصة', () => {
    test('يُرفض إذا كانت إحدى الصلاحيات غير متوفرة', () => {
      const middleware = requirePermission('patients:read', 'medical_records:create');
      const req  = buildReq({
        roles: ['nurse'],
        permissions: ['patients:read', 'medical_records:read'], // medical_records:create غائبة
      });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.details.missing).toContain('medical_records:create');
      // patients:read متوفرة — لا تُدرج في missing
      expect(err.details.missing).not.toContain('patients:read');
    });

    test('يُرفض إذا كانت جميع الصلاحيات غير متوفرة', () => {
      const middleware = requirePermission('lab_orders:create', 'prescriptions:create');
      const req  = buildReq({
        roles: ['receptionist'],
        permissions: ['patients:read', 'appointments:create'],
      });
      const next = buildNext();

      middleware(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.details.missing).toHaveLength(2);
      expect(err.details.missing).toEqual(
        expect.arrayContaining(['lab_orders:create', 'prescriptions:create'])
      );
    });
  });

  // ------------------------------------------------------------------
  //  6. مستخدم بمصفوفة صلاحيات فارغة
  // ------------------------------------------------------------------
  test('مستخدم بلا صلاحيات يُرفض دائماً', () => {
    const middleware = requirePermission('patients:read');
    const req  = buildReq({ roles: ['patient'], permissions: [] });
    const next = buildNext();

    middleware(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  // ------------------------------------------------------------------
  //  7. دفاع ضد غياب خاصية permissions في req.user
  // ------------------------------------------------------------------
  test('مستخدم بدون خاصية permissions لا يتسبب في crash', () => {
    const middleware = requirePermission('patients:read');
    // user موجود لكن بلا permissions
    const req  = buildReq({ roles: ['doctor'] });
    const next = buildNext();

    expect(() => middleware(req, {}, next)).not.toThrow();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  // ------------------------------------------------------------------
  //  8. الاتساق مع requireRole — كلاهما 401 عند غياب user
  // ------------------------------------------------------------------
  test('requirePermission و requireRole كلاهما يُصدران 401 عند غياب user', () => {
    const roleMiddleware = requireRole('doctor');
    const permMiddleware = requirePermission('patients:read');
    const req  = buildReq(null);
    const next1 = buildNext();
    const next2 = buildNext();

    roleMiddleware(req, {}, next1);
    permMiddleware(req, {}, next2);

    expect(next1.mock.calls[0][0].statusCode).toBe(401);
    expect(next2.mock.calls[0][0].statusCode).toBe(401);
  });
});
