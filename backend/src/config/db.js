'use strict';

// =====================================================================
//  إعداد اتصال قاعدة البيانات — PostgreSQL Pool
//  الأهم: دالة withUserContext تضبط GUC المطلوبة لـ RLS قبل كل استعلام
// =====================================================================

require('dotenv').config();
const { Pool } = require('pg');

// Pool يُعيد استخدام الاتصالات (20 اتصالاً افتراضياً)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // في الإنتاج: أضف ssl: { rejectUnauthorized: true }
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// إشعار عند اتصال ناجح (مرّة واحدة فقط عند أول طلب)
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[DB] اتصال جديد بـ PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[DB] خطأ غير متوقع في Pool:', err.message);
});

/**
 * withUserContext — جوهر تفعيل RLS لكل طلب.
 *
 * تأخذ client من الـ Pool، تفتح معاملة (BEGIN)،
 * تضبط GUC داخل المعاملة فقط عبر set_config(..., true)
 * (الوسيط الثالث true = is_local، يكافئ SET LOCAL وينتهي أثره عند COMMIT/ROLLBACK):
 *   app.current_user_id  → users.id من JWT
 *   app.current_role     → أسماء الأدوار مفصولة بفاصلة (مثال: 'doctor,nurse')
 *   app.client_ip        → عنوان IP الطالب (اختياري — للتدقيق الأمني)
 *
 * ملاحظة: SET LOCAL لا يقبل معاملات ربط ($1) في PostgreSQL إطلاقاً؛
 * set_config() هو الحل الصحيح لضبط GUC بقيم ديناميكية.
 *
 * @param {string|number} userId    - معرّف المستخدم (users.id)
 * @param {string[]}      roles     - مصفوفة أسماء الأدوار من JWT
 * @param {Function}      fn        - async (client) => { ...استعلامات... }
 * @param {string}        [clientIp] - عنوان IP العميل (اختياري)
 * @returns {Promise<*>}  ما تُعيده fn
 */
async function withUserContext(userId, roles, fn, clientIp) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ضبط سياق المستخدم — تقرأه دوال app_current_user_id() و app_has_role()
    // set_config(setting, value, is_local=true) → يعادل SET LOCAL ويقبل معاملات ربط
    const rolesStr = Array.isArray(roles) ? roles.join(',') : String(roles ?? '');

    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId ?? '')]
    );
    await client.query(
      "SELECT set_config('app.current_role', $1, true)",
      [rolesStr]
    );

    // ضبط IP العميل إن مُرّر — يُستخدم في سجلات التدقيق على مستوى DB
    await client.query(
      "SELECT set_config('app.client_ip', $1, true)",
      [clientIp ? String(clientIp) : '']
    );

    const result = await fn(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * query — استعلام عادي بلا سياق مستخدم (للاستعلامات العامة مثل login)
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query, withUserContext };
