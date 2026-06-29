# RBAC Permission Matrix — مصفوفة الصلاحيات حسب الدور لمستشفى العالمية IVF

جدول شامل يوضح الصلاحيات التفصيلية لكل دور في نظام مستشفى العالمية IVF، مع شرح منطق كل دور وحالات الاستخدام.

---

## مصفوفة الصلاحيات (7 أدوار × 7 موارد رئيسية)

| الموارد | Admin | Doctor | Nurse | Receptionist | Lab Tech | Pharmacist | Patient |
|--------|-------|--------|-------|-------------|----------|-----------|---------|
| **المرضى** | ✅ CRUD | ✅ R | ✅ R | ✅ CRUD | ✅ R | ✅ R | ✅ R* |
| **المواعيد** | ✅ CRUD | ✅ RU** | ✅ RU | ✅ CRUD | ❌ — | ❌ — | ✅ RC* |
| **السجلات الطبية** | ✅ CRUD | ✅ CRUD | ✅ RU | ❌ — | ❌ — | ❌ — | ✅ R* |
| **التشخيصات** | ✅ CRUD | ✅ CRUD | ✅ R | ❌ — | ❌ — | ❌ — | ✅ R* |
| **الوصفات** | ✅ CRUD | ✅ CRUD | ✅ R | ❌ — | ❌ — | ✅ RD*** | ✅ R* |
| **المختبر** | ✅ CRUD | ✅ CR | ✅ R | ❌ — | ✅ RU | ❌ — | ✅ R* |
| **الفوترة** | ✅ CRUD | ❌ — | ❌ — | ✅ CRUD | ❌ — | ❌ — | ✅ R* |

**الرموز:**
- ✅ = صلاحية مسندة
- ❌ = بدون صلاحية
- **C** = Create (إنشاء)
- **R** = Read (قراءة)
- **U** = Update (تعديل)
- **D** = Delete (حذف)
- **\*** = مع RLS (يرى سجلّه/سجلات مرضاه فقط)
- **\*\*** = تحديث محدود (مثل: تغيير حالة الموعد)
- **\*\*\*** = صرف فقط (تغيير حالة من active إلى dispensed)

---

## الصلاحيات المفصّلة بصيغة `resource:action` (68 صلاحية)

### أولاً: جداول RBAC (محتكرة للـ Admin)

```
✅ Admin:
  - roles:read           (قراءة الأدوار)
  - roles:create         (إنشاء دور جديد)
  - roles:update         (تعديل خصائص الدور)
  - roles:delete         (حذف دور)
  
  - permissions:read     (قراءة الصلاحيات)
  - permissions:create   (إضافة صلاحية)
  - permissions:update   (تعديل صلاحية)
  - permissions:delete   (حذف صلاحية)
  
  - role_permissions:read    (قراءة الروابط)
  - role_permissions:create  (ربط صلاحية بدور)
  - role_permissions:delete  (فكّ الربط)
  
  - users:read           (قراءة المستخدمين)
  - users:create         (إنشاء حساب)
  - users:update         (تعديل بيانات)
  - users:delete         (حذف حساب)
  
  - user_roles:read      (قراءة إسناد الأدوار)
  - user_roles:create    (إسناد دور)
  - user_roles:delete    (سحب دور)
```

### ثانياً: الأقسام والموظفون

