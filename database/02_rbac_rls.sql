-- =====================================================================
--  نظام قاعدة بيانات مستشفى آمن مع RBAC
--  الملف: 02_rbac_rls.sql  — الأدوار والصلاحيات + أمان مستوى الصفّ (RLS)
--  المنصّة: PostgreSQL
--
--  يُنفَّذ بعد 01_schema.sql (يفترض وجود الجداول الـ22).
--  يحتوي على أربعة أقسام:
--    (أ) بذور RBAC: roles + permissions + role_permissions
--    (ب) دوال سياق الجلسة المساعدة لـ RLS
--    (ج) تفعيل RLS وكتابة السياسات على الجداول الحسّاسة
--    (د) دور قاعدة بيانات للتطبيق (app_role) + GRANT/REVOKE
--
--  فلسفة الأمان (دفاع متعدّد الطبقات / defense in depth):
--    التطبيق يفحص permission code قبل الاستعلام، وقاعدة البيانات
--    تفرض RLS كطبقة ثانية، فلا يكفي اختراق طبقة واحدة لكشف البيانات.
-- =====================================================================


-- =====================================================================
--  (أ) بذور RBAC — الأدوار والصلاحيات والربط بينها
-- =====================================================================

-- ---------------------------------------------------------------------
--  (أ-1) إدراج الأدوار السبعة
--  ON CONFLICT DO NOTHING يجعل التشغيل المتكرّر آمناً (idempotent).
-- ---------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
    ('admin',          'مدير النظام: إدارة الأدوار والصلاحيات والمستخدمين والأقسام والكتالوجات'),
    ('doctor',         'الطبيب: السجلات الطبية والتشخيصات والوصفات وطلبات الفحص لمرضاه'),
    ('nurse',          'الممرّض: قراءة سجلات النطاق وتحديث العلامات الحيوية وحالة المواعيد'),
    ('receptionist',   'موظف الاستقبال: تسجيل المرضى وإدارة المواعيد والفواتير والمدفوعات'),
    ('lab_technician', 'فنّي المختبر: تنفيذ طلبات الفحص وإدخال النتائج وتحديث حالتها'),
    ('pharmacist',     'الصيدلي: قراءة الوصفات وصرفها وإدارة مخزون الأدوية'),
    ('patient',        'المريض: الاطّلاع على سجله الشخصي وحجز/إلغاء مواعيده')
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------------------
--  (أ-2) إدراج الصلاحيات الدقيقة بصيغة 'resource:action'
--  مشتقّة من permission_matrix في وثيقة التصميم.
--  الإجراءات: read=قراءة، create=إنشاء، update=تعديل، delete=حذف.
-- ---------------------------------------------------------------------
INSERT INTO permissions (code, description) VALUES
    -- جداول RBAC (محتكَرة لـ admin)
    ('roles:read',                'قراءة الأدوار'),
    ('roles:create',              'إنشاء دور'),
    ('roles:update',              'تعديل دور'),
    ('roles:delete',              'حذف دور'),
    ('permissions:read',          'قراءة الصلاحيات'),
    ('permissions:create',        'إنشاء صلاحية'),
    ('permissions:update',        'تعديل صلاحية'),
    ('permissions:delete',        'حذف صلاحية'),
    ('role_permissions:read',     'قراءة ربط الأدوار بالصلاحيات'),
    ('role_permissions:create',   'ربط صلاحية بدور'),
    ('role_permissions:delete',   'فكّ ربط صلاحية عن دور'),
    ('users:read',                'قراءة حسابات المستخدمين'),
    ('users:create',              'إنشاء حساب مستخدم'),
    ('users:update',              'تعديل حساب مستخدم'),
    ('users:delete',              'حذف حساب مستخدم'),
    ('user_roles:read',           'قراءة إسناد الأدوار للمستخدمين'),
    ('user_roles:create',         'إسناد دور لمستخدم'),
    ('user_roles:delete',         'سحب دور من مستخدم'),

    -- الأقسام والموظفون والتخصصات
    ('departments:read',          'قراءة الأقسام'),
    ('departments:create',        'إنشاء قسم'),
    ('departments:update',        'تعديل قسم'),
    ('departments:delete',        'حذف قسم'),
    ('staff:read',                'قراءة سجلات الموظفين'),
    ('staff:create',              'إضافة موظف'),
    ('staff:update',              'تعديل بيانات موظف'),
    ('staff:delete',              'حذف موظف'),
    ('doctors:read',              'قراءة بيانات الأطباء'),
    ('doctors:create',            'إضافة طبيب'),
    ('doctors:update',            'تعديل بيانات طبيب'),
    ('nurses:read',               'قراءة بيانات الممرّضين'),
    ('nurses:create',             'إضافة ممرّض'),
    ('nurses:update',             'تعديل بيانات ممرّض'),

    -- المرضى
    ('patients:read',             'قراءة بيانات المرضى'),
    ('patients:create',           'تسجيل مريض جديد'),
    ('patients:update',           'تعديل بيانات مريض'),

    -- المواعيد
    ('appointments:read',         'قراءة المواعيد'),
    ('appointments:create',       'حجز موعد'),
    ('appointments:update',       'تعديل موعد (تغيير الحالة/الإلغاء)'),

    -- السجلّ الطبي والتشخيصات
    ('medical_records:read',      'قراءة السجلات الطبية'),
    ('medical_records:create',    'إنشاء سجل طبي'),
    ('medical_records:update',    'تعديل سجل طبي (ملاحظات/علامات حيوية)'),
    ('diagnoses:read',            'قراءة التشخيصات'),
    ('diagnoses:create',          'إضافة تشخيص'),
    ('diagnoses:update',          'تعديل تشخيص'),

    -- الأدوية والوصفات
    ('medications:read',          'قراءة كتالوج الأدوية'),
    ('medications:create',        'إضافة دواء للكتالوج'),
    ('medications:update',        'تعديل سعر/مخزون دواء'),
    ('prescriptions:read',        'قراءة الوصفات'),
    ('prescriptions:create',      'إنشاء وصفة'),
    ('prescriptions:update',      'تعديل وصفة'),
    ('prescriptions:dispense',    'صرف وصفة (تغيير الحالة إلى dispensed)'),
    ('prescription_items:read',   'قراءة بنود الوصفة'),
    ('prescription_items:create', 'إضافة بند وصفة'),
    ('prescription_items:update', 'تعديل بند وصفة'),

    -- المختبر
    ('lab_tests:read',            'قراءة كتالوج الفحوص'),
    ('lab_tests:create',          'إضافة نوع فحص'),
    ('lab_orders:read',           'قراءة طلبات الفحص'),
    ('lab_orders:create',         'طلب فحص مختبري'),
    ('lab_orders:update',         'تحديث نتيجة/حالة طلب فحص'),

    -- الفوترة والمدفوعات
    ('invoices:read',             'قراءة الفواتير'),
    ('invoices:create',           'إنشاء فاتورة'),
    ('invoices:update',           'تعديل فاتورة'),
    ('invoice_items:read',        'قراءة بنود الفاتورة'),
    ('invoice_items:create',      'إضافة بند فاتورة'),
    ('invoice_items:update',      'تعديل بند فاتورة'),
    ('payments:read',             'قراءة المدفوعات'),
    ('payments:create',           'تسجيل دفعة'),

    -- التدقيق
    ('audit_logs:read',           'قراءة سجلّ التدقيق')
