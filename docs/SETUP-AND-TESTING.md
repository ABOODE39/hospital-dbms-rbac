# دليل التشغيل والاختبار الشامل لمستشفى العالمية IVF

دليل تفصيلي لإعداد نظام مستشفى العالمية IVF الكامل واختبار جميع الميزات الأمنية يدوياً.

---

## المتطلبات المسبقة

### البرامج المطلوبة

```bash
# تحقق من التثبيت
PostgreSQL --version      # يجب أن يكون 15+
node --version            # يجب أن يكون 18+
npm --version             # يجب أن يكون 9+
```

### الحسابات والإذونات

- حساب PostgreSQL بدون كلمة مرور (trust) أو بكلمة مرور معروفة
- إذن الكتابة في مجلد المشروع
- منفذ 3000 متاح (للـ Backend)
- منفذ 8000 متاح (اختياري — لخادم Frontend)

---

## الخطوة 1: إعداد قاعدة البيانات (30 دقيقة)

### 1.1: إنشاء قاعدة بيانات جديدة

```bash
# الاتصال بـ PostgreSQL
psql -U postgres

# داخل psql، أنشئ قاعدة البيانات
CREATE DATABASE hospital_db;
\q
```

### 1.2: تطبيق الملفات بالترتيب الدقيق

**تحذير مهم**: يجب تطبيق الملفات **بالترتيب الدقيق 01 → 05**. عدم الامتثال سيؤدي إلى أخطاء.

```bash
# انتقل إلى مجلد المشروع
cd C:\Users\microsoft\Desktop\hospital-dbms-rbac

# 1: إنشاء الجداول (22 جدول)
psql -U postgres -d hospital_db -f database/01_schema.sql
# يجب أن تظهر: CREATE EXTENSION, CREATE TABLE (x22), CREATE INDEX (x28+)
# بدون أخطاء

# 2: إضافة RBAC + RLS (7 أدوار، 68 صلاحية، 21 سياسة)
psql -U postgres -d hospital_db -f database/02_rbac_rls.sql
# يجب أن تظهر: INSERT INTO roles, permissions, role_permissions, ...
# بدون أخطاء

# 3: إضافة نظام التدقيق (Audit Logging)
psql -U postgres -d hospital_db -f database/03_audit.sql
# يجب أن تظهر: CREATE OR REPLACE FUNCTION, CREATE TRIGGER (x22+)
# بدون أخطاء

# 4: إضافة Data Masking و Views
psql -U postgres -d hospital_db -f database/04_views_masking.sql
# يجب أن تظهر: CREATE ROLE, CREATE OR REPLACE FUNCTION, CREATE VIEW
# بدون أخطاء

# 5: إضافة بيانات تجريبية (9 موظفين، 8 مرضى، 2 مريض بحساب)
psql -U postgres -d hospital_db -f database/05_seed.sql
# يجب أن تظهر: INSERT INTO roles, permissions, departments, staff, patients, users, ...
# بدون أخطاء
```

### 1.3: التحقق من النجاح

```bash
# الاتصال بقاعدة البيانات والتحقق
psql -U postgres -d hospital_db

# فحص الجداول
\dt
# يجب أن تظهر 22 جدول

# فحص الأدوار
SELECT name FROM roles;
-- النتيجة المتوقعة:
-- admin, doctor, nurse, receptionist, lab_technician, pharmacist, patient

# فحص عدد الموظفين
SELECT COUNT(*) FROM staff;
-- النتيجة المتوقعة: 9

# فحص عدد المرضى
SELECT COUNT(*) FROM patients;
-- النتيجة المتوقعة: 8

# فحص عدد المستخدمين
SELECT COUNT(*) FROM users;
-- النتيجة المتوقعة: 11 (9 موظفين + 2 مريض)

# خروج من psql
\q
```

**النتيجة الناجحة**: قاعدة بيانات جاهزة مع بيانات تجريبية كاملة.

---

## الخطوة 2: إعداد Backend (15 دقيقة)

### 2.1: التثبيت