```
✅ Admin:
  - departments:read     (قراءة الأقسام)
  - departments:create   (إنشاء قسم)
  - departments:update   (تعديل قسم)
  - departments:delete   (حذف قسم)
  
  - staff:read           (قراءة الموظفين)
  - staff:create         (تعيين موظف)
  - staff:update         (تعديل بيانات)
  - staff:delete         (فصل موظف)
  
  - doctors:read         (قراءة بيانات الأطباء)
  - doctors:create       (إضافة طبيب)
  - doctors:update       (تعديل متخصص)
  
  - nurses:read          (قراءة بيانات الممرّضين)
  - nurses:create        (إضافة ممرّض)
  - nurses:update        (تعديل بيانات)

✅ Doctor:
  - departments:read     (قراءة الأقسام)
  - staff:read           (قراءة الموظفين)
  - doctors:read         (قراءة بيانات الأطباء)
  - doctors:update       (تحديث بيانات نفسه)
  - nurses:read          (قراءة الممرّضين)

✅ Nurse:
  - departments:read     (قراءة الأقسام)
  - staff:read           (قراءة الموظفين)
  - doctors:read         (قراءة الأطباء)
  - nurses:read          (قراءة الممرّضين)
  - nurses:update        (تحديث بيانات نفسها)

✅ Receptionist:
  - departments:read     (قراءة الأقسام)
  - staff:read           (قراءة الموظفين)
  - doctors:read         (قراءة الأطباء)
```

### ثالثاً: المرضى

```
✅ Admin:
  - patients:read        (قراءة جميع المرضى)
  - patients:create      (تسجيل مريض)
  - patients:update      (تعديل البيانات)
  - patients:delete      (حذف مريض)

✅ Doctor:
  - patients:read        (قراءة مرضاه فقط — RLS)

✅ Nurse:
  - patients:read        (قراءة مرضى النطاق — RLS)

✅ Receptionist:
  - patients:read        (قراءة جميع المرضى)
  - patients:create      (تسجيل مريض جديد)
  - patients:update      (تعديل البيانات)

✅ Lab Tech:
  - patients:read        (قراءة المريض المطلوب له فحص)

✅ Pharmacist:
  - patients:read        (قراءة المريض)

✅ Patient:
  - patients:read        (قراءة ملفه الخاص فقط — RLS)
  - patients:update      (تحديث بيانات نفسه)
```

### رابعاً: المواعيد

```
✅ Admin:
  - appointments:read    (قراءة جميع المواعيد)
  - appointments:create  (حجز موعد)
  - appointments:update  (تعديل/إلغاء)
  - appointments:delete  (حذف)

✅ Doctor:
  - appointments:read    (قراءة مواعيده — RLS)
  - appointments:update  (تغيير حالة الموعد)

✅ Nurse:
  - appointments:read    (قراءة مواعيد النطاق)
  - appointments:update  (تحديث حالة الموعد)

✅ Receptionist:
  - appointments:read    (قراءة جميع المواعيد)
  - appointments:create  (حجز موعد لمريض)
  - appointments:update  (تعديل/إلغاء)

✅ Patient:
  - appointments:read    (قراءة مواعيده فقط — RLS)
  - appointments:create  (حجز موعد لنفسه)
  - appointments:update  (إلغاء موعده فقط)
```

### خامساً: السجلات الطبية

```
✅ Admin:
  - medical_records:read    (قراءة جميع السجلات)
  - medical_records:create  (إنشاء سجل)
  - medical_records:update  (تعديل)
  - medical_records:delete  (حذف — غير موصّى به)

✅ Doctor:
  - medical_records:read    (قراءة سجلات مرضاه — RLS)
  - medical_records:create  (إنشاء سجل جديد)
  - medical_records:update  (تعديل الملاحظات)

✅ Nurse:
  - medical_records:read    (قراءة سجلات النطاق — RLS)
  - medical_records:update  (تحديث العلامات الحيوية)

✅ Patient:
  - medical_records:read    (قراءة سجلّه الخاص — RLS)
```

### سادساً: التشخيصات

```
✅ Admin:
  - diagnoses:read      (قراءة جميع التشخيصات)
  - diagnoses:create    (إضافة تشخيص)
  - diagnoses:update    (تعديل تشخيص)
  - diagnoses:delete    (حذف تشخيص)

✅ Doctor:
  - diagnoses:read      (قراءة تشخيصات مرضاه — RLS)
  - diagnoses:create    (إضافة تشخيص جديد)
  - diagnoses:update    (تعديل التشخيص)

✅ Nurse:
  - diagnoses:read      (قراءة التشخيصات — RLS)

✅ Patient:
  - diagnoses:read      (قراءة تشخيصاته — RLS)
```

