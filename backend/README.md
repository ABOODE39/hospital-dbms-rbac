# Hospital DBMS — Backend API

نظام إدارة مستشفى آمن مع RBAC كامل. مبني على Node.js + Express + PostgreSQL مع RLS على مستوى قاعدة البيانات.

---

## متطلبات التشغيل

- Node.js 18+
- PostgreSQL 15+
- npm 9+

---

## إعداد البيئة (.env)

أنشئ ملف `.env` داخل مجلد `backend/` بالقيم التالية:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/hospital_db
JWT_SECRET=your_strong_secret_here
JWT_EXPIRES_IN=15m
BCRYPT_ROUNDS=12
PORT=3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## خطوات التشغيل

### 1. تهيئة قاعدة البيانات (مرة واحدة بالترتيب)

```bash
psql -U postgres -d hospital_db -f database/01_schema.sql
psql -U postgres -d hospital_db -f database/02_rbac_rls.sql
psql -U postgres -d hospital_db -f database/03_seed_roles.sql
psql -U postgres -d hospital_db -f database/04_seed_permissions.sql
psql -U postgres -d hospital_db -f database/05_seed_data.sql
```

### 2. تثبيت الحزم

```bash
cd backend
npm install
```

### 3. تشغيل الخادم

```bash
npm start          # إنتاج
npm run dev        # تطوير (nodemon)
```

الخادم يعمل على: `http://localhost:3000`
فحص الصحة: `GET /health`

---

## قائمة Endpoints

### المصادقة — /api/v1/auth

| الطريقة | المسار               | الوصف                          | الأدوار  |
|---------|----------------------|-------------------------------|----------|
| POST    | /auth/register       | تسجيل حساب جديد               | عام      |
| POST    | /auth/login          | تسجيل دخول (يُصدر JWT)        | عام      |
| GET     | /auth/me             | بيانات الحساب الحالي           | مصادَق   |

### المرضى — /api/v1/patients

| الطريقة | المسار          | الوصف                | الصلاحية المطلوبة   |
|---------|-----------------|---------------------|---------------------|
| GET     | /patients       | قائمة المرضى         | patients:read       |
| POST    | /patients       | تسجيل مريض جديد     | patients:create     |
| GET     | /patients/:id   | ملف مريض محدد        | patients:read       |
| PATCH   | /patients/:id   | تعديل بيانات مريض   | patients:update     |

### المواعيد — /api/v1/appointments

| الطريقة | المسار               | الوصف                  | الصلاحية المطلوبة      |
|---------|----------------------|-----------------------|------------------------|
| GET     | /appointments        | قائمة المواعيد         | appointments:read      |
| POST    | /appointments        | حجز موعد جديد          | appointments:create    |
| GET     | /appointments/:id    | تفاصيل موعد            | appointments:read      |
| PATCH   | /appointments/:id    | تعديل/إلغاء موعد       | appointments:update    |

### الأقسام — /api/v1/departments

| الطريقة | المسار              | الوصف                        | الصلاحية المطلوبة    |
|---------|---------------------|-----------------------------|-----------------------|
| GET     | /departments        | قائمة الأقسام مع الموظفين   | departments:read      |
| POST    | /departments        | إنشاء قسم (admin)           | departments:create    |
| GET     | /departments/:id    | تفاصيل قسم                  | departments:read      |
| PATCH   | /departments/:id    | تعديل قسم (admin)           | departments:update    |

### السجلات الطبية — /api/v1/medical-records

| الطريقة | المسار                         | الوصف                        | الصلاحية المطلوبة       |
|---------|--------------------------------|-----------------------------|-----------------------------|
| GET     | /medical-records               | قائمة السجلات               | medical_records:read        |
| POST    | /medical-records               | إنشاء سجل طبي (doctor)      | medical_records:create      |
| GET     | /medical-records/:id           | تفاصيل سجل طبي              | medical_records:read        |
| PATCH   | /medical-records/:id           | تعديل ملاحظات/vital_signs   | medical_records:update      |
| GET     | /medical-records/:id/diagnoses | قائمة تشخيصات السجل         | diagnoses:read              |
| POST    | /medical-records/:id/diagnoses | إضافة تشخيص (doctor)        | diagnoses:create            |

### التشخيصات — /api/v1/diagnoses

| الطريقة | المسار           | الوصف               | الصلاحية المطلوبة |
|---------|------------------|--------------------|-------------------|
| GET     | /diagnoses/:id   | تفاصيل تشخيص        | diagnoses:read    |
| PATCH   | /diagnoses/:id   | تعديل تشخيص (doctor)| diagnoses:update  |

### الوصفات الطبية — /api/v1/prescriptions

