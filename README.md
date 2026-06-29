# Al-Aalamiya IVF Hospital DBMS — Secure Database Management System with Role-Based Access Control

**English Overview:** Comprehensive hospital management system for Al-Aalamiya IVF Hospital with enterprise-grade security, featuring Role-Based Access Control (RBAC) and Row-Level Security (RLS) at the PostgreSQL layer. Built on Node.js/Express for the backend and vanilla JavaScript for the frontend.

---

# نظام إدارة مستشفى العالمية IVF آمن مع RBAC كامل

نظام متكامل لإدارة مستشفى العالمية IVF (Al-Aalamiya IVF Hospital) يجمع بين مستويات أمان متعددة: RBAC على مستوى التطبيق، و RLS (Row-Level Security) على مستوى قاعدة البيانات، مع نظام تدقيق شامل وإخفاء للبيانات الحسّاسة. المشروع مخصص كمشروع دراسي يوضح أفضل الممارسات في أمان قواعد البيانات والتطبيقات.

---

## نظرة عامة

نظام شامل لإدارة مستشفى العالمية IVF يغطي:

- **إدارة المرضى**: تسجيل، بحث، تتبع السجلات الطبية الشاملة
- **إدارة المواعيد**: حجز المواعيد وإدارة جدول الأطباء
- **السجلات الطبية**: التشخيصات، الوصفات الطبية، العلامات الحيوية
- **المختبر**: طلبات الفحص الطبي وإدارة النتائج
- **الصيدلية**: إدارة الأدوية والوصفات والصرف
- **الفوترة والمدفوعات**: إصدار الفواتير وتتبع الدفعات
- **إدارة الموظفين والأقسام**: تنظيم الهيكل الإداري

---

## المميزات الأمنية البارزة

### 1. RBAC متعدد الطبقات
- **7 أدوار أساسية**: Admin, Doctor, Nurse, Receptionist, Lab Technician, Pharmacist, Patient
- **68 صلاحية دقيقة** بصيغة `resource:action` (مثل: `medical_records:read`, `prescriptions:create`)
- **فصل تام بين الأدوار**: كل دور يملك صلاحيات محددة بدقة

### 2. Row-Level Security (RLS) في PostgreSQL
- **21 سياسة RLS** على 7 جداول حسّاسة (patients, appointments, medical_records, diagnoses, prescriptions, lab_orders, invoices)
- **فرض أمان على مستوى الصفّ**: قاعدة البيانات نفسها تفرض قيود الوصول
- **دفاع متعدد الطبقات**: التطبيق + قاعدة البيانات معاً (لا يكفي اختراق واحد)

### 3. تشفير كلمات المرور
- **bcryptjs بـ 12 جولة** لتجزئة كلمات المرور بشكل آمن
- **عدم تخزين الكلمات الخام**: فقط hashes محفوظة في قاعدة البيانات

### 4. JWT (JSON Web Tokens)
- **توكنات موقّتة** بصلاحية 15 دقيقة
- **تضمين الأدوار والصلاحيات** في التوكن لتجنب استعلامات متكررة
- **التوقيع الرقمي** لمنع التزييف

### 5. تدقيق شامل (Audit Logging)
- **Append-only** — لا يمكن تعديل أو حذف السجلات الأمنية
- **تسجيل جميع العمليات**: INSERT, UPDATE, DELETE على الجداول الحسّاسة
- **معلومات سياق كاملة**: من فعل الفعل، ماذا فعل، متى، من أي عنوان IP

### 6. تقنيع البيانات الحسّاسة (Data Masking)
- **إخفاء الأرقام الحساسة** (national IDs, phone numbers) حسب دور المستخدم
- **مبدأ الحد الأدنى من الامتياز**: كل دور يرى فقط البيانات التي يحتاجها

### 7. دفاع إضافي
- **Helmet**: تعيين رؤوس HTTP الأمنية
- **CORS مقيّد**: فقط من أصول موثوقة
- **Rate Limiting**: حماية من هجمات الإرهاق (100 طلب/دقيقة عام، 10/دقيقة على تسجيل الدخول)
- **قفل الحساب**: بعد 5 محاولات دخول فاشلة

---

## المكدس التقني

| المكون | التقنيات |
|--------|---------|
| **قاعدة البيانات** | PostgreSQL 15+ مع RLS و pgcrypto و Triggers |
| **Backend** | Node.js 18+ + Express 4.19 + bcryptjs + JWT |
| **Frontend** | Vanilla JavaScript (HTML5 + CSS3) — RTL بالعربية |
| **الاختبارات** | Jest 29 + Supertest 7 (46 اختبار) |

---

## بنية المشروع