```bash
# انتقل إلى مجلد Backend
cd C:\Users\microsoft\Desktop\hospital-dbms-rbac\backend

# تثبيت الحزم
npm install
```

### 2.2: إنشاء ملف .env

```bash
# انسخ ملف المثال
cp .env.example .env

# عدِّل الملف .env بالقيم التالية:
```

**محتوى .env الموصى به:**

```env
# قاعدة البيانات
DATABASE_URL=postgresql://postgres@localhost:5432/hospital_db

# المصادقة
JWT_SECRET=your_strong_secret_here_minimum_32_chars
JWT_EXPIRES_IN=15m

# التشفير
BCRYPT_ROUNDS=12

# الخادم
PORT=3000

# CORS
CORS_ORIGIN=http://localhost:8000

# البيئة
NODE_ENV=development
```

**ملاحظات:**
- إذا كنت تستخدم كلمة مرور PostgreSQL، غيّر `postgres@` إلى `postgres:PASSWORD@`
- `JWT_SECRET` يجب أن يكون عشوائياً وقوياً (استخدم `openssl rand -base64 32` لتوليد واحد)

### 2.3: اختبار الاتصال

```bash
# تشغيل خادم Backend
npm start
```

**النتيجة الناجحة:**

```
Server running on http://localhost:3000
Database connected
✓ App initialized
```

**في نافذة متصفح أو curl:**

```bash
# فحص صحة الخادم
curl http://localhost:3000/health

# النتيجة المتوقعة:
# {"status":"ok","timestamp":"2026-06-29T..."}
```

---

## الخطوة 3: فتح Frontend (5 دقائق)

### 3.1: خيار 1 — شغّل خادم Python بسيط (موصى به)

```bash
# في نافذة PowerShell جديدة، انتقل إلى مجلد Frontend
cd C:\Users\microsoft\Desktop\hospital-dbms-rbac\frontend

# شغّل خادم Python
python -m http.server 8000

# في المتصفح، افتح:
http://localhost:8000
```

### 3.2: خيار 2 — افتح الملف مباشرة

```bash
# في المتصفح، افتح:
file:///C:/Users/microsoft/Desktop/hospital-dbms-rbac/frontend/index.html
```

**ملاحظة**: قد لا تعمل الملفات النسبية في الخيار 2، لذا الخيار 1 أفضل.

---

## الخطوة 4: اختبارات يدوية شاملة

### السيناريو 1: تسجيل دخول طبيب ورؤية المرضى

**الهدف**: التحقق من أن الطبيب يرى مرضاه فقط (RLS).

**الخطوات**:

1. **افتح الواجهة**: `http://localhost:8000`

2. **سجّل دخول كطبيب**:
   - اسم المستخدم: `dr.ahmed`
   - كلمة المرور: `Passw0rd!`
   - اضغط "دخول"

3. **النتيجة المتوقعة**:
   - ✅ تسجيل دخول ناجح
   - ✅ إعادة التوجيه إلى لوحة المعلومات
   - ✅ ظهور "مرحباً، أحمد العزاوي"

4. **في لوحة المعلومات**:
   - افتح قسم "المرضى"
   - يجب أن ترى فقط المرضى المرتبطين به (من قاعدة البيانات، عدد محدود)

5. **تحقق من RLS**:
   ```bash
   # في terminal جديد، افتح قاعدة البيانات
   psql -U postgres -d hospital_db
   
   # لاحظ أن الطبيب dr.ahmed يملك أدوار medical_records مع مرضى محددين:
   SELECT COUNT(*) FROM medical_records 
   WHERE doctor_id = (SELECT id FROM doctors WHERE staff_id = 
   (SELECT id FROM staff WHERE email = 'ahmed.azzawi@hospital.iq'));
   -- النتيجة المتوقعة: عدد السجلات التي أنشأها أحمد (يجب أن يكون > 0)
   ```

**النجاح**: الطبيب يرى فقط مرضاه، لا مرضى الأطباء الآخرين.

---

### السيناريو 2: مريض يرى سجلّه الخاص فقط

**الهدف**: التحقق من أن المريض محمي بـ RLS بشكل كامل.

**الخطوات**:

