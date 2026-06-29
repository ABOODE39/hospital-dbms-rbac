'use strict';

// =====================================================================
//  نقطة الدخول — يُشغِّل Express على المنفذ المحدَّد في .env
// =====================================================================

require('dotenv').config();
const app  = require('./app');
const { pool } = require('./config/db');

const PORT = parseInt(process.env.PORT, 10) || 3000;

const server = app.listen(PORT, () => {
  console.log(`[Server] يعمل على المنفذ ${PORT} — البيئة: ${process.env.NODE_ENV || 'development'}`);
});

// =====================================================================
//  إغلاق أنيق (Graceful Shutdown)
//  عند SIGTERM/SIGINT: أوقف قبول الطلبات ثم أغلق الـ Pool
// =====================================================================
async function gracefulShutdown(signal) {
  console.log(`\n[Server] استُقبِل ${signal} — جارٍ الإغلاق الأنيق...`);
  server.close(async () => {
    await pool.end();
    console.log('[Server] تم إغلاق قاعدة البيانات والخادم.');
    process.exit(0);
  });

  // فرض الإغلاق بعد 10 ثوانٍ إن لم تنته الطلبات
  setTimeout(() => {
    console.error('[Server] انتهت مهلة الإغلاق — إنهاء قسري');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// اصطياد الأخطاء غير المعالَجة لمنع انهيار صامت
process.on('unhandledRejection', (reason) => {
  console.error('[Server] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] uncaughtException:', err);
  process.exit(1);
});

module.exports = server; // للاختبارات
