'use strict';

// =====================================================================
//  asyncHandler — يلتفّ حول متحكمات async ويُحيل أي خطأ لـ next()
//  يُغني عن try/catch في كل دالة متحكم
// =====================================================================

/**
 * @param {Function} fn - دالة متحكم async (req, res, next) => Promise
 * @returns {Function}  middleware يمرّر الأخطاء لـ Express error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