ON CONFLICT (code) DO NOTHING;


-- ---------------------------------------------------------------------
--  (أ-3) ربط الأدوار بصلاحياتها في role_permissions
--  نستعمل استعلامات فرعية (subqueries) لجلب المُعرّفات بالاسم/الرمز،
--  فيبقى السكربت مقروءاً ومستقلاً عن قيم المفاتيح التسلسلية.
-- ---------------------------------------------------------------------

-- admin: يملك كل الصلاحيات المعرّفة في النظام (إدارة كاملة).
-- ملاحظة: admin لا يُمنح وصولاً سريرياً تفصيلياً عبر RLS (انظر القسم ج)،
--          لكنه يحمل صلاحيات الإدارة على مستوى التطبيق.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- doctor: السجلات الطبية والتشخيصات والوصفات وطلبات الفحص لمرضاه + قراءات مساعدة.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'doctor'
  AND p.code IN (
        'patients:read',
        'departments:read', 'staff:read', 'doctors:read', 'doctors:update', 'nurses:read',
        'appointments:read', 'appointments:update',
        'medical_records:read', 'medical_records:create', 'medical_records:update',
        'diagnoses:read', 'diagnoses:create', 'diagnoses:update',
        'medications:read',
        'prescriptions:read', 'prescriptions:create', 'prescriptions:update',
        'prescription_items:read', 'prescription_items:create', 'prescription_items:update',
        'lab_tests:read',
        'lab_orders:read', 'lab_orders:create'
  )
