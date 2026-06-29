'use strict';

// =====================================================================
//  Express Application — إعداد الـ middleware والمسارات ومعالج الأخطاء
// =====================================================================

require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');

const AppError    = require('./utils/AppError');
const authRoutes            = require('./routes/authRoutes');
const patientRoutes         = require('./routes/patientRoutes');
const appointmentRoutes     = require('./routes/appointmentRoutes');
const departmentRoutes      = require('./routes/departmentRoutes');
const medicalRecordRoutes   = require('./routes/medicalRecordRoutes');
const diagnosisRoutes       = require('./routes/diagnosisRoutes');
const prescriptionRoutes    = require('./routes/prescriptionRoutes');
const labRoutes             = require('./routes/labRoutes');
const billingRoutes         = require('./routes/billingRoutes');
const userRoutes            = require('./routes/userRoutes');

const app = express();

// =====================================================================
//  طبقة الأمان — Helmet يضبط رؤوس HTTP الأمنية
// =====================================================================
app.use(helmet());

// =====================================================================
//  CORS — في الإنتاج حدِّد الـ origin الفعلي بدل '*'
// =====================================================================
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// =====================================================================
//  تحليل JSON
// =====================================================================
app.use(express.json({ limit: '10kb' }));

// =====================================================================
//  Rate Limiting
//  100 طلب/دقيقة للـ API العام
//  10 طلبات/دقيقة لـ login (منع brute-force)
// =====================================================================
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'تجاوزت الحد المسموح به من الطلبات' } },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'محاولات دخول كثيرة — انتظر دقيقة' } },
});

app.use('/api', generalLimiter);
app.use('/api/v1/auth/login', loginLimiter);

// =====================================================================
//  المسارات
// =====================================================================
app.use('/api/v1/auth',            authRoutes);
app.use('/api/v1/patients',        patientRoutes);
app.use('/api/v1/appointments',    appointmentRoutes);
app.use('/api/v1/departments',     departmentRoutes);
app.use('/api/v1/medical-records', medicalRecordRoutes);
app.use('/api/v1/diagnoses',       diagnosisRoutes);
app.use('/api/v1/prescriptions',   prescriptionRoutes);

// ─── المجموعات الجديدة ────────────────────────────────────────────────
// labRoutes يُسجِّل /lab-tests/* و /lab-orders/* تحت /api/v1/
app.use('/api/v1',                 labRoutes);
// billingRoutes تحت /api/v1/billing/invoices/*
app.use('/api/v1/billing',         billingRoutes);
// إدارة المستخدمين (admin فقط) — يشمل /users/* و /roles/list و /permissions/list
app.use('/api/v1/users',           userRoutes);

// =====================================================================
//  مسار الصحة
// =====================================================================
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =====================================================================
//  404 — أي مسار غير معرَّف
// =====================================================================
app.use((req, _res, next) => {
  next(new AppError(`المسار ${req.originalUrl} غير موجود`, 404, 'ROUTE_NOT_FOUND'));
});

// =====================================================================
//  معالج الأخطاء المركزي
//  يُميِّز بين AppError (تشغيلي) وError (برمجي غير متوقع)
// =====================================================================
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // خطأ تكرار قاعدة البيانات (unique violation)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_ENTRY', message: 'قيمة مكرّرة — السجل موجود مسبقاً' },
    });
  }

  // خطأ check constraint في PostgreSQL
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      error: { code: 'CONSTRAINT_VIOLATION', message: 'قيمة غير مقبولة من قاعدة البيانات', details: err.detail },
    });
  }

  // أخطاء تشغيلية متوقعة (AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // أخطاء غير متوقعة — لا نكشف التفاصيل للعميل
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'حدث خطأ داخلي في الخادم' },
  });
});

module.exports = app;
