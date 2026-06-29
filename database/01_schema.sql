-- =====================================================================
--  نظام قاعدة بيانات مستشفى آمن مع RBAC
--  الملف: 01_schema.sql  — مخطّط قاعدة البيانات (DDL)
--  المنصّة: PostgreSQL
--
--  ترتيب الجداول مرتّب حسب التبعية (الجدول الأب قبل الابن).
--  ملاحظة على التبعية الدائرية staff <-> departments:
--    نُنشئ الجدولين أولاً ثم نضيف FK لـ departments.head_staff_id
--    عبر ALTER TABLE بعد إنشاء staff (انظر نهاية قسم الموظفين).
-- =====================================================================

-- توليد UUID/التشفير (مطلوب لتجزئة كلمات المرور gen_salt/crypt إن لزم)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =====================================================================
--  (1) جداول RBAC الأساسية: الأدوار والصلاحيات وجدول الوصل بينها
-- =====================================================================

-- جدول الأدوار: admin, doctor, nurse, receptionist, lab_technician, pharmacist, patient
CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,   -- مثل: 'doctor','nurse','admin'
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- جدول الصلاحيات الدقيقة بصيغة 'resource:action' مثل 'medical_records:read'
CREATE TABLE permissions (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(100) NOT NULL UNIQUE,  -- 'resource:action'
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- جدول وصل N:M بين الأدوار والصلاحيات (أي صلاحيات يملكها كل دور)
CREATE TABLE role_permissions (
    role_id       BIGINT NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);


-- =====================================================================
--  (2) الأقسام والموظفون والتخصصات الطبية
--      نُنشئ departments بلا FK لـ head_staff_id الآن (يُضاف لاحقاً)
-- =====================================================================

-- أقسام المستشفى (الباطنية، الطوارئ، المختبر...)
CREATE TABLE departments (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    location      VARCHAR(150),
    phone         VARCHAR(30),
    head_staff_id BIGINT,          -- رئيس القسم (موظّف) — يُضاف FK لاحقاً بعد staff
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- سجلّ الأشخاص العاملين (الجدول العام للموظفين)
CREATE TABLE staff (
    id            BIGSERIAL PRIMARY KEY,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    national_id   VARCHAR(30) UNIQUE,
    gender        CHAR(1) CHECK (gender IN ('M','F')),
    date_of_birth DATE,
    phone         VARCHAR(30),
    email         VARCHAR(255) UNIQUE,
    staff_type    VARCHAR(30) NOT NULL
                  CHECK (staff_type IN ('doctor','nurse','receptionist','lab_technician','pharmacist','admin')),
    department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    hire_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- إضافة FK لرئيس القسم بعد إنشاء staff (حلّ التبعية الدائرية)
ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head_staff
    FOREIGN KEY (head_staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- بيانات الأطباء التخصصية (علاقة 1:1 مع staff)
CREATE TABLE doctors (
    id                  BIGSERIAL PRIMARY KEY,
    staff_id            BIGINT NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
    specialty           VARCHAR(100) NOT NULL,
    license_number      VARCHAR(50) NOT NULL UNIQUE,
    years_of_experience SMALLINT CHECK (years_of_experience >= 0),
    consultation_fee    NUMERIC(10,2) CHECK (consultation_fee >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- بيانات الممرّضين التخصصية (علاقة 1:1 مع staff)
CREATE TABLE nurses (
    id             BIGSERIAL PRIMARY KEY,
    staff_id       BIGINT NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE,
    shift          VARCHAR(20) CHECK (shift IN ('morning','evening','night')),
    ward           VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
--  (3) المرضى
-- =====================================================================

-- السجلّ الديموغرافي للمرضى (منفصل عن users و staff)
CREATE TABLE patients (
    id                      BIGSERIAL PRIMARY KEY,
    medical_record_number   VARCHAR(30) NOT NULL UNIQUE,   -- MRN رقم الملف الطبي
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    national_id             VARCHAR(30) UNIQUE,
    gender                  CHAR(1) CHECK (gender IN ('M','F')),
    date_of_birth           DATE NOT NULL,
    blood_type              VARCHAR(3) CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    phone                   VARCHAR(30),
    email                   VARCHAR(255),
    address                 TEXT,
    emergency_contact_name  VARCHAR(150),
    emergency_contact_phone VARCHAR(30),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
--  (4) المصادقة وإسناد الأدوار: users + user_roles
--      users يرتبط بـ staff أو patients (FK متاح الآن لكليهما)
-- =====================================================================

-- هوية تسجيل الدخول (المصادقة فقط) — تخزّن hash كلمة المرور لا الكلمة نفسها
CREATE TABLE users (
    id                    BIGSERIAL PRIMARY KEY,
    username              VARCHAR(50)  NOT NULL UNIQUE,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,          -- bcrypt/argon2 — لا تُخزَّن كلمة المرور أبداً
    staff_id              BIGINT REFERENCES staff(id)    ON DELETE SET NULL,
    patient_id            BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at         TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- الحساب إمّا لموظّف أو لمريض
    CONSTRAINT chk_users_staff_or_patient CHECK (staff_id IS NOT NULL OR patient_id IS NOT NULL)
);

-- جدول وصل N:M بين المستخدمين والأدوار (جوهر RBAC)
CREATE TABLE user_roles (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);


-- =====================================================================
--  (5) المواعيد
-- =====================================================================

-- المواعيد بين مريض وطبيب في قسم (تجسيد علاقة N:M بين المرضى والأطباء)
CREATE TABLE appointments (
    id               BIGSERIAL PRIMARY KEY,
    patient_id       BIGINT NOT NULL REFERENCES patients(id)    ON DELETE CASCADE,
    doctor_id        BIGINT NOT NULL REFERENCES doctors(id)     ON DELETE RESTRICT,
    department_id    BIGINT REFERENCES departments(id)          ON DELETE SET NULL,
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    status           VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','cancelled','no_show')),
    reason           VARCHAR(500),
    created_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,   -- المستخدم الذي أنشأ الموعد
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (doctor_id, scheduled_at)   -- منع حجزين للطبيب بنفس اللحظة
);


-- =====================================================================
--  (6) السجلّ الطبي والتشخيصات
-- =====================================================================

-- السجلّ الطبي / الزيارة السريرية (مرتبط بمريض وطبيب وموعد اختياري)
CREATE TABLE medical_records (
    id                BIGSERIAL PRIMARY KEY,
    patient_id        BIGINT NOT NULL REFERENCES patients(id)     ON DELETE CASCADE,
    doctor_id         BIGINT NOT NULL REFERENCES doctors(id)      ON DELETE RESTRICT,
    appointment_id    BIGINT REFERENCES appointments(id)          ON DELETE SET NULL,
    visit_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chief_complaint   TEXT,
    examination_notes TEXT,
    vital_signs       JSONB,   -- ضغط/نبض/حرارة ببنية مرنة
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- التشخيصات المرتبطة بسجلّ طبي (تدعم ترميز ICD-10 وعدّة تشخيصات للزيارة)
CREATE TABLE diagnoses (
    id                BIGSERIAL PRIMARY KEY,
    medical_record_id BIGINT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    icd10_code        VARCHAR(10),                 -- رمز التصنيف الدولي للأمراض
    description       TEXT NOT NULL,
    diagnosis_type    VARCHAR(20) DEFAULT 'primary'
                      CHECK (diagnosis_type IN ('primary','secondary','provisional')),
    diagnosed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
--  (7) الأدوية والوصفات وبنودها
-- =====================================================================

-- كتالوج الأدوية (مرجع ثابت تُشير إليه بنود الوصفات)
CREATE TABLE medications (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    generic_name   VARCHAR(200),
    form           VARCHAR(50),    -- tablet/syrup/injection
    strength       VARCHAR(50),    -- مثل '500mg'
    manufacturer   VARCHAR(150),
    unit_price     NUMERIC(10,2) CHECK (unit_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, strength, form)
);

-- رأس الوصفة الطبية (البنود التفصيلية في prescription_items)
CREATE TABLE prescriptions (
    id                BIGSERIAL PRIMARY KEY,
    medical_record_id BIGINT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id        BIGINT NOT NULL REFERENCES patients(id)        ON DELETE CASCADE,
    doctor_id         BIGINT NOT NULL REFERENCES doctors(id)         ON DELETE RESTRICT,
    issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status            VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','dispensed','cancelled')),
    notes             TEXT
);

-- بنود الوصفة (جدول وصل N:M بين الوصفات والأدوية مع جرعة/مدة لكل دواء)
CREATE TABLE prescription_items (
    id              BIGSERIAL PRIMARY KEY,
    prescription_id BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_id   BIGINT NOT NULL REFERENCES medications(id)   ON DELETE RESTRICT,
    dosage          VARCHAR(100) NOT NULL,    -- مثل '1 tablet'
    frequency       VARCHAR(100) NOT NULL,    -- مثل 'twice daily'
    duration_days   SMALLINT CHECK (duration_days > 0),
    quantity        INTEGER  CHECK (quantity > 0),
    instructions    TEXT,
    UNIQUE (prescription_id, medication_id)
);


-- =====================================================================
--  (8) المختبر: كتالوج الفحوص وطلبات الفحص
-- =====================================================================

-- كتالوج أنواع الفحوص المختبرية (مرجع ثابت)
CREATE TABLE lab_tests (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL UNIQUE,
    category        VARCHAR(100),    -- hematology/biochemistry...
    reference_range VARCHAR(150),
    unit            VARCHAR(30),
    price           NUMERIC(10,2) CHECK (price >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- طلبات الفحص المختبري (علاقة N:M بين السجلات الطبية وأنواع الفحوص)
CREATE TABLE lab_orders (
    id                    BIGSERIAL PRIMARY KEY,
    medical_record_id     BIGINT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id            BIGINT NOT NULL REFERENCES patients(id)        ON DELETE CASCADE,
    lab_test_id           BIGINT NOT NULL REFERENCES lab_tests(id)       ON DELETE RESTRICT,
    ordered_by_doctor_id  BIGINT NOT NULL REFERENCES doctors(id)         ON DELETE RESTRICT,
    performed_by_staff_id BIGINT REFERENCES staff(id)                    ON DELETE SET NULL,  -- فنّي المختبر
    status                VARCHAR(20) NOT NULL DEFAULT 'ordered'
                          CHECK (status IN ('ordered','in_progress','completed','cancelled')),
    result_value          VARCHAR(255),
    result_notes          TEXT,
    ordered_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resulted_at           TIMESTAMPTZ
);


-- =====================================================================
--  (9) الفوترة والمدفوعات
-- =====================================================================

-- رأس الفاتورة لمريض (البنود في invoice_items)
CREATE TABLE invoices (
    id             BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    patient_id     BIGINT NOT NULL REFERENCES patients(id)     ON DELETE RESTRICT,
    appointment_id BIGINT REFERENCES appointments(id)          ON DELETE SET NULL,
    total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status         VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid','partially_paid','paid','cancelled')),
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date       DATE,
    created_by     BIGINT REFERENCES users(id) ON DELETE SET NULL
);

-- بنود الفاتورة (كل بند سطر بسعر وكمية؛ line_total عمود محسوب)
CREATE TABLE invoice_items (
    id           BIGSERIAL PRIMARY KEY,
    invoice_id   BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_type    VARCHAR(20) NOT NULL
                 CHECK (item_type IN ('consultation','medication','lab_test','procedure','other')),
    description  VARCHAR(255) NOT NULL,
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    line_total   NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    reference_id BIGINT   -- مُعرّف مرجعي اختياري (lab_order / prescription_item)
);

-- مدفوعات الفاتورة (1:N — دعم السداد على دفعات)
CREATE TABLE payments (
    id           BIGSERIAL PRIMARY KEY,
    invoice_id   BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method       VARCHAR(20) NOT NULL CHECK (method IN ('cash','card','transfer','insurance')),
    paid_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reference_no VARCHAR(100)
);


-- =====================================================================
--  (10) سجلّ التدقيق الأمني (append-only)
--      لا FK على entity_id (إلحاق مرن)؛ user_id فقط مرتبط بـ users.
-- =====================================================================

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- الفاعل (قد يكون NULL لأحداث النظام)
    action      VARCHAR(50) NOT NULL,    -- 'LOGIN','CREATE','UPDATE','DELETE','VIEW'
    entity_type VARCHAR(50) NOT NULL,    -- اسم الجدول المتأثر
    entity_id   BIGINT,                  -- مُعرّف السجلّ المتأثر
    old_values  JSONB,                   -- القيم قبل التعديل
    new_values  JSONB,                   -- القيم بعد التعديل
    ip_address  INET,
    user_agent  VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
--  الفهارس (INDEXES)
--  ملاحظة: قيود UNIQUE و PRIMARY KEY تنشئ فهارسها تلقائياً، لذا
--  لا نكرّرها هنا (username, email, mrn, license_number, invoice_number...).
--  نضيف فهارس المفاتيح الأجنبية والأعمدة كثيرة الاستعلام فقط.
-- =====================================================================

-- فهارس RBAC: الجانب الثاني من جداول الوصل (الجانب الأول مغطّى بالـ PK المركّب)
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX idx_user_roles_role             ON user_roles(role_id);

-- فهارس users: المفاتيح الأجنبية لربط الحساب بالموظّف/المريض
CREATE INDEX idx_users_staff_id   ON users(staff_id);
CREATE INDEX idx_users_patient_id ON users(patient_id);

-- فهرس المفتاح الأجنبي لقسم الموظّف
CREATE INDEX idx_staff_department_id ON staff(department_id);

-- فهارس المواعيد: المفاتيح الأجنبية + فهرس مركّب لجدول الطبيب + فهرس جزئي للمواعيد القادمة
CREATE INDEX idx_appointments_patient_id    ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id     ON appointments(doctor_id);
CREATE INDEX idx_appointments_department_id ON appointments(department_id);
CREATE INDEX idx_appointments_scheduled_at  ON appointments(scheduled_at);
CREATE INDEX idx_appointments_doctor_date   ON appointments(doctor_id, scheduled_at);
CREATE INDEX idx_appointments_upcoming      ON appointments(scheduled_at) WHERE status = 'scheduled';

-- فهارس السجلّ الطبي: المفاتيح الأجنبية + تاريخ الزيارة كثير الاستعلام
CREATE INDEX idx_medical_records_patient_id     ON medical_records(patient_id);
CREATE INDEX idx_medical_records_doctor_id      ON medical_records(doctor_id);
CREATE INDEX idx_medical_records_appointment_id ON medical_records(appointment_id);
CREATE INDEX idx_medical_records_visit_date     ON medical_records(visit_date);

-- فهرس المفتاح الأجنبي للتشخيصات
CREATE INDEX idx_diagnoses_medical_record_id ON diagnoses(medical_record_id);

-- فهارس الوصفات وبنودها
CREATE INDEX idx_prescriptions_medical_record_id ON prescriptions(medical_record_id);
CREATE INDEX idx_prescriptions_patient_id        ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor_id         ON prescriptions(doctor_id);
CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX idx_prescription_items_medication   ON prescription_items(medication_id);

-- فهارس طلبات الفحص المختبري
CREATE INDEX idx_lab_orders_medical_record_id ON lab_orders(medical_record_id);
CREATE INDEX idx_lab_orders_patient_id        ON lab_orders(patient_id);
CREATE INDEX idx_lab_orders_lab_test_id       ON lab_orders(lab_test_id);
CREATE INDEX idx_lab_orders_ordered_by_doctor ON lab_orders(ordered_by_doctor_id);
CREATE INDEX idx_lab_orders_performed_by      ON lab_orders(performed_by_staff_id);

-- فهارس الفوترة: المفاتيح الأجنبية + فهرس جزئي للفواتير غير المسدّدة
CREATE INDEX idx_invoices_patient_id      ON invoices(patient_id);
CREATE INDEX idx_invoices_appointment_id  ON invoices(appointment_id);
CREATE INDEX idx_invoices_created_by      ON invoices(created_by);
CREATE INDEX idx_invoices_patient_status  ON invoices(patient_id, status) WHERE status <> 'paid';
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- فهارس المدفوعات
CREATE INDEX idx_payments_invoice_id  ON payments(invoice_id);
CREATE INDEX idx_payments_received_by ON payments(received_by);

-- فهارس سجلّ التدقيق: الفاعل + السجلّ المتأثر + الزمن (للرقابة الزمنية)
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================================
--  نهاية المخطّط — 22 جدولاً
-- =====================================================================
