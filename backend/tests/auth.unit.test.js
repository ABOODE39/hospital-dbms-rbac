'use strict';

// =====================================================================
//  auth.unit.test.js — اختبارات وحدة لـ:
//    1. JWT: توليد وتحقق صحيح، token منتهي الصلاحية، token مزوَّر
//    2. bcryptjs: hash/compare — تشفير وتحقق كلمة المرور
//    3. authenticate middleware: Bearer parsing، TOKEN_MISSING، TOKEN_EXPIRED،
//       TOKEN_INVALID، تعبئة req.user الصحيحة
//
//  لا تحتاج قاعدة بيانات أو شبكة.
// =====================================================================

// منع dotenv من البحث عن ملف .env
jest.mock('dotenv', () => ({ config: jest.fn() }));

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const AppError = require('../src/utils/AppError');

// نضبط JWT_SECRET في process.env قبل استيراد auth.js
const TEST_SECRET = 'test-secret-key-for-jest-32chars!!';
process.env.JWT_SECRET = TEST_SECRET;

// استيراد middleware المصادقة بعد ضبط المتغير البيئي
const { authenticate } = require('../src/middleware/auth');

// ---- مساعدات ----

function buildNext() {
  return jest.fn();
}

/** بناء req بـ Authorization header */
function buildReq(authHeader) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

/** توليد token صحيح للاختبار */
function signToken(payload, options = {}) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '15m', ...options });
}

// =====================================================================
//  القسم 1: JWT — توليد وتحقق
// =====================================================================

