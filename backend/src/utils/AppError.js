'use strict';

// =====================================================================
//  AppError — خطأ تشغيلي يحمل كود HTTP ورمز خطأ موحَّد
//  يُميَّز عن الأخطاء البرمجية غير المتوقعة بخاصية isOperational
// =====================================================================

class AppError extends Error {
  /**
   * @param {string} message   - رسالة الخطأ الموجَّهة للمستخدم
   * @param {number} statusCode - كود HTTP (400, 401, 403, 404, 409...)
   * @param {string} [code]    - رمز خطأ ثابت للعميل مثل 'RESOURCE_NOT_FOUND'
   * @param {Array}  [details] - تفاصيل إضافية (أخطاء حقول التحقق مثلاً)
   */
  constructor(message, statusCode, code = 'APP_ERROR', details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // خطأ متوقع — لا يوجب إعادة تشغيل الخادم

    // تنظيف تتبّع المكدس لتجنّب تسرّب مسارات الملفات للعميل
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
