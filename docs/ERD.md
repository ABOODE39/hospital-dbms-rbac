# Entity-Relationship Diagram (ERD) — Al-Aalamiya IVF Hospital DBMS

مخطط الكيانات والعلاقات لنظام مستشفى العالمية IVF مع شرح العلاقات والارتباطات.

---

## مخطط Mermaid Interactive

```mermaid
erDiagram
    
    %% ===================== RBAC Tables ======================
    roles ||--o{ role_permissions : contains
    permissions ||--o{ role_permissions : links
    users ||--o{ user_roles : has
    roles ||--o{ user_roles : assigned_to
    
    %% ===================== Staff & Organization ======================
    departments ||--o{ staff : contains
    departments ||--o{ departments : head_by
    staff ||--o{ users : linked_to
    
    %% ===================== Specializations ======================
    staff ||--|| doctors : extends
    staff ||--|| nurses : extends
    
    %% ===================== Patients ======================
    patients ||--o{ users : account_for
    
    %% ===================== Appointments ======================
    patients ||--o{ appointments : schedules
    doctors ||--o{ appointments : available_for
    departments ||--o{ appointments : located_in
    users ||--o{ appointments : creates
    
    %% ===================== Medical Records ======================
    patients ||--o{ medical_records : has
    doctors ||--o{ medical_records : documents
    appointments ||--o{ medical_records : results_in
    
    %% ===================== Diagnoses ======================
    medical_records ||--o{ diagnoses : contains
    
    %% ===================== Medications & Prescriptions ======================
    medical_records ||--o{ prescriptions : associated_with
    patients ||--o{ prescriptions : receives
    doctors ||--o{ prescriptions : issues
    medications ||--o{ prescription_items : included_in
    prescriptions ||--o{ prescription_items : contains
    
    %% ===================== Lab Tests & Orders ======================
    lab_tests ||--o{ lab_orders : ordered_from
    medical_records ||--o{ lab_orders : requests
    patients ||--o{ lab_orders : undergoes
    doctors ||--o{ lab_orders : requests_by
    staff ||--o{ lab_orders : performed_by
    
    %% ===================== Billing & Payments ======================
    patients ||--o{ invoices : billed_to
    appointments ||--o{ invoices : linked_to
    users ||--o{ invoices : created_by
    invoices ||--o{ invoice_items : contains
    invoices ||--o{ payments : receives
    users ||--o{ payments : received_by
    
    %% ===================== Audit Logging ======================
    users ||--o{ audit_logs : performs
    
    %% ===================== Table Definitions ======================
    
    roles {
        bigint id PK
        string name UK
        string description
        timestamp created_at
    }
    
    permissions {
        bigint id PK
        string code UK "resource:action"
        string description
        timestamp created_at
    }
    
    role_permissions {
        bigint role_id FK "roles.id"
        bigint permission_id FK "permissions.id"
        timestamp assigned_at
    }
    
    users {
        bigint id PK
        string username UK
        string email UK
        string password_hash
        bigint staff_id FK "nullable"
        bigint patient_id FK "nullable"
        boolean is_active
        timestamp last_login_at
        integer failed_login_attempts
        timestamp created_at
        timestamp updated_at
    }
    
    user_roles {
        bigint user_id FK "users.id"
        bigint role_id FK "roles.id"
        timestamp assigned_at
    }
    
    departments {
        bigint id PK
        string name UK
        string location
        string phone
        bigint head_staff_id FK "nullable, staff.id"
        timestamp created_at
    }
    
    staff {
        bigint id PK
        string first_name
        string last_name
        string national_id UK
        char gender
        date date_of_birth
        string phone
        string email UK
        string staff_type
        bigint department_id FK "departments.id"
        date hire_date
        boolean is_active
        timestamp created_at
    }
    
    doctors {
        bigint id PK
        bigint staff_id FK UK "staff.id"
        string specialty
        string license_number UK
        smallint years_of_experience
        numeric consultation_fee
        timestamp created_at
    }
    
    nurses {
        bigint id PK
        bigint staff_id FK UK "staff.id"
        string license_number UK
        string shift
        string ward
        timestamp created_at
    }
    
    patients {
        bigint id PK
        string medical_record_number UK "MRN"
        string first_name
        string last_name
        string national_id UK
        char gender
        date date_of_birth
        string blood_type
        string phone
        string email
        text address
        string emergency_contact_name
        string emergency_contact_phone
        timestamp created_at
        timestamp updated_at
    }
    
    appointments {
        bigint id PK
        bigint patient_id FK "patients.id"
        bigint doctor_id FK "doctors.id"
        bigint department_id FK "departments.id"
        timestamp scheduled_at
        smallint duration_minutes
        string status
        string reason
        bigint created_by FK "users.id"
        timestamp created_at
        unique "doctor_id, scheduled_at"
    }
    
    medical_records {
        bigint id PK
        bigint patient_id FK "patients.id"
        bigint doctor_id FK "doctors.id"
        bigint appointment_id FK "appointments.id"
        timestamp visit_date
        text chief_complaint
        text examination_notes
        jsonb vital_signs
        timestamp created_at
    }
    
    diagnoses {
        bigint id PK
        bigint medical_record_id FK "medical_records.id"
        string icd10_code
        text description
        string diagnosis_type
        timestamp diagnosed_at
    }
    
    medications {
        bigint id PK
        string name
        string generic_name
        string form
        string strength
        string manufacturer
        numeric unit_price
        integer stock_quantity
        timestamp created_at
        unique "name, strength, form"
    }
    
    prescriptions {
        bigint id PK
        bigint medical_record_id FK "medical_records.id"
        bigint patient_id FK "patients.id"
        bigint doctor_id FK "doctors.id"
        timestamp issued_at
        string status
        text notes
    }
    
    prescription_items {
        bigint id PK
        bigint prescription_id FK "prescriptions.id"
        bigint medication_id FK "medications.id"
        string dosage
        string frequency
        smallint duration_days
        integer quantity
        text instructions
        unique "prescription_id, medication_id"
    }
    
    lab_tests {
        bigint id PK
        string name UK
        string category
        string reference_range
        string unit
        numeric price
        timestamp created_at
    }
    
    lab_orders {
        bigint id PK
        bigint medical_record_id FK "medical_records.id"
        bigint patient_id FK "patients.id"
        bigint lab_test_id FK "lab_tests.id"
        bigint ordered_by_doctor_id FK "doctors.id"
        bigint performed_by_staff_id FK "staff.id"
        string status
        string result_value
        text result_notes
        timestamp ordered_at
        timestamp resulted_at
    }
    
    invoices {
        bigint id PK
        string invoice_number UK
        bigint patient_id FK "patients.id"
        bigint appointment_id FK "appointments.id"
        numeric total_amount
        string status
        timestamp issued_at
        date due_date
        bigint created_by FK "users.id"
    }
    
    invoice_items {
        bigint id PK
        bigint invoice_id FK "invoices.id"
        string item_type
        string description
        integer quantity
        numeric unit_price
        numeric line_total "generated"
        bigint reference_id
    }
    
    payments {
        bigint id PK
        bigint invoice_id FK "invoices.id"
        numeric amount
        string method
        timestamp paid_at
        bigint received_by FK "users.id"
        string reference_no
    }
    
    audit_logs {
        bigint id PK
        bigint user_id FK "users.id"
        string action
        string entity_type
        bigint entity_id
        jsonb old_values
        jsonb new_values
        inet ip_address
        string user_agent
        timestamp created_at
    }
```