1. **سجّل دخول كمريض**:
   - اسم المستخدم: `patient.mohammed`
   - كلمة المرور: `Passw0rd!`
   - اضغط "دخول"

2. **النتيجة المتوقعة**:
   - ✅ تسجيل دخول ناجح
   - ✅ ظهور لوحة "المريض محمد الساعدي"

3. **في لوحة المعلومات**:
   - انقر على "السجلات الطبية"
   - يجب أن ترى **فقط سجلاته الخاصة** (MRN-000001)
   - لا يجب أن ترى سجلات مرضى آخرين

4. **اختبار RLS في قاعدة البيانات**:
   ```bash
   # افتح قاعدة البيانات
   psql -U postgres -d hospital_db
   
   # حاول محاكاة ما يراه المريض
   SET LOCAL app.current_user_id = (SELECT id FROM users WHERE username = 'patient.mohammed');
   SET LOCAL app.current_role = 'patient';
   
   SELECT COUNT(*) FROM patients;  -- يجب أن يرى 1 فقط (نفسه)
   
   SELECT * FROM medical_records;  -- يجب أن يرى فقط سجلاته
   ```

**النجاح**: المريض محمي بشكل كامل، لا يرى بيانات آخرين.

---

### السيناريو 3: موظف استقبال لا يرى السجلات الطبية (403)

**الهدف**: التحقق من رفض الصلاحيات على مستوى التطبيق.

**الخطوات**:

1. **سجّل دخول كموظف استقبال**:
   - اسم المستخدم: `reception.mariam`
   - كلمة المرور: `Passw0rd!`
   - اضغط "دخول"

2. **النتيجة المتوقعة**:
   - ✅ تسجيل دخول ناجح
   - ✅ ظهور لوحة "مريم العبيدي - استقبال"

3. **في لوحة المعلومات**:
   - ابحث عن قسم "السجلات الطبية"
   - **يجب أن يكون مخفياً أو معطّلاً** (لا توجد صلاحية `medical_records:read`)
   - إذا حاولت الدخول مباشرة عبر URL، يجب أن ترى خطأ 403

4. **اختبار عبر API**:
   ```bash
   # احفظ التوكن من عملية تسجيل الدخول
   # ثم جرّب:
   
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/v1/medical-records
   
   # النتيجة المتوقعة:
   # {
   #   "success": false,
   #   "code": "INSUFFICIENT_PERMISSIONS",
   #   "message": "دون توفر صلاحية medical_records:read"
   # }
   ```

**النجاح**: الاستقبال ممنوعة من الوصول إلى السجلات الطبية.

---

### السيناريو 4: فنّي المختبر ينفّذ فحص

**الهدف**: التحقق من عملية كاملة لفنّي المختبر.

**الخطوات**:

1. **سجّل دخول كفنّي مختبر**:
   - اسم المستخدم: `lab.omar`
   - كلمة المرور: `Passw0rd!`
   - اضغط "دخول"

2. **في لوحة المعلومات**:
   - افتح قسم "طلبات الفحص"
   - يجب أن ترى الطلبات المطلوبة من الأطباء

3. **انقر على طلب**:
   - اضغط "عرض التفاصيل"
   - ستظهر بيانات المريض والفحص المطلوب

4. **أدخل النتيجة**:
   - اضغط "إدخال النتيجة"
   - أدخل قيمة (مثل: "100 mg/dL")
   - اضغط "حفظ"

5. **النتيجة المتوقعة**:
   - ✅ تحديث حالة الطلب من "ordered" إلى "completed"
   - ✅ حفظ النتيجة في قاعدة البيانات

**النجاح**: العملية السريرية الكاملة تعمل.

---

### السيناريو 5: صيدلي يصرف وصفة

**الهدف**: التحقق من عملية صرف الوصفات.

**الخطوات**:

1. **سجّل دخول كصيدلي**:
   - اسم المستخدم: `pharma.noor`
   - كلمة المرور: `Passw0rd!`
   - اضغط "دخول"

2. **في لوحة المعلومات**:
   - افتح قسم "الوصفات"
   - يجب أن ترى الوصفات بحالة "active"