```
hospital-dbms-rbac/
├── database/                          # ملفات إعداد قاعدة البيانات (ترتيب تنفيذ ضروري)
│   ├── 01_schema.sql                  # المخطط: 22 جدول بدون بيانات
│   ├── 02_rbac_rls.sql                # RBAC + RLS: 7 أدوار، 68 صلاحية، 21 سياسة
│   ├── 03_audit.sql                   # نظام التدقيق: Append-only logging
│   ├── 04_views_masking.sql           # Views + Data Masking حسب الدور
│   └── 05_seed.sql                    # بيانات تجريبية واقعية
│
├── backend/                           # API والمنطق التجاري
│   ├── src/
│   │   ├── server.js                  # نقطة الدخول الرئيسية
│   │   ├── app.js                     # تطبيق Express + Middleware + Routes
│   │   ├── config/
│   │   │   └── db.js                  # PostgreSQL Pool + withUserContext (RLS)
│   │   ├── middleware/
│   │   │   ├── auth.js                # التحقق من JWT + تعبئة req.user
│   │   │   └── rbac.js                # requireRole / requirePermission
│   │   ├── controllers/               # منطق الأعمال لكل مورد (Patients, Doctors, etc.)
│   │   ├── routes/                    # تعريف المسارات مع ترتيب Middleware
│   │   └── utils/
│   │       ├── AppError.js            # فئة الخطأ الموحّدة
│   │       └── asyncHandler.js        # لفافة try/catch للـ Async
│   ├── tests/
│   │   ├── auth.unit.test.js          # اختبارات وحدة المصادقة
│   │   ├── rbac.unit.test.js          # اختبارات وحدة RBAC
│   │   └── integration.README.md      # دليل اختبارات التكامل
│   ├── package.json                   # الحزم والسكربتات
│   └── .env.example                   # قالب متغيرات البيئة
│
├── frontend/                          # واجهة المستخدم
│   ├── index.html                     # صفحة تسجيل الدخول
│   ├── dashboard.html                 # لوحة المعلومات (تختلف حسب الدور)
│   ├── css/
│   │   └── style.css                  # تنسيقات RTL احترافية بالعربية
│   └── js/
│       ├── api.js                     # طبقة اتصال API (Fetch wrapper)
│       ├── auth.js                    # منطق المصادقة والتسجيل
│       └── dashboard.js               # منطق لوحة المعلومات
│
├── docs/                              # ملفات التوثيق
│   ├── ERD.md                         # مخطط الكيانات والعلاقات (Mermaid)
│   ├── RBAC-MATRIX.md                 # مصفوفة الصلاحيات حسب الدور
│   └── SETUP-AND-TESTING.md           # دليل التشغيل والاختبار
│
└── README.md                          # هذا الملف
```

---

## فريق المشروع

| # | اسم العضو | الرقم الجامعي |
|---|-----------|------------|
| 1 | [اسم العضو الأول] | [الرقم الجامعي] |
| 2 | [اسم العضو الثاني] | [الرقم الجامعي] |
| 3 | [اسم العضو الثالث] | [الرقم الجامعي] |
| 4 | [اسم العضو الرابع] | [الرقم الجامعي] |
| 5 | [اسم العضو الخامس] | [الرقم الجامعي] |

**المشرف:** [اسم المشرف]  
**الجامعة/القسم:** [الجامعة - قسم تكنولوجيا المعلومات]

---

## خطوات التشغيل الكاملة

### المتطلبات المسبقة

- PostgreSQL 15 أو أحدث مثبت وقيد التشغيل
- Node.js 18+ و npm 9+
- متصفح حديث (Chrome, Firefox, Safari, Edge)

### 1. إعداد قاعدة البيانات

```bash
# 1-أ: إنشاء قاعدة بيانات جديدة (اختياري إذا كانت موجودة)
createdb hospital_db

# 1-ب: تطبيق الملفات بالترتيب الدقيق
psql -U postgres -d hospital_db -f database/01_schema.sql
psql -U postgres -d hospital_db -f database/02_rbac_rls.sql
psql -U postgres -d hospital_db -f database/03_audit.sql
psql -U postgres -d hospital_db -f database/04_views_masking.sql
psql -U postgres -d hospital_db -f database/05_seed.sql
```

**ملاحظات:**
- استبدل `postgres` باسم المستخدم الفعلي إن اختلف
- تأكد من تنفيذ الملفات **بالترتيب الدقيق** (01 ← 05)
- الملف 05_seed.sql يُضيف 9 موظفين و 8 مرضى و 2 مستخدم مريض تجريبياً

### 2. إعداد Backend

```bash
# 2-أ: الانتقال للمجلد
cd backend

# 2-ب: تثبيت الحزم
npm install

# 2-ج: إنشاء ملف .env (انسخ من .env.example وعدِّل)
cp .env.example .env
# ثم عدِّل قيم DATABASE_URL و JWT_SECRET إن لزم

# 2-د: تشغيل الخادم
npm start                    # وضع الإنتاج (ملزم الخطأ)
# أو
npm run dev                  # وضع التطوير (nodemon + تحميل تلقائي)
```

الخادم سيعمل على `http://localhost:3000`

**اختبار الصحة:**
```bash
curl http://localhost:3000/health
```

### 3. فتح Frontend