---

## شرح المجموعات والعلاقات

### 1. مجموعة RBAC (الأدوار والصلاحيات)

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **roles** | الأدوار السبعة (admin, doctor, nurse...) | 1:N مع role_permissions |
| **permissions** | صلاحيات دقيقة (resource:action) | 1:N مع role_permissions |
| **role_permissions** | وصل N:M (أي صلاحيات لكل دور) | N:M بين roles و permissions |
| **user_roles** | إسناد أدوار للمستخدمين | N:M بين users و roles |

**الهدف**: فصل تام بين الأدوار والصلاحيات لسهولة الإدارة.

---

### 2. مجموعة المنظمة (الأقسام والموظفون)

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **departments** | الأقسام (الباطنية، الجراحة، المختبر) | 1:N مع staff |
| **staff** | جميع الموظفين (أطباء، ممرّضين، استقبال...) | 1:N مع doctors/nurses |
| **doctors** | بيانات متخصصة للأطباء | 1:1 مع staff |
| **nurses** | بيانات متخصصة للممرّضين | 1:1 مع staff |

**الملاحظة**: تبعية دائرية (departments.head_staff_id ← staff) تُحلّ بـ ALTER TABLE.

---

### 3. مجموعة المرضى والمصادقة

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **patients** | البيانات الديموغرافية للمرضى | 1:N مع medical_records/appointments |
| **users** | حسابات الدخول (موظف أو مريض) | 1:1 مع staff أو patients |

**الفكرة**: فصل هوية الدخول (users) عن البيانات الشخصية (staff/patients).

---

### 4. مجموعة المواعيد

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **appointments** | حجوزات الأطباء | N:1 مع patients/doctors/departments |

**القيود**:
- موعد واحد فقط لطبيب في نفس الوقت (UNIQUE constraint)
- قيم الحالة: scheduled, completed, cancelled, no_show

---