3. **انقر على وصفة**:
   - اضغط "صرف الوصفة"

4. **النتيجة المتوقعة**:
   - ✅ تغيير الحالة من "active" إلى "dispensed"
   - ✅ تحديث سجلّ التدقيق

**النجاح**: الصيدلي يستطيع صرف الوصفات فقط (لا تعديل).

---

### السيناريو 6: قفل الحساب بعد 5 محاولات فاشلة

**الهدف**: التحقق من حماية الحساب من هجمات القوة الغاشمة.

**الخطوات**:

1. **في صفحة تسجيل الدخول**:
   - اسم المستخدم: `dr.ahmed`
   - كلمة المرور: **خاطئة** (مثل: `WrongPassword`)
   - اضغط "دخول"

2. **كرّر 5 مرات**:
   - بعد المحاولة الأولى: ❌ 401 Invalid Credentials
   - بعد المحاولة الثانية: ❌ 401 Invalid Credentials
   - بعد المحاولة الثالثة: ❌ 401 Invalid Credentials
   - بعد المحاولة الرابعة: ❌ 401 Invalid Credentials
   - **بعد المحاولة الخامسة**: 🔒 403 Account Locked

3. **محاولة تسجيل الدخول بكلمة المرور الصحيحة**:
   - اسم المستخدم: `dr.ahmed`
   - كلمة المرور: `Passw0rd!` (صحيحة هذه المرة)
   - النتيجة: 🔒 403 Account Locked (حتى لو كانت صحيحة)

4. **إلغاء القفل** (يتطلب admin):
   - سجّل دخول كـ admin: `admin.karrar`
   - انتقل إلى "إدارة المستخدمين"
   - ابحث عن `dr.ahmed`
   - اضغط "إلغاء القفل"

5. **النتيجة المتوقعة**:
   - ✅ الحساب مقفول بعد 5 محاولات
   - ✅ لا يمكن تسجيل دخول حتى مع كلمة صحيحة
   - ✅ Admin يستطيع إلغاء القفل

**النجاح**: حماية كاملة من هجمات القوة الغاشمة.

---

## الخطوة 5: اختبارات الوحدة (15 دقيقة)

```bash
# في مجلد backend
cd C:\Users\microsoft\Desktop\hospital-dbms-rbac\backend

# تشغيل جميع الاختبارات
npm test

# النتيجة المتوقعة:
# Test Suites: 2 passed, 2 total
# Tests: 46 passed, 46 total
# Snapshots: 0 total
# Time: ~5s
```

### شرح الاختبارات

| اختبار | الملف | الهدف |
|--------|-------|-------|
| **Unit Tests** | `auth.unit.test.js` | اختبار المصادقة والتحقق من JWT |
| **RBAC Tests** | `rbac.unit.test.js` | اختبار الصلاحيات والأدوار |
| **Integration** | `integration.README.md` | سيناريوهات كاملة (يدوية) |

---

## الخطوة 6: اختبارات API متقدمة (30 دقيقة)

### 6.1: استخدام curl أو Postman

**المتطلبات**:
- أداة curl أو تطبيق Postman
- توكن JWT من تسجيل دخول ناجح

#### مثال 1: تسجيل دخول والحصول على توكن

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dr.ahmed",
    "password": "Passw0rd!"
  }'

# النتيجة:
# {
#   "success": true,
#   "data": {
#     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "user": {
#       "id": 1,
#       "username": "dr.ahmed",
#       "roles": ["doctor"],
#       "permissions": ["patients:read", "medical_records:create", ...]
#     }
#   }
# }
```

#### مثال 2: استخدام التوكن لقراءة البيانات

```bash
# احفظ التوكن في متغير
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# اقرأ قائمة المرضى
curl -X GET http://localhost:3000/api/v1/patients \
  -H "Authorization: Bearer $TOKEN"