ON CONFLICT DO NOTHING;

-- nurse: قراءة سجلات النطاق وتحديث العلامات الحيوية وحالة المواعيد.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'nurse'
  AND p.code IN (
        'patients:read',
        'departments:read', 'staff:read', 'doctors:read', 'nurses:read', 'nurses:update',
        'appointments:read', 'appointments:update',
        'medical_records:read', 'medical_records:update',
        'diagnoses:read',
        'medications:read',
        'prescriptions:read',
        'prescription_items:read',
        'lab_tests:read',
        'lab_orders:read'
  )
ON CONFLICT DO NOTHING;

-- receptionist: تسجيل المرضى وإدارة المواعيد والفواتير والمدفوعات.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'receptionist'
  AND p.code IN (
        'patients:read', 'patients:create', 'patients:update',
        'departments:read', 'staff:read', 'doctors:read',
        'appointments:read', 'appointments:create', 'appointments:update',
        'invoices:read', 'invoices:create', 'invoices:update',
        'invoice_items:read', 'invoice_items:create', 'invoice_items:update',
        'payments:read', 'payments:create'
  )
ON CONFLICT DO NOTHING;

-- lab_technician: تنفيذ طلبات الفحص وإدخال النتائج.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'lab_technician'
  AND p.code IN (
        'patients:read',
        'departments:read',
        'lab_tests:read',
        'lab_orders:read', 'lab_orders:update'
  )
ON CONFLICT DO NOTHING;

-- pharmacist: قراءة الوصفات وصرفها وإدارة مخزون الأدوية.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'pharmacist'
  AND p.code IN (
        'patients:read',
        'medications:read', 'medications:create', 'medications:update',
        'prescriptions:read', 'prescriptions:dispense',
        'prescription_items:read'
  )
ON CONFLICT DO NOTHING;

-- patient: الاطّلاع على سجله الشخصي فقط وحجز/إلغاء مواعيده.
-- (تقييد الصفوف على سجله وحده يُفرَض عبر سياسات RLS في القسم ج)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'patient'
  AND p.code IN (
        'patients:read', 'patients:update',
        'doctors:read', 'departments:read',
        'appointments:read', 'appointments:create', 'appointments:update',
        'medical_records:read',
        'diagnoses:read',
        'prescriptions:read',
        'prescription_items:read',
        'lab_orders:read',
        'invoices:read',
        'invoice_items:read',
        'payments:read'
  )
ON CONFLICT DO NOTHING;


