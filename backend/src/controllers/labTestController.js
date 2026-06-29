'use strict';

// =====================================================================
//  labTestController — كتالوج أنواع الفحوص المختبرية (lab_tests)
//
//  RLS (02_rbac_rls.sql): lab_tests جدول مرجعي مفتوح للقراءة
//  للأدوار المعنية؛ الكتابة لـ admin فقط.
//
//  الصلاحيات المُستخدمة:
//    lab_tests:read  — lab_technician, doctor, nurse, admin
//    lab_tests:create — admin
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/lab-tests
//  قائمة أنواع الفحوص مع بحث بالاسم/الفئة وpagination
//  الأدوار: lab_technician, doctor, nurse, admin
// =====================================================================
const listLabTests = asyncHandler(async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit    = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset   = (page - 1) * limit;
  const search   = req.query.search   ? `%${req.query.search}%`   : null;
  const category = req.query.category ? `%${req.query.category}%` : null;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // بناء شرط WHERE ديناميكي
    const conditions = [];
    const params     = [];

    if (search) {
      conditions.push(`name ILIKE $${params.push(search)}`);
    }
    if (category) {
      conditions.push(`category ILIKE $${params.push(category)}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    return client.query(
      `SELECT id, name, category, reference_range, unit, price, created_at
         FROM lab_tests
         ${where}
        ORDER BY name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  });

  // إجمالي الصفوف للـ meta
  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];
    if (search)   conditions.push(`name ILIKE $${params.push(`%${req.query.search}%`)}`);
    if (category) conditions.push(`category ILIKE $${params.push(`%${req.query.category}%`)}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return client.query(`SELECT COUNT(*) FROM lab_tests ${where}`, params);
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

// =====================================================================
//  GET /api/v1/lab-tests/:id
//  تفاصيل نوع فحص محدد
//  الأدوار: lab_technician, doctor, nurse, admin
// =====================================================================
const getLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT id, name, category, reference_range, unit, price, created_at
         FROM lab_tests
        WHERE id = $1`,
      [id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('نوع الفحص غير موجود', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/lab-tests
//  إضافة نوع فحص جديد للكتالوج
//  الأدوار: admin فقط
// =====================================================================
const createLabTest = asyncHandler(async (req, res) => {
  const { name, category, reference_range, unit, price } = req.body;

  if (!name) {
    throw new AppError('اسم الفحص مطلوب', 400, 'VALIDATION_ERROR');
  }

  if (price !== undefined && (isNaN(price) || Number(price) < 0)) {
    throw new AppError('السعر يجب أن يكون رقماً موجباً', 400, 'VALIDATION_ERROR');
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `INSERT INTO lab_tests (name, category, reference_range, unit, price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name,
        category        || null,
        reference_range || null,
        unit            || null,
        price           !== undefined ? Number(price) : null,
      ]
    );
  });

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/lab-tests/:id
//  تعديل بيانات نوع فحص (اسم، فئة، سعر...)
//  الأدوار: admin فقط
// =====================================================================
const updateLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowed = ['name', 'category', 'reference_range', 'unit', 'price'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  if (updates.price !== undefined && (isNaN(updates.price) || Number(updates.price) < 0)) {
    throw new AppError('السعر يجب أن يكون رقماً موجباً', 400, 'VALIDATION_ERROR');
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `UPDATE lab_tests
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('نوع الفحص غير موجود', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { listLabTests, getLabTest, createLabTest, updateLabTest };