| الطريقة | المسار                             | الوصف                        | الصلاحية المطلوبة     |
|---------|-------------------------------------|-----------------------------|-----------------------|
| GET     | /prescriptions                      | قائمة الوصفات               | prescriptions:read    |
| POST    | /prescriptions                      | إنشاء وصفة مع بنودها        | prescriptions:create  |
| GET     | /prescriptions/:id                  | تفاصيل وصفة مع البنود       | prescriptions:read    |
| PATCH   | /prescriptions/:id/status           | تغيير الحالة (dispensed/cancelled)| prescriptions:update|
| PATCH   | /prescriptions/:id/items/:itemId    | تعديل بند في الوصفة         | prescriptions:update  |

### المختبر — /api/v1/lab-tests و /api/v1/lab-orders

| الطريقة | المسار                      | الوصف                       | الصلاحية المطلوبة   |
|---------|-----------------------------|-----------------------------|---------------------|
| GET     | /lab-tests                  | كتالوج أنواع الفحوص         | lab_tests:read      |
| POST    | /lab-tests                  | إضافة نوع فحص (admin)       | lab_tests:create    |
| GET     | /lab-tests/:id              | تفاصيل نوع فحص              | lab_tests:read      |
| PATCH   | /lab-tests/:id              | تعديل نوع فحص (admin)       | lab_tests:update    |
| GET     | /lab-orders                 | قائمة طلبات الفحص           | lab_orders:read     |
| POST    | /lab-orders                 | طلب فحص جديد (doctor)       | lab_orders:create   |
| GET     | /lab-orders/:id             | تفاصيل طلب فحص              | lab_orders:read     |
| PATCH   | /lab-orders/:id/result      | إدخال نتيجة (lab_technician)| lab_orders:update   |

### الفوترة — /api/v1/billing

| الطريقة | المسار                                    | الوصف                    | الصلاحية المطلوبة  |
|---------|-------------------------------------------|-------------------------|---------------------|
| GET     | /billing/invoices                         | قائمة الفواتير           | invoices:read       |
| POST    | /billing/invoices                         | إنشاء فاتورة مع البنود   | invoices:create     |
| GET     | /billing/invoices/:id                     | تفاصيل فاتورة            | invoices:read       |
| PATCH   | /billing/invoices/:id                     | تعديل حالة/تاريخ استحقاق | invoices:update     |
| GET     | /billing/invoices/:invoiceId/payments     | سجل الدفعات              | payments:read       |
| POST    | /billing/invoices/:invoiceId/payments     | تسجيل دفعة               | payments:create     |

### إدارة المستخدمين — /api/v1/users (admin فقط)

| الطريقة | المسار                             | الوصف                  | الصلاحية المطلوبة    |
|---------|------------------------------------|------------------------|----------------------|
| GET     | /users                             | قائمة المستخدمين       | users:read           |
| POST    | /users                             | إنشاء حساب             | users:create         |
| GET     | /users/:id                         | تفاصيل مستخدم          | users:read           |
| PATCH   | /users/:id                         | تعديل الحساب           | users:update         |
| POST    | /users/:id/roles                   | تعيين أدوار            | users:manage_roles   |
| DELETE  | /users/:id/roles/:role_id          | سحب دور                | users:manage_roles   |
| GET     | /users/roles/list                  | قائمة الأدوار          | roles:read           |
| GET     | /users/permissions/list            | قائمة الصلاحيات        | permissions:read     |

---

## بنية المشروع

```
backend/
  src/
    app.js                  # Express app — middleware + routes + error handler
    server.js               # نقطة الدخول — graceful shutdown
    config/db.js            # PostgreSQL Pool + withUserContext (تفعيل RLS)
    middleware/
      auth.js               # التحقق من JWT وتعبئة req.user
      rbac.js               # requireRole / requirePermission
    controllers/            # منطق الأعمال لكل مورد
    routes/                 # تعريف المسارات مع ترتيب middleware
    utils/
      AppError.js           # خطأ تشغيلي موحّد
      asyncHandler.js       # لفافة try/catch لمتحكمات async
```

---

## ملاحظات أمنية

- كل الاستعلامات تمر عبر `withUserContext` لتفعيل RLS في PostgreSQL تلقائياً.
- `app.current_user_id` و `app.current_role` تُضبط بـ `SET LOCAL` داخل كل معاملة.
- كلمات المرور مشفّرة بـ bcryptjs (12 جولة افتراضياً).
- JWT يحمل roles + permissions لتفادي استعلام DB في كل طلب.
- Rate limiting: 100 طلب/دقيقة عام، 10 طلبات/دقيقة لـ /auth/login.
- Helmet يضبط رؤوس HTTP الأمنية، CORS مقيّد بـ CORS_ORIGIN.