# النتيجة:
# {
#   "success": true,
#   "data": [
#     {
#       "id": 1,
#       "medical_record_number": "MRN-000001",
#       "first_name": "محمد",
#       "last_name": "الساعدي",
#       ...
#     },
#     ...
#   ]
# }
```

#### مثال 3: اختبار الرفض (بدون صلاحية)

```bash
# تسجيل دخول كـ استقبال
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "reception.mariam",
    "password": "Passw0rd!"
  }' | jq -r '.data.access_token')

# محاولة قراءة السجلات الطبية (لا توجد صلاحية)
curl -X GET http://localhost:3000/api/v1/medical-records \
  -H "Authorization: Bearer $TOKEN"

# النتيجة:
# {
#   "success": false,
#   "code": "INSUFFICIENT_PERMISSIONS",
#   "message": "..."
# }
```

---

## جدول استكشاف الأخطاء

| الخطأ | السبب | الحل |
|-------|-------|------|
| `ECONNREFUSED localhost:5432` | قاعدة البيانات غير متصلة | شغّل PostgreSQL: `pg_ctl start` |
| `Database connection failed` | DATABASE_URL خاطئة | تحقق من .env |
| `JWT_SECRET not set` | متغير البيئة ناقص | أضفه إلى .env |
| `Port 3000 already in use` | منفذ مشغول | غيّر PORT في .env أو أغلق التطبيق |
| `CORS error` | أصل مختلف | تحقق من CORS_ORIGIN في .env |
| `401 Unauthorized` | توكن فاسد أو منتهي الصلاحية | سجّل دخول مجدداً |
| `403 Insufficient Permissions` | صلاحية ناقصة | تحقق من الأدوار المسندة |

---

## قائمة التحقق النهائية

قبل الانتهاء من الاختبار، تحقق من كل ما يلي:

- [ ] ✅ قاعدة البيانات تحتوي على 22 جدول
- [ ] ✅ 7 أدوار مُنشأة بنجاح
- [ ] ✅ 68 صلاحية مُنشأة بنجاح
- [ ] ✅ 9 موظفين و 8 مرضى في قاعدة البيانات
- [ ] ✅ Backend يعمل على المنفذ 3000
- [ ] ✅ Frontend يحمّل بدون أخطاء
- [ ] ✅ تسجيل دخول الطبيب نجح
- [ ] ✅ الطبيب يرى مرضاه فقط (RLS)
- [ ] ✅ المريض يرى سجلّه فقط (RLS)
- [ ] ✅ الاستقبال ممنوعة من السجلات الطبية (403)
- [ ] ✅ فنّي المختبر يستطيع إدخال النتائج
- [ ] ✅ الصيدلي يستطيع صرف الوصفات
- [ ] ✅ قفل الحساب بعد 5 محاولات فاشلة
- [ ] ✅ جميع الاختبارات تمر (46 اختبار)

---

## نصائح إضافية

### للتطوير السريع

```bash
# استخدم nodemon للتطوير (تحميل تلقائي عند التغيير)
npm run dev
```

### لمراقبة قاعدة البيانات

```bash
# شغّل psql في نافذة منفصلة للمراقبة المباشرة
psql -U postgres -d hospital_db

# استعلامات مفيدة:
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;  -- آخر 10 أنشطة
SELECT * FROM users;  -- جميع المستخدمين
SELECT * FROM user_roles;  -- إسناد الأدوار
```

### لتنظيف قاعدة البيانات

```bash
# حذف كل البيانات وإعادة تشغيل الاختبارات
dropdb hospital_db
createdb hospital_db
psql -U postgres -d hospital_db -f database/01_schema.sql
psql -U postgres -d hospital_db -f database/02_rbac_rls.sql
# ... إلخ
```

---

## ملاحظات نهائية

1. **الأمان أولاً**: لا تستخدم كلمات المرور الافتراضية في الإنتاج.
2. **النسخ الاحتياطية**: قم بعمل نسخة احتياطية من قاعدة البيانات بانتظام.
3. **المراقبة**: راقب سجلّ التدقيق (audit_logs) بحثاً عن نشاطات غريبة.
4. **التحديثات**: حدّث الحزم بانتظام (`npm update`).

---

**تم إنشاء هذا الدليل لمستشفى العالمية IVF: 30 يونيو 2026**