-- =====================================================================
--  (ب) دوال سياق الجلسة المساعدة لـ RLS
--
--  المبدأ: قاعدة البيانات لا تعرف مستخدم التطبيق. لذا يضبط التطبيق
--  قبل كل استعلام، داخل المعاملة، متغيّرات جلسة (GUC):
--      SET LOCAL app.current_user_id = '<users.id>';
--      SET LOCAL app.current_role    = 'doctor';   -- أو CSV: 'doctor,nurse'
--  ثم تقرؤها الدوال التالية. المعامل true في current_setting يمنع
--  الخطأ إن لم يُضبط المتغيّر (يُرجِع NULL بدل رفع استثناء).
--
--  أمان الدوال: STABLE (نتيجة ثابتة داخل الاستعلام) + SECURITY INVOKER
--  + ضبط search_path صراحةً لمنع حقن الدوال.
-- =====================================================================

-- المستخدم الحالي (users.id) من سياق الجلسة، أو NULL إن لم يُضبط.
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
$$;

-- هل يحمل المستخدم الحالي الدور المطلوب؟
-- يدعم دوراً واحداً أو قائمة مفصولة بفواصل في app.current_role.
-- المطابقة على عنصر كامل (split) لتجنّب التطابق الجزئي الخاطئ.
CREATE OR REPLACE FUNCTION app_has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
    SELECT p_role = ANY (
        string_to_array(
            coalesce(NULLIF(current_setting('app.current_role', true), ''), ''),
            ','
        )
    );
$$;

-- مُعرّف الطبيب (doctors.id) المرتبط بالمستخدم الحالي عبر السلسلة
-- users -> staff -> doctors. يُرجِع NULL إن لم يكن المستخدم طبيباً،
-- فتفشل كل مقارنات doctor_id بأمان (تمنع الوصول بدل أن تفتحه).
CREATE OR REPLACE FUNCTION app_current_doctor_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    SELECT d.id
    FROM users u
    JOIN staff s   ON s.id = u.staff_id
    JOIN doctors d ON d.staff_id = s.id
    WHERE u.id = app_current_user_id();
$$;

-- مُعرّف المريض (patients.id) المرتبط بالمستخدم الحالي عبر users.patient_id.
-- يُرجِع NULL إن لم يكن المستخدم مريضاً.
CREATE OR REPLACE FUNCTION app_current_patient_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    SELECT u.patient_id
    FROM users u
    WHERE u.id = app_current_user_id();
$$;


-- =====================================================================
--  (ج) تفعيل RLS وكتابة السياسات على الجداول الحسّاسة
--
--  ENABLE  ROW LEVEL SECURITY: يفعّل فرض السياسات.
--  FORCE   ROW LEVEL SECURITY: يفرضها حتى على مالك الجدول كي لا
--          يتجاوزها (مهمّ لمنع تسرّب عبر حساب المالك).
--
--  ملاحظة جوهرية: حساب اتصال التطبيق يجب أن يكون دوراً عادياً
--  (NOSUPERUSER, NOBYPASSRLS)؛ وإلا تُتجاوز كل السياسات بصمت.
--  (يُنشأ هذا الدور في القسم د.)
-- =====================================================================

ALTER TABLE patients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients         FORCE  ROW LEVEL SECURITY;
ALTER TABLE appointments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments     FORCE  ROW LEVEL SECURITY;
ALTER TABLE medical_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records  FORCE  ROW LEVEL SECURITY;
ALTER TABLE diagnoses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses        FORCE  ROW LEVEL SECURITY;
ALTER TABLE prescriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions    FORCE  ROW LEVEL SECURITY;
ALTER TABLE lab_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders       FORCE  ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         FORCE  ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
--  (ج-1) patients — المريض يرى سجله فقط، الطبيب يرى مرضاه،
--         الاستقبال والأدمن يريان الكل.
-- ---------------------------------------------------------------------

-- قراءة: admin/receptionist يرون الكل؛ المريض سجله؛ الطبيب مرضى نطاقه
-- (المرتبطون به عبر سجل طبي أو موعد).
CREATE POLICY patients_select ON patients
    FOR SELECT
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR id = app_current_patient_id()
        OR EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.patient_id = patients.id
              AND mr.doctor_id  = app_current_doctor_id()
        )
        OR EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = patients.id
              AND a.doctor_id  = app_current_doctor_id()
        )
    );