```bash
# في متصفح الويب، افتح:
file:///path/to/hospital-dbms-rbac/frontend/index.html

# أو شغّل خادماً بسيطاً (Python / Node)
cd frontend
python3 -m http.server 8000
# ثم زُر: http://localhost:8000
```

---

## بيانات تسجيل الدخول التجريبية

جميع كلمات المرور الموحّدة: **`Passw0rd!`**

### حسابات الموظفين

| اسم المستخدم | البريد الإلكتروني | الدور | ملاحظات |
|-------------|------------------|------|---------|
| `dr.ahmed` | ahmed.azzawi@hospital.iq | طبيب | أمراض باطنية، الباطنية |
| `dr.sara` | sara.jabouri@hospital.iq | طبيب | جراحة عامة، الجراحة |
| `dr.ali` | ali.mousawi@hospital.iq | طبيب | أمراض القلب، الباطنية |
| `nurse.zainab` | zainab.husseini@hospital.iq | ممرّض | جناح الباطنية، صباح |
| `nurse.hassan` | hassan.kanani@hospital.iq | ممرّض | جناح الجراحة، مساء |
| `reception.mariam` | mariam.obeidi@hospital.iq | استقبال | تسجيل المرضى والمواعيد |
| `lab.omar` | omar.dulaimi@hospital.iq | فنّي مختبر | تنفيذ الفحوص |
| `pharma.noor` | noor.zubaidi@hospital.iq | صيدلي | صرف الوصفات |
| `admin.karrar` | karrar.tamimi@hospital.iq | مدير نظام | إدارة كاملة |

### حسابات المرضى

| اسم المستخدم | البريد الإلكتروني | الرقم الطبي |
|-------------|------------------|----------|
| `patient.mohammed` | mohammed.saadi@mail.iq | MRN-000001 |
| `patient.fatima` | fatima.khafaji@mail.iq | MRN-000002 |

---

## الاختبارات

المشروع يتضمن 46 اختبار Jest:

```bash
# تشغيل جميع الاختبارات
cd backend
npm test

# تشغيل اختبار محدد
npm test -- auth.unit.test.js

# تشغيل مع تغطية (coverage)
npm test -- --coverage
```

### أنواع الاختبارات

1. **اختبارات الوحدة** (`*.unit.test.js`):
   - التحقق من صحة المصادقة
   - اختبار RBAC والصلاحيات
   - اختبارات الدوال المساعدة

2. **اختبارات التكامل** (يدوية — في `integration.README.md`):
   - سيناريوهات واقعية (طبيب يسجّل دخول وينشئ سجل)
   - اختبار RLS (مريض يرى سجلّه فقط)
   - اختبار الرفض (receptionist لا يرى السجلات الطبية)

---

## الرخصة والإخلاء

### الرخصة: MIT

هذا المشروع مرخّص تحت MIT License. انظر `LICENSE` للتفاصيل.

### إخلاء المسؤولية

⚠️ **هذا مشروع تعليمي** وليس للاستخدام الإنتاجي المباشر.

**قبل الإنتاج، يجب:**
- تغيير `JWT_SECRET` و كلمات المرور الافتراضية
- تفعيل HTTPS فقط (لا HTTP)
- إعداد نسخ احتياطية دورية
- تطبيق مراقبة وتسجيل شامل
- اختبار أمني احترافي (penetration testing)
- الامتثال للمتطلبات القانونية (بيانات المرضى حساسة)

---

## المراجع والموارد

### ملفات التوثيق الإضافية

- **[ERD.md](docs/ERD.md)**: مخطط Mermaid للجداول والعلاقات (22 جدول)
- **[RBAC-MATRIX.md](docs/RBAC-MATRIX.md)**: مصفوفة كاملة للصلاحيات
- **[SETUP-AND-TESTING.md](docs/SETUP-AND-TESTING.md)**: دليل التشغيل والسيناريوهات اليدوية

### مراجع خارجية

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT.io](https://jwt.io/)

---

## الدعم والمساهمة

للمساهمة في تحسين المشروع:

1. اختبر بعناية قبل فتح PR
2. اتبع أسلوب الكود الموجود
3. أضف اختبارات للميزات الجديدة
4. وثّق التغييرات بوضوح

---

---

## CI/CD والاختبارات التلقائية

المشروع متكامل مع **GitHub Actions** لضمان الجودة والأمان المستمر:

[![Tests Status](https://github.com/yourusername/hospital-dbms-rbac/actions/workflows/tests.yml/badge.svg)](https://github.com/yourusername/hospital-dbms-rbac/actions)

### خط أنابيب CI/CD:
- ✅ اختبارات الوحدة التلقائية (Jest — 46 اختبار)
- ✅ فحص الكود (Lint — ESLint)
- ✅ اختبارات التكامل الحية مع PostgreSQL
- ✅ التحقق من الأمان (npm audit)
- ✅ فحص الأداء والتغطية

تُطبّق على كل push و PR لضمان معايير عالية.

---

**تم إنشاؤه بعناية كمشروع قاعدة بيانات تعليمي شامل لمستشفى العالمية IVF.**  
**آخر تحديث: 30 يونيو 2026**