describe('JWT — توليد وتحقق', () => {

  describe('توليد token صحيح', () => {
    test('jwt.sign يُنتج سلسلة نصية بثلاثة أجزاء (header.payload.signature)', () => {
      const token = signToken({ sub: 42, roles: ['doctor'] });
      expect(typeof token).toBe('string');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    test('jwt.verify يُعيد payload صحيح بنفس البيانات المُوقَّعة', () => {
      const payload = {
        sub:        99,
        staff_id:   5,
        patient_id: null,
        roles:      ['nurse'],
        permissions: ['patients:read'],
      };
      const token   = signToken(payload);
      const decoded = jwt.verify(token, TEST_SECRET);

      expect(decoded.sub).toBe(99);
      expect(decoded.staff_id).toBe(5);
      expect(decoded.roles).toEqual(['nurse']);
      expect(decoded.permissions).toEqual(['patients:read']);
    });

    test('token موقَّع بـ secret خاطئ يُرفض بخطأ JsonWebTokenError', () => {
      const token = signToken({ sub: 1 });
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });

    test('token منتهي الصلاحية يُرفض بخطأ TokenExpiredError', () => {
      // expiresIn = -1s يعني منتهٍ فوراً
      const token = signToken({ sub: 1 }, { expiresIn: '-1s' });
      try {
        jwt.verify(token, TEST_SECRET);
        fail('كان يجب أن يرفع خطأ');
      } catch (err) {
        expect(err.name).toBe('TokenExpiredError');
      }
    });

    test('token مُزوَّر (تعديل payload بلا إعادة توقيع) يُرفض', () => {
      const token  = signToken({ sub: 1, roles: ['patient'] });
      const parts  = token.split('.');
      // تعديل payload: رفع الـrole إلى admin
      const fakePayload = Buffer.from(
        JSON.stringify({ sub: 1, roles: ['admin'] })
      ).toString('base64url');
      const forgedToken = `${parts[0]}.${fakePayload}.${parts[2]}`;

      expect(() => jwt.verify(forgedToken, TEST_SECRET)).toThrow();
    });
  });

  describe('jwt.decode (بلا تحقق — للاطلاع فقط)', () => {
    test('يفك ترميز payload بلا تحقق من التوقيع', () => {
      const token   = signToken({ sub: 7, roles: ['admin'] });
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe(7);
      expect(decoded.roles).toContain('admin');
    });
  });
});

// =====================================================================
//  القسم 2: bcryptjs — تشفير وتحقق كلمة المرور
// =====================================================================

describe('bcryptjs — hash وcompare', () => {
  const PLAIN_PASSWORD   = 'P@ssw0rd!Hospital2025';
  const WRONG_PASSWORD   = 'WrongP@ss!';

  let hashedPassword;

  // نُنشئ الـ hash مرة واحدة لكل الاختبارات في هذا القسم
  beforeAll(async () => {
    hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, 10); // rounds=10 أسرع في الاختبارات
  });

  test('bcrypt.hash يُنتج hash يختلف عن كلمة المرور الأصلية', () => {
    expect(hashedPassword).not.toBe(PLAIN_PASSWORD);
  });

  test('hash يبدأ بـ $2a$ أو $2b$ (صيغة bcrypt القياسية)', () => {
    expect(hashedPassword).toMatch(/^\$2[ab]\$/);
  });

  test('hash يختلف في كل استدعاء رغم نفس كلمة المرور (salt عشوائي)', async () => {
    const hash2 = await bcrypt.hash(PLAIN_PASSWORD, 10);
    expect(hashedPassword).not.toBe(hash2);
  });

  test('bcrypt.compare تُعيد true مع كلمة المرور الصحيحة', async () => {
    const match = await bcrypt.compare(PLAIN_PASSWORD, hashedPassword);
    expect(match).toBe(true);
  });

  test('bcrypt.compare تُعيد false مع كلمة مرور خاطئة', async () => {
    const match = await bcrypt.compare(WRONG_PASSWORD, hashedPassword);
    expect(match).toBe(false);
  });

  test('bcrypt.compare تُعيد false مع سلسلة فارغة', async () => {
    const match = await bcrypt.compare('', hashedPassword);
    expect(match).toBe(false);
  });

  test('bcrypt.compare لا تُعيد true عند المقارنة بـ hash آخر', async () => {
    const otherHash = await bcrypt.hash('CompletelyDifferent!', 10);
    const match = await bcrypt.compare(PLAIN_PASSWORD, otherHash);
    expect(match).toBe(false);
  });

  test('bcrypt.hashSync (المزامن) تعطي نفس خاصية الأمان', () => {
    const syncHash = bcrypt.hashSync(PLAIN_PASSWORD, 10);
    const match    = bcrypt.compareSync(PLAIN_PASSWORD, syncHash);
    expect(match).toBe(true);
  });
});

// =====================================================================
//  القسم 3: authenticate middleware
// =====================================================================

describe('authenticate middleware', () => {

  // ------------------------------------------------------------------
  //  3-A: غياب الـ token
  // ------------------------------------------------------------------
  describe('عند غياب Authorization header', () => {
    test('يستدعي next بـ AppError 401 TOKEN_MISSING', () => {
      const req  = buildReq(null);  // لا header
      const next = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_MISSING');
    });

    test('header موجود لكن بدون كلمة Bearer يُعامَل كـ missing', () => {
      const req  = buildReq('Basic somebase64value');
      const next = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_MISSING');
    });

    test('Bearer بدون token (فراغ) يُعامَل كـ missing', () => {
      const req  = buildReq('Bearer ');
      const next = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_MISSING');
    });
  });

  // ------------------------------------------------------------------
  //  3-B: token صحيح → تعبئة req.user
  // ------------------------------------------------------------------
  describe('عند تقديم token صحيح', () => {
    test('يُعبِّئ req.user بالحقول الصحيحة من payload', () => {
      const payload = {
        sub:        55,
        staff_id:   10,
        patient_id: null,
        roles:      ['doctor'],
        permissions: ['patients:read', 'medical_records:read'],
      };
      const token = signToken(payload);
      const req   = buildReq(`Bearer ${token}`);
      const next  = buildNext();

      authenticate(req, {}, next);

      // يجب أن يُستدعى next() بلا خطأ
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(55);
      expect(req.user.staff_id).toBe(10);
      expect(req.user.patient_id).toBeNull();
      expect(req.user.roles).toEqual(['doctor']);
      expect(req.user.permissions).toEqual(['patients:read', 'medical_records:read']);
    });

    test('مريض: patient_id مُعبَّأ وstaff_id يُعاد كـ undefined/null', () => {
      const payload = {
        sub:        77,
        staff_id:   null,
        patient_id: 33,
        roles:      ['patient'],
        permissions: ['appointments:create'],
      };
      const token = signToken(payload);
      const req   = buildReq(`Bearer ${token}`);
      const next  = buildNext();

      authenticate(req, {}, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user.patient_id).toBe(33);
      expect(req.user.roles).toEqual(['patient']);
    });

    test('payload بلا roles أو permissions يُعبِّئ مصفوفات فارغة (دفاع)', () => {
      // payload أدنى — بلا roles/permissions
      const payload = { sub: 88 };
      const token = signToken(payload);
      const req   = buildReq(`Bearer ${token}`);
      const next  = buildNext();

      authenticate(req, {}, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user.roles).toEqual([]);
      expect(req.user.permissions).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  //  3-C: token منتهي الصلاحية → 401 TOKEN_EXPIRED
  // ------------------------------------------------------------------
  describe('عند تقديم token منتهي الصلاحية', () => {
    test('يستدعي next بـ AppError 401 TOKEN_EXPIRED', () => {
      const token = signToken({ sub: 1, roles: ['admin'] }, { expiresIn: '-1s' });
      const req   = buildReq(`Bearer ${token}`);
      const next  = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_EXPIRED');
    });
  });

  // ------------------------------------------------------------------
  //  3-D: token مزوَّر أو غير صالح → 401 TOKEN_INVALID
  // ------------------------------------------------------------------
  describe('عند تقديم token غير صالح', () => {
    test('سلسلة عشوائية تُعطي TOKEN_INVALID', () => {
      const req  = buildReq('Bearer this.is.not.a.jwt');
      const next = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_INVALID');
    });

    test('token موقَّع بـ secret آخر يُعطي TOKEN_INVALID', () => {
      const foreignToken = jwt.sign({ sub: 1 }, 'different-secret');
      const req  = buildReq(`Bearer ${foreignToken}`);
      const next = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_INVALID');
    });

    test('token مُزوَّر (payload معدَّل) يُعطي TOKEN_INVALID', () => {
      const token  = signToken({ sub: 1, roles: ['patient'] });
      const parts  = token.split('.');
      const fakePayload = Buffer.from(
        JSON.stringify({ sub: 1, roles: ['admin'] })
      ).toString('base64url');
      const forged = `${parts[0]}.${fakePayload}.${parts[2]}`;

      const req  = buildReq(`Bearer ${forged}`);
      const next = buildNext();

      authenticate(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('TOKEN_INVALID');
    });
  });

  // ------------------------------------------------------------------
  //  3-E: لا يتم ضبط req.user عند الرفض
  // ------------------------------------------------------------------
  test('req.user لا يُعبَّأ عند رفض token غير صالح', () => {
    const req  = buildReq('Bearer invalid.token.here');
    const next = buildNext();

    authenticate(req, {}, next);

    // next يُستدعى بخطأ (ليس بلا وسيطات = pass)
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
    // req.user يجب أن يبقى غير معرَّف
    expect(req.user).toBeUndefined();
  });
});