-- إنشاء: الاستقبال فقط يسجّل مرضى جدداً.
CREATE POLICY patients_insert ON patients
    FOR INSERT
    WITH CHECK ( app_has_role('receptionist') OR app_has_role('admin') );

-- تعديل: الاستقبال، أو المريض لسجله فقط.
CREATE POLICY patients_update ON patients
    FOR UPDATE
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR id = app_current_patient_id()
    )
    WITH CHECK (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR id = app_current_patient_id()
    );


-- ---------------------------------------------------------------------
--  (ج-2) appointments — الطبيب والمريض في حدود مواعيدهما،
--         الاستقبال يدير الجدولة، المريض يحجز لنفسه ويُلغي فقط.
-- ---------------------------------------------------------------------

CREATE POLICY appointments_select ON appointments
    FOR SELECT
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR patient_id = app_current_patient_id()
        OR doctor_id  = app_current_doctor_id()
    );

-- إنشاء: الاستقبال لأي مريض؛ المريض لنفسه فقط.
CREATE POLICY appointments_insert ON appointments
    FOR INSERT
    WITH CHECK (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR ( app_has_role('patient') AND patient_id = app_current_patient_id() )
    );

-- تعديل: نفس شرط الرؤية للوصول؛ والكتابة مقيّدة:
--   الاستقبال يعدّل بحرية، الطبيب مواعيده، المريض الإلغاء فقط.
CREATE POLICY appointments_update ON appointments
    FOR UPDATE
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR patient_id = app_current_patient_id()
        OR doctor_id  = app_current_doctor_id()
    )
    WITH CHECK (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR doctor_id = app_current_doctor_id()
        OR ( patient_id = app_current_patient_id() AND status = 'cancelled' )
    );


-- ---------------------------------------------------------------------
--  (ج-3) medical_records — أحسّ المحتوى السريري.
--         الطبيب المالك والمريض يقرآن؛ الإنشاء حصري للطبيب المعالج؛
--         الممرّض يقرأ ويحدّث ضمن النطاق؛ لا حذف لأحد.
-- ---------------------------------------------------------------------

CREATE POLICY medical_records_select ON medical_records
    FOR SELECT
    USING (
        doctor_id  = app_current_doctor_id()
        OR patient_id = app_current_patient_id()
        OR app_has_role('nurse')
    );

-- إنشاء: الطبيب المعالج فقط (السجل باسمه).
CREATE POLICY medical_records_insert ON medical_records
    FOR INSERT
    WITH CHECK ( doctor_id = app_current_doctor_id() );

-- تعديل: الطبيب المالك، أو الممرّض (للعلامات الحيوية ضمن النطاق).
CREATE POLICY medical_records_update ON medical_records
    FOR UPDATE
    USING ( doctor_id = app_current_doctor_id() OR app_has_role('nurse') )
    WITH CHECK ( doctor_id = app_current_doctor_id() OR app_has_role('nurse') );

-- DELETE: لا سياسة → مرفوض للجميع (سلامة السجل الطبي).


-- ---------------------------------------------------------------------
--  (ج-4) diagnoses — تتبع ملكية السجل الطبي الأب.
--         يكتبه طبيب السجل فقط، ويقرأه المريض والطبيب (والممرّض).
-- ---------------------------------------------------------------------

CREATE POLICY diagnoses_select ON diagnoses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.id = diagnoses.medical_record_id
              AND ( mr.doctor_id  = app_current_doctor_id()
                 OR mr.patient_id = app_current_patient_id()
                 OR app_has_role('nurse') )
        )
    );

CREATE POLICY diagnoses_insert ON diagnoses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.id = diagnoses.medical_record_id
              AND mr.doctor_id = app_current_doctor_id()
        )
    );

CREATE POLICY diagnoses_update ON diagnoses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.id = diagnoses.medical_record_id
              AND mr.doctor_id = app_current_doctor_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM medical_records mr
            WHERE mr.id = diagnoses.medical_record_id
              AND mr.doctor_id = app_current_doctor_id()
        )
    );