### 5. مجموعة السجلات الطبية

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **medical_records** | السجلات الطبية (الزيارات) | N:1 مع patients/doctors |
| **diagnoses** | التشخيصات | N:1 مع medical_records |

**الأمان**: تُحمَى بـ RLS — لا حذف مباشر (حفظ السجل).

---

### 6. مجموعة الأدوية والوصفات

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **medications** | كتالوج الأدوية | 1:N مع prescription_items |
| **prescriptions** | رأس الوصفة | N:1 مع medical_records/patients/doctors |
| **prescription_items** | بنود الوصفة | N:M بين prescriptions و medications |

**الحالات**: active (جديدة), dispensed (مصروفة), cancelled.

---

### 7. مجموعة المختبر

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **lab_tests** | كتالوج أنواع الفحوص | 1:N مع lab_orders |
| **lab_orders** | طلبات الفحص | N:1 مع medical_records/doctors |

**الحالات**: ordered, in_progress, completed, cancelled.

---

### 8. مجموعة الفوترة

| الجدول | الوصف | العلاقة |
|--------|-------|--------|
| **invoices** | رؤوس الفواتير | 1:N مع invoice_items/payments |
| **invoice_items** | بنود الفاتورة | N:1 مع invoices |
| **payments** | المدفوعات | N:1 مع invoices |

**الملاحظة**: لا حذف مباشر — تُلغى عبر حقل status (سلامة مالية).

---

### 9. مجموعة التدقيق

| الجدول | الوصف | الخصائص |
|--------|-------|---------|
| **audit_logs** | سجل جميع العمليات | Append-only (INSERT فقط) |

**المعلومات**: من فعل الفعل، ماذا فعل، متى، من أي عنوان IP.

---

## إحصائيات المخطط

| المقياس | العدد |
|--------|------|
| **إجمالي الجداول** | 22 |
| **الأدوار** | 7 |
| **الصلاحيات** | 68 |
| **سياسات RLS** | 21 |
| **العلاقات 1:1** | 2 (doctors, nurses) |
| **العلاقات 1:N** | 16 |
| **العلاقات N:M** | 3 (role_permissions, user_roles, prescription_items) |
| **الفهارس** | 28+ |

---

## مبادئ التصميم المتبعة

### 1. التطبيع (Normalization)
- الجداول معيّارة حسب BCNF (Boyce-Codd Normal Form)
- لا تكرار البيانات
- فصل الاهتمامات بوضوح

### 2. سلامة البيانات (Data Integrity)
- قيود تفرضها قاعدة البيانات (FK, UNIQUE, CHECK)
- لا يمكن إضافة بيانات غير صحيحة في المستوى الأساسي

### 3. الأمان (Security)
- RBAC على الأدوار والصلاحيات
- RLS على الجداول الحسّاسة (7 جداول)
- Audit logging على جميع التعديلات

### 4. الأداء (Performance)
- فهارس على المفاتيح الأجنبية والأعمدة كثيرة الاستعلام
- فهارس جزئية للحالات المتكررة (مثل: المواعيد القادمة)
- JSONB للمرونة (vital_signs)

---

## الترجمة بين الإنجليزية والعربية

| الإنجليزية | العربية |
|-----------|---------|
| roles | الأدوار |
| permissions | الصلاحيات |
| users | المستخدمون |
| staff | الموظفون |
| departments | الأقسام |
| doctors | الأطباء |
| nurses | الممرّضون |
| patients | المرضى |
| appointments | المواعيد |
| medical_records | السجلات الطبية |
| diagnoses | التشخيصات |
| medications | الأدوية |
| prescriptions | الوصفات الطبية |
| lab_tests | الفحوص المختبرية |
| lab_orders | طلبات الفحص |
| invoices | الفواتير |
| payments | المدفوعات |
| audit_logs | سجلّ التدقيق |

---

## ملاحظات مهمة

1. **التبعية الدائرية**: departments.head_staff_id يشير إلى staff.id، و staff.department_id يشير إلى departments.id — تُحلّ بـ ALTER TABLE في 01_schema.sql.

2. **JSONB للمرونة**: vital_signs في medical_records تُخزِّن كـ JSONB (مثل: `{"bp":"120/80","pulse":78,"temp":36.8}`) لتجنب نموذج جامد.

3. **Append-only Audit Logs**: لا يمكن تعديل أو حذف سجلات التدقيق — حماية ضد التزييف.

4. **RLS على 7 جداول**: patients, appointments, medical_records, diagnoses, prescriptions, lab_orders, invoices — بقية الجداول عامة للقراءة.

5. **UUID vs BIGSERIAL**: المشروع يستخدم BIGSERIAL (أسرع) بدلاً من UUID.

---

**تم إنشاء هذا الملف لمستشفى العالمية IVF: 30 يونيو 2026**