### سابعاً: الأدوية والوصفات

```
✅ Admin:
  - medications:read        (قراءة الكتالوج)
  - medications:create      (إضافة دواء)
  - medications:update      (تعديل السعر/المخزون)
  
  - prescriptions:read      (قراءة الوصفات)
  - prescriptions:create    (إنشاء وصفة)
  - prescriptions:update    (تعديل وصفة)
  - prescriptions:dispense  (صرف وصفة)
  
  - prescription_items:read    (قراءة البنود)
  - prescription_items:create  (إضافة بند)
  - prescription_items:update  (تعديل بند)

✅ Doctor:
  - medications:read        (قراءة الكتالوج)
  - prescriptions:read      (قراءة وصفاته)
  - prescriptions:create    (إنشاء وصفة)
  - prescriptions:update    (تعديل وصفة)
  - prescription_items:read    (قراءة البنود)
  - prescription_items:create  (إضافة بند)
  - prescription_items:update  (تعديل بند)

✅ Nurse:
  - medications:read        (قراءة الكتالوج)
  - prescriptions:read      (قراءة الوصفات)
  - prescription_items:read (قراءة البنود)

✅ Pharmacist:
  - medications:read        (قراءة الكتالوج)
  - medications:create      (إضافة دواء)
  - medications:update      (تحديث المخزون)
  
  - prescriptions:read      (قراءة الوصفات النشطة)
  - prescriptions:dispense  (صرف وصفة — تغيير الحالة)
  
  - prescription_items:read (قراءة البنود)

✅ Patient:
  - prescriptions:read      (قراءة وصفاته — RLS)
  - prescription_items:read (قراءة بنود وصفاته — RLS)
```

### ثامناً: المختبر

```
✅ Admin:
  - lab_tests:read      (قراءة الكتالوج)
  - lab_tests:create    (إضافة نوع فحص)
  - lab_tests:update    (تعديل نوع فحص)
  
  - lab_orders:read     (قراءة جميع الطلبات)
  - lab_orders:create   (طلب فحص)
  - lab_orders:update   (تحديث النتيجة)

✅ Doctor:
  - lab_tests:read      (قراءة الكتالوج)
  - lab_orders:read     (قراءة طلباته)
  - lab_orders:create   (طلب فحص جديد)

✅ Nurse:
  - lab_tests:read      (قراءة الكتالوج)
  - lab_orders:read     (قراءة الطلبات)

✅ Lab Technician:
  - lab_tests:read      (قراءة الكتالوج)
  - lab_orders:read     (قراءة الطلبات المطلوبة)
  - lab_orders:update   (إدخال النتيجة)

✅ Patient:
  - lab_orders:read     (قراءة نتائجه — RLS)
```

### تاسعاً: الفوترة والمدفوعات

```
✅ Admin:
  - invoices:read       (قراءة جميع الفواتير)
  - invoices:create     (إنشاء فاتورة)
  - invoices:update     (تعديل الحالة)
  
  - invoice_items:read  (قراءة البنود)
  - invoice_items:create (إضافة بند)
  - invoice_items:update (تعديل بند)
  
  - payments:read       (قراءة المدفوعات)
  - payments:create     (تسجيل دفعة)

✅ Receptionist:
  - invoices:read       (قراءة الفواتير)
  - invoices:create     (إصدار فاتورة)
  - invoices:update     (تعديل الحالة)
  
  - invoice_items:read  (قراءة البنود)
  - invoice_items:create (إضافة بند)
  - invoice_items:update (تعديل بند)
  
  - payments:read       (قراءة المدفوعات)
  - payments:create     (تسجيل دفعة)

✅ Patient:
  - invoices:read       (قراءة فواتيره — RLS)
  - invoice_items:read  (قراءة البنود)
  - payments:read       (قراءة المدفوعات)
```

### عاشراً: التدقيق