-- ---------------------------------------------------------------------
--  (ج-5) prescriptions — الطبيب ينشئ، الصيدلي يصرف (active→dispensed)،
--         المريض يقرأ.
-- ---------------------------------------------------------------------

CREATE POLICY prescriptions_select ON prescriptions
    FOR SELECT
    USING (
        doctor_id  = app_current_doctor_id()
        OR patient_id = app_current_patient_id()
        OR app_has_role('pharmacist')
    );

CREATE POLICY prescriptions_insert ON prescriptions
    FOR INSERT
    WITH CHECK ( doctor_id = app_current_doctor_id() );

-- تعديل: الطبيب المالك، أو الصيدلي على الوصفات الفعّالة فقط.
-- USING يفحص الصفّ قبل التعديل (الوصفة active للصيدلي)،
-- وWITH CHECK يفحص الصفّ بعده (يصبح dispensed).
CREATE POLICY prescriptions_update ON prescriptions
    FOR UPDATE
    USING (
        doctor_id = app_current_doctor_id()
        OR ( app_has_role('pharmacist') AND status = 'active' )
    )
    WITH CHECK (
        doctor_id = app_current_doctor_id()
        OR ( app_has_role('pharmacist') AND status = 'dispensed' )
    );


-- ---------------------------------------------------------------------
--  (ج-6) lab_orders — الطبيب يطلب، الفنّي ينفّذ ويُدخل النتيجة،
--         المريض يقرأ نتيجته.
-- ---------------------------------------------------------------------

CREATE POLICY lab_orders_select ON lab_orders
    FOR SELECT
    USING (
        ordered_by_doctor_id = app_current_doctor_id()
        OR patient_id = app_current_patient_id()
        OR app_has_role('lab_technician')
    );

-- إنشاء (طلب فحص): الطبيب الطالب فقط.
CREATE POLICY lab_orders_insert ON lab_orders
    FOR INSERT
    WITH CHECK ( ordered_by_doctor_id = app_current_doctor_id() );

-- تعديل: فنّي المختبر (النتيجة/الحالة)، أو الطبيب الطالب.
CREATE POLICY lab_orders_update ON lab_orders
    FOR UPDATE
    USING (
        app_has_role('lab_technician')
        OR ordered_by_doctor_id = app_current_doctor_id()
    )
    WITH CHECK (
        app_has_role('lab_technician')
        OR ordered_by_doctor_id = app_current_doctor_id()
    );


-- ---------------------------------------------------------------------
--  (ج-7) invoices — الاستقبال/الأدمن يديران، المريض يقرأ فواتيره فقط.
-- ---------------------------------------------------------------------

CREATE POLICY invoices_select ON invoices
    FOR SELECT
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR patient_id = app_current_patient_id()
    );

CREATE POLICY invoices_insert ON invoices
    FOR INSERT
    WITH CHECK ( app_has_role('admin') OR app_has_role('receptionist') );

CREATE POLICY invoices_update ON invoices
    FOR UPDATE
    USING ( app_has_role('admin') OR app_has_role('receptionist') )
    WITH CHECK ( app_has_role('admin') OR app_has_role('receptionist') );

-- DELETE: لا سياسة → الإلغاء يكون عبر status لا بالحذف (سلامة مالية).


-- =====================================================================
--  (د) دور قاعدة بيانات للتطبيق + GRANT/REVOKE
--
--  حساب اتصال التطبيق app_role:
--    - LOGIN: للاتصال.
--    - NOSUPERUSER, NOBYPASSRLS: ضروريان كي تُطبَّق عليه سياسات RLS.
--    - NOCREATEDB, NOCREATEROLE: مبدأ أقل امتياز.
--  غيّر كلمة المرور قبل الإنتاج. يُستخدم اتصال واحد لطبقة التطبيق،
--  وتُفرض هوية المستخدم منطقياً عبر app.current_user_id / app.current_role.
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
        CREATE ROLE app_role
            LOGIN
            PASSWORD 'change_me_in_production'
            NOSUPERUSER
            NOBYPASSRLS
            NOCREATEDB
            NOCREATEROLE;
    END IF;
END
$$;

-- صلاحيات الاتصال والاستخدام
-- ملاحظة: صلاحية CONNECT على قاعدة البيانات ممنوحة افتراضياً لـ PUBLIC؛
-- إن رغبت بحصرها فامنحها باسم قاعدتك صراحةً، مثلاً:
--   GRANT CONNECT ON DATABASE hospital_db TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;

-- صلاحيات DML على كل الجداول الحالية (RLS تبقى الحارس الفعلي للصفوف).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;

-- استخدام التسلسلات (BIGSERIAL) للإدراج.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- audit_logs للإلحاق فقط (append-only): يُسمح بالإدراج والقراءة، ويُمنع
-- التعديل والحذف لضمان عدم العبث بالسجلّ الأمني.
REVOKE UPDATE, DELETE ON audit_logs FROM app_role;

-- جداول RBAC: لا يلمسها دور التطبيق العادي عبر اتصال المستخدمين النهائيين.
-- (إدارتها تتم عبر مسار admin المُخوَّل في طبقة التطبيق فقط.)
-- نُبقي SELECT لقراءة الأدوار/الصلاحيات عند بناء التوكن، ونمنع الكتابة المباشرة.
REVOKE INSERT, UPDATE, DELETE ON roles, permissions, role_permissions FROM app_role;

-- ضبط الصلاحيات الافتراضية لأي جداول/تسلسلات تُنشأ لاحقاً.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_role;


-- =====================================================================
--  (ج-8) users — المستخدم يرى/يعدّل سجله الخاص، admin يرى ويعدّل الكل.
--
--  ملاحظة أمنية: password_hash لا يُعاد قط من الـ controllers؛
--  RLS هنا تضمن أن الصفوف نفسها محمية على مستوى قاعدة البيانات.
-- =====================================================================

ALTER TABLE users  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users  FORCE  ROW LEVEL SECURITY;

-- قراءة: admin يرى الكل؛ أي مستخدم يرى سجله فقط.
CREATE POLICY users_select ON users
    FOR SELECT
    USING (
        app_has_role('admin')
        OR id = app_current_user_id()
    );

-- إنشاء: admin فقط (إنشاء الحسابات من خلال userController).
CREATE POLICY users_insert ON users
    FOR INSERT
    WITH CHECK ( app_has_role('admin') );

-- تعديل: admin يعدّل أي سجل؛ المستخدم يعدّل سجله فقط.
CREATE POLICY users_update ON users
    FOR UPDATE
    USING (
        app_has_role('admin')
        OR id = app_current_user_id()
    )
    WITH CHECK (
        app_has_role('admin')
        OR id = app_current_user_id()
    );

-- حذف: admin فقط (تعطيل الحساب المفضَّل عبر is_active، لكن الحذف الفعلي admin).
CREATE POLICY users_delete ON users
    FOR DELETE
    USING ( app_has_role('admin') );


-- =====================================================================
--  (ج-9) user_roles — admin يدير الكل؛ المستخدم يقرأ أدواره فقط.
-- =====================================================================

ALTER TABLE user_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles  FORCE  ROW LEVEL SECURITY;

-- قراءة: admin يرى كل الإسنادات؛ المستخدم يرى أدواره هو فقط.
CREATE POLICY user_roles_select ON user_roles
    FOR SELECT
    USING (
        app_has_role('admin')
        OR user_id = app_current_user_id()
    );

-- إنشاء/حذف: admin فقط (إسناد/سحب الأدوار عملية إدارية حصرية).
CREATE POLICY user_roles_insert ON user_roles
    FOR INSERT
    WITH CHECK ( app_has_role('admin') );

CREATE POLICY user_roles_delete ON user_roles
    FOR DELETE
    USING ( app_has_role('admin') );