```
✅ Admin:
  - audit_logs:read     (قراءة سجلّ التدقيق الكامل)
```

---

## شرح منطق كل دور

### 1. Admin (مدير النظام)
**الهدف**: إدارة كاملة للنظام.

**المسؤوليات**:
- إدارة الأدوار والصلاحيات والمستخدمين
- إدارة الأقسام والموظفين
- مراقبة جميع الأنشطة عبر سجلّ التدقيق
- الوصول إلى جميع البيانات (بدون قيود RLS)

**الصلاحيات**: جميع الصلاحيات الـ 68 ✅

---

### 2. Doctor (الطبيب)
**الهدف**: إدارة المرضى والعمليات السريرية.

**المسؤوليات**:
- إنشاء وتحديث السجلات الطبية لمرضاه
- إضافة التشخيصات والوصفات
- طلب الفحوصات المختبرية
- عرض نتائج الفحوصات
- عرض المواعيد وتحديث حالتها

**القيود (RLS)**:
- يرى **مرضاه فقط** (المرتبطون به عبر سجلات طبية أو مواعيد)
- لا يرى مرضى الأطباء الآخرين
- لا يستطيع تعديل مرضى آخرين

**الصلاحيات**: ~25 صلاحية

---

### 3. Nurse (الممرّض)
**الهدف**: دعم رعاية المرضى في النطاق.

**المسؤوليات**:
- قراءة السجلات الطبية للمرضى في النطاق
- تحديث العلامات الحيوية (vital signs)
- تحديث حالة المواعيد
- قراءة الوصفات والأدوية

**القيود (RLS)**:
- يرى مرضى **نطاقه فقط** (القسم الذي يعمل به)

**الصلاحيات**: ~15 صلاحية

---

### 4. Receptionist (موظف الاستقبال)
**الهدف**: تسجيل المرضى وإدارة المواعيد والفوترة.

**المسؤوليات**:
- تسجيل مرضى جدد
- حجز وإدارة المواعيد
- إصدار الفواتير وتسجيل المدفوعات
- تحديث بيانات المرضى

**الصلاحيات**: ~20 صلاحية

---

### 5. Lab Technician (فنّي المختبر)
**الهدف**: تنفيذ الفحوصات المختبرية.

**المسؤوليات**:
- عرض طلبات الفحوصات المطلوبة
- إدخال نتائج الفحوصات
- تحديث حالة الطلب

**الصلاحيات**: ~5 صلاحيات

---

### 6. Pharmacist (الصيدلي)
**الهدف**: إدارة الأدوية والوصفات.

**المسؤوليات**:
- عرض الوصفات الطبية
- صرف الوصفات (تغيير الحالة من active إلى dispensed)
- إدارة مخزون الأدوية
- تحديث الأسعار والكميات

**الصلاحيات**: ~8 صلاحيات

---

### 7. Patient (المريض)
**الهدف**: الوصول إلى بيانات صحته الشخصية.

**المسؤوليات**:
- عرض سجلّه الطبي الخاص
- حجز المواعيد وإلغاؤها
- عرض الوصفات والفواتير
- عرض نتائج الفحوصات

**القيود الصارمة (RLS)**:
- يرى **سجلّه الخاص فقط**
- لا يرى بيانات المرضى الآخرين
- لا يستطيع حذف أو تعديل الماضي

**الصلاحيات**: ~10 صلاحيات

---

## جدول المقارنة السريعة

| المقياس | Admin | Doctor | Nurse | Receptionist | Lab Tech | Pharmacist | Patient |
|--------|-------|--------|-------|-------------|----------|-----------|---------|
| عدد الصلاحيات | 68 | 25 | 15 | 20 | 5 | 8 | 10 |
| وصول كامل | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| محدود بـ RLS | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| إدارة موظفين | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| إنشاء سجلات طبية | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| صرف وصفات | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## مثال عملي: سيناريو يوم واحد

### الصباح (morning)