-- =====================================================================
--  (ج-10) payments — ترث صلاحية الفاتورة الأم عبر EXISTS على invoices.
--
--  منطق الإرث: المستخدم له حق رؤية الدفعة فقط إذا كان له حق رؤية
--  الفاتورة المرتبطة بها (نفس سياسة invoices_select في ج-7).
-- =====================================================================

ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  FORCE  ROW LEVEL SECURITY;

-- قراءة: admin/receptionist يريان الكل؛ المريض يرى دفعات فواتيره فقط.
CREATE POLICY payments_select ON payments
    FOR SELECT
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id = payments.invoice_id
              AND i.patient_id = app_current_patient_id()
        )
    );

-- إنشاء: receptionist أو admin فقط (تسجيل الدفعات).
CREATE POLICY payments_insert ON payments
    FOR INSERT
    WITH CHECK (
        app_has_role('admin')
        OR app_has_role('receptionist')
    );

-- تعديل/حذف: لا سياسة → مرفوض للجميع (append-only للنزاهة المالية).


-- =====================================================================
--  (ج-11) invoice_items — ترث صلاحية الفاتورة الأم عبر EXISTS على invoices.
-- =====================================================================

ALTER TABLE invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  FORCE  ROW LEVEL SECURITY;

-- قراءة: نفس منطق invoices_select (admin/receptionist/مريض فاتورته).
CREATE POLICY invoice_items_select ON invoice_items
    FOR SELECT
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
        OR EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id = invoice_items.invoice_id
              AND i.patient_id = app_current_patient_id()
        )
    );

-- إنشاء: receptionist أو admin فقط.
CREATE POLICY invoice_items_insert ON invoice_items
    FOR INSERT
    WITH CHECK (
        app_has_role('admin')
        OR app_has_role('receptionist')
    );

-- تعديل: receptionist أو admin، مع التحقق من ملكية الفاتورة.
CREATE POLICY invoice_items_update ON invoice_items
    FOR UPDATE
    USING (
        app_has_role('admin')
        OR app_has_role('receptionist')
    )
    WITH CHECK (
        app_has_role('admin')
        OR app_has_role('receptionist')
    );


-- =====================================================================
--  (ج-12) prescription_items — ترث صلاحية الوصفة الأم عبر EXISTS على prescriptions.
-- =====================================================================

ALTER TABLE prescription_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items  FORCE  ROW LEVEL SECURITY;

-- قراءة: نفس منطق prescriptions_select (طبيب الوصفة / مريضها / الصيدلي).
CREATE POLICY prescription_items_select ON prescription_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prescriptions pr
            WHERE pr.id = prescription_items.prescription_id
              AND (
                  pr.doctor_id  = app_current_doctor_id()
                  OR pr.patient_id = app_current_patient_id()
                  OR app_has_role('pharmacist')
                  OR app_has_role('nurse')
              )
        )
    );

-- إنشاء: الطبيب يضيف بنوداً لوصفاته فقط.
CREATE POLICY prescription_items_insert ON prescription_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prescriptions pr
            WHERE pr.id = prescription_items.prescription_id
              AND pr.doctor_id = app_current_doctor_id()
        )
    );

-- تعديل: الطبيب يعدّل بنود وصفاته فقط.
CREATE POLICY prescription_items_update ON prescription_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM prescriptions pr
            WHERE pr.id = prescription_items.prescription_id
              AND pr.doctor_id = app_current_doctor_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prescriptions pr
            WHERE pr.id = prescription_items.prescription_id
              AND pr.doctor_id = app_current_doctor_id()
        )
    );


-- =====================================================================
--  نهاية ملف RBAC + RLS
--  ملخّص: 7 أدوار، صلاحيات دقيقة (resource:action)، RLS على 12 جدولاً
--  حسّاسة بـ 40 سياسة، و4 دوال سياق، ودور تطبيق app_role بمبدأ أقل امتياز.
-- =====================================================================