**1. Receptionist يسجّل مريضاً جديداً**
```
Action: POST /patients
Permission: patients:create
Status: ✅ Allowed
```

**2. Receptionist يحجز موعد**
```
Action: POST /appointments
Permission: appointments:create
Status: ✅ Allowed
```

**3. Patient يرى موعده (RLS)**
```
Action: GET /appointments?patient_id=5
Permission: appointments:read
Status: ✅ Allowed (موعده فقط)
```

### الظهيرة (midday)

**4. Doctor يسجّل السجلّ الطبي**
```
Action: POST /medical_records
Permission: medical_records:create
Status: ✅ Allowed (لمرضاه فقط)
```

**5. Doctor يطلب فحص**
```
Action: POST /lab_orders
Permission: lab_orders:create
Status: ✅ Allowed
```

**6. Nurse تحدّث العلامات الحيوية**
```
Action: PATCH /medical_records/:id
Permission: medical_records:update
Status: ✅ Allowed (نطاقها فقط)
```

### العصر (evening)

**7. Lab Tech ينفّذ الفحص**
```
Action: PATCH /lab_orders/:id/result
Permission: lab_orders:update
Status: ✅ Allowed
```

**8. Doctor يضيف تشخيص**
```
Action: POST /diagnoses
Permission: diagnoses:create
Status: ✅ Allowed
```

**9. Doctor ينشئ وصفة**
```
Action: POST /prescriptions
Permission: prescriptions:create
Status: ✅ Allowed
```

### المساء (late evening)

**10. Pharmacist يصرف الوصفة**
```
Action: PATCH /prescriptions/:id/dispense
Permission: prescriptions:dispense
Status: ✅ Allowed
```

**11. Receptionist تُصدر فاتورة**
```
Action: POST /invoices
Permission: invoices:create
Status: ✅ Allowed
```

**12. Receptionist تسجّل دفعة**
```
Action: POST /payments
Permission: payments:create
Status: ✅ Allowed
```

**13. Patient يرى سجلّه (RLS)**
```
Action: GET /medical_records?patient_id=5
Permission: medical_records:read
Status: ✅ Allowed (سجلّه فقط)
```

**14. Nurse تحاول رؤية الفاتورة**
```
Action: GET /invoices
Permission: invoices:read
Status: ❌ Denied (لا توجد صلاحية)
Error: 403 INSUFFICIENT_PERMISSIONS
```

---

## استراتيجية الأمان المتعددة الطبقات

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Application RBAC                               │
│ - Check permission code (resource:action)               │
│ - Validate role in JWT token                            │
│ - Return 403 if insufficient                            │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Database RLS (PostgreSQL)                      │
│ - SET LOCAL app.current_user_id & role                  │
│ - RLS policies filter rows automatically                │
│ - Even if app layer bypassed, DB protects              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Audit Logging                                  │
│ - Record all actions (who, what, when, where)           │
│ - Append-only (cannot modify/delete logs)               │
│ - Detect intrusions & data breaches                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Data Masking                                   │
│ - Hide sensitive columns (national_id, phone)           │
│ - Mask based on role                                    │
│ - Show "*****1234" instead of full number              │
└─────────────────────────────────────────────────────────┘
```

---

## ملاحظات ختامية

1. **مبدأ أقل امتياز (Least Privilege)**: كل دور يملك فقط الصلاحيات التي يحتاجها.

2. **RLS + RBAC معاً**: التطبيق + قاعدة البيانات يعملان معاً لحماية البيانات.

3. **Audit Trail كامل**: لا يمكن تجاهل الإجراءات أو تزييف السجلات.

4. **بيانات المريض آمنة**: مريض لا يرى بيانات مريض آخر حتى لو اخترق التطبيق.

5. **مرونة الإدارة**: يمكن إضافة أدوار جديدة أو تعديل الصلاحيات دون تغيير الكود.

---

**تم إنشاء هذه المصفوفة لمستشفى العالمية IVF: 30 يونيو 2026**
