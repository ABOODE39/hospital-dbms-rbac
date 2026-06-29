-- =====================================================================
--  نظام قاعدة بيانات مستشفى آمن مع RBAC
--  الملف: 04_views_masking.sql  — إخفاء وتقنيع البيانات الحسّاسة (Data Masking)
--  المنصّة: PostgreSQL
--
--  الفكرة العامة:
--    لا تَصِل الأدوار الدنيا (الاستقبال/الممرّض/المريض) إلى الجداول مباشرة،
--    بل عبر VIEWS تُخفي أو تُقنّع الأعمدة الحسّاسة حسب حاجة كل دور
--    (مبدأ أقل امتياز Least Privilege). ثم تُسحب صلاحية SELECT المباشرة
--    عن الجداول الأصلية لتلك الأدوار وتُعطى على الـ views فقط.
--
--  آلية تمييز الدور (مناسبة لمشروع طالب باتصال تطبيق واحد):
--    التطبيق يضبط داخل كل معاملة:  SET LOCAL app.current_role     = '<role>';
--                                   SET LOCAL app.current_user_id = '<id>';
--    ثم تقرأها الـ views عبر current_setting(..., true) لتقييد الصفوف/الأعمدة.
--    (البديل المؤسسي الأقوى هو RLS، يُذكر في نهاية الملف كترقية مستقبلية.)
--
--  متطلّب مُسبق: 01_schema.sql (الجداول) و pgcrypto مفعّل.
-- =====================================================================


-- =====================================================================
--  (0) أدوار قاعدة البيانات — تُحاكي أدوار النظام السبعة
--      تُمنح الـ GRANT على الـ views لهذه الأدوار في القسم الأخير.
--      NOLOGIN لأنها أدوار مجموعات (group roles) لا حسابات دخول.
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_admin')        THEN CREATE ROLE role_admin        NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_doctor')       THEN CREATE ROLE role_doctor       NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_nurse')        THEN CREATE ROLE role_nurse        NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_receptionist') THEN CREATE ROLE role_receptionist NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_lab_tech')     THEN CREATE ROLE role_lab_tech     NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_pharmacist')   THEN CREATE ROLE role_pharmacist   NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_patient')      THEN CREATE ROLE role_patient      NOLOGIN; END IF;
END $$;


-- =====================================================================
--  (1) دوال التقنيع (Masking helpers) — قابلة لإعادة الاستخدام
--      IMMUTABLE: نتيجتها ثابتة لنفس المدخل، فتستفيد من تحسين الاستعلام.
-- =====================================================================

-- تقنيع رقم الهاتف: إظهار آخر 4 أرقام فقط، مثال: '07901234567' -> '*******4567'
CREATE OR REPLACE FUNCTION mask_phone(p TEXT)
RETURNS TEXT AS $$
    SELECT CASE
        WHEN p IS NULL THEN NULL
        ELSE repeat('*', greatest(length(p) - 4, 0)) || right(p, 4)
    END;
$$ LANGUAGE sql IMMUTABLE;

-- تقنيع الرقم الوطني: إظهار آخر رقمين فقط، مثال: '199012345678' -> '**********78'
CREATE OR REPLACE FUNCTION mask_national_id(p TEXT)
RETURNS TEXT AS $$
    SELECT CASE
        WHEN p IS NULL THEN NULL
        ELSE repeat('*', greatest(length(p) - 2, 0)) || right(p, 2)
    END;
$$ LANGUAGE sql IMMUTABLE;

-- تقنيع البريد الإلكتروني: إظهار أول حرف والنطاق، مثال: 'ahmed@mail.com' -> 'a***@mail.com'
CREATE OR REPLACE FUNCTION mask_email(p TEXT)
RETURNS TEXT AS $$
    SELECT CASE
        WHEN p IS NULL OR position('@' IN p) = 0 THEN p
        ELSE left(p, 1) || '***' || substring(p FROM position('@' IN p))
    END;
$$ LANGUAGE sql IMMUTABLE;

-- دالة مساعدة: مُعرّف المستخدم الحالي من سياق الجلسة (يضبطه التطبيق)
-- المعامل true يمنع الخطأ إذا لم يُضبط المتغيّر بعد.
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS BIGINT AS $$
    SELECT nullif(current_setting('app.current_user_id', true), '')::BIGINT;
$$ LANGUAGE sql STABLE;


-- =====================================================================
--  (2) view الاستقبال (role_receptionist)
--      الغرض: جدولة المواعيد والفوترة فقط.
--      يُظهر: اسم المريض، رقم الملف، الهاتف (مُقنّع)، الجنس، تاريخ الميلاد.
--      يُخفي: الرقم الوطني، العنوان، البريد، جهة الطوارئ (يُقنّعها/يُفرّغها).
--      ولا يُمنح أي وصول إلى medical_records / diagnoses إطلاقاً.
-- =====================================================================

-- يستخدمه دور: receptionist
CREATE OR REPLACE VIEW v_patients_reception AS
SELECT
    p.id,
    p.medical_record_number,
    p.first_name,
    p.last_name,
    mask_national_id(p.national_id) AS national_id,   -- مُقنّع جزئياً ('**********78')
    p.gender,
    p.date_of_birth,
    mask_phone(p.phone)             AS phone,          -- مُقنّع جزئياً ('*******4567')
    mask_email(p.email)             AS email,
    NULL::text                      AS address,        -- مُخفى تماماً عن الاستقبال
    p.emergency_contact_name,
    mask_phone(p.emergency_contact_phone) AS emergency_contact_phone
FROM patients p;

COMMENT ON VIEW v_patients_reception IS
'بيانات المرضى لموظّف الاستقبال: هاتف/رقم وطني مُقنّع، عنوان مُخفى، بلا أي بيانات سريرية.';


-- view مواعيد الاستقبال: ما يلزم للجدولة فقط، دون سبب طبّي مفصّل حسّاس
-- يستخدمه دور: receptionist
CREATE OR REPLACE VIEW v_appointments_reception AS
SELECT
    a.id,
    a.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    a.doctor_id,
    s.first_name || ' ' || s.last_name AS doctor_name,
    a.department_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.reason                          -- سبب الموعد إداري (الاستقبال يحتاجه للجدولة)
FROM appointments a
JOIN patients p ON p.id = a.patient_id
JOIN doctors  d ON d.id = a.doctor_id
JOIN staff    s ON s.id = d.staff_id;

COMMENT ON VIEW v_appointments_reception IS
'مواعيد للاستقبال: أسماء المريض والطبيب وزمن الموعد وحالته، دون بيانات سريرية.';


-- view الفوترة للاستقبال: حالة الفاتورة فقط دون تفاصيل الدفعات
-- يستخدمه دور: receptionist
CREATE OR REPLACE VIEW v_invoices_reception AS
SELECT
    i.id,
    i.invoice_number,
    i.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    i.appointment_id,
    i.total_amount,
    i.status,                          -- unpaid / partially_paid / paid
    i.issued_at,
    i.due_date
FROM invoices i
JOIN patients p ON p.id = i.patient_id;

COMMENT ON VIEW v_invoices_reception IS
'فواتير للاستقبال: الإجمالي والحالة فقط، دون تفاصيل المدفوعات (method/reference_no).';


-- =====================================================================
--  (3) view الممرّض (role_nurse)
--      الغرض: الرعاية السريرية (الشكوى، العلامات الحيوية، الوصفات).
--      يُخفي: الرقم الوطني والعنوان والبيانات المالية.
--      ملاحظة: examination_notes تُعتبر حسّاسة (تخصّ الطبيب) فتُحجب عن الممرّض.
-- =====================================================================

-- view مرضى للممرّض: بيانات سريرية أساسية بلا مُعرّفات وطنية/عنوان
-- يستخدمه دور: nurse
CREATE OR REPLACE VIEW v_patients_nurse AS
SELECT
    p.id,
    p.medical_record_number,
    p.first_name,
    p.last_name,
    p.gender,
    p.date_of_birth,
    p.blood_type,                     -- مهم للرعاية التمريضية
    mask_phone(p.phone) AS phone,
    NULL::text          AS national_id,   -- مُخفى
    NULL::text          AS address,       -- مُخفى
    p.emergency_contact_name,
    p.emergency_contact_phone             -- يحتاجه الممرّض كاملاً للطوارئ
FROM patients p;

COMMENT ON VIEW v_patients_nurse IS
'مرضى للممرّض: فصيلة الدم وجهة الطوارئ متاحة، الرقم الوطني والعنوان مُخفيان.';


-- view السجلّ الطبي للممرّض: الشكوى والعلامات الحيوية فقط (بلا ملاحظات الفحص)
-- يستخدمه دور: nurse
CREATE OR REPLACE VIEW v_medical_records_nurse AS
SELECT
    mr.id,
    mr.patient_id,
    mr.doctor_id,
    mr.appointment_id,
    mr.visit_date,
    mr.chief_complaint,               -- الشكوى الرئيسة لازمة للرعاية
    mr.vital_signs                    -- العلامات الحيوية (ضغط/نبض/حرارة)
    -- examination_notes مُستبعد عمداً: ملاحظات الفحص حسّاسة وتخصّ الطبيب
FROM medical_records mr;

COMMENT ON VIEW v_medical_records_nurse IS
'السجلّ الطبي للممرّض: الشكوى والعلامات الحيوية فقط، بدون examination_notes.';


-- view الوصفات للممرّض: ما يلزم لإعطاء الدواء (الجرعة والتكرار والتعليمات)
-- يستخدمه دور: nurse (وأيضاً pharmacist عبر منح منفصل أدناه)
CREATE OR REPLACE VIEW v_prescription_items_nurse AS
SELECT
    pi.id,
    pi.prescription_id,
    pr.patient_id,
    pr.status            AS prescription_status,
    m.name               AS medication_name,
    m.form,
    m.strength,
    pi.dosage,
    pi.frequency,
    pi.duration_days,
    pi.quantity,
    pi.instructions
FROM prescription_items pi
JOIN prescriptions pr ON pr.id = pi.prescription_id
JOIN medications  m  ON m.id  = pi.medication_id;

COMMENT ON VIEW v_prescription_items_nurse IS
'بنود الوصفة للممرّض/الصيدلي: اسم الدواء والجرعة والتعليمات لإعطاء العلاج.';


-- =====================================================================
--  (4) view الطبيب (role_doctor)
--      الغرض: عرض السجلّ السريري كاملاً (تشخيص، ملاحظات، فحوص).
--      تقييد الصفوف: مرضى الطبيب نفسه فقط — عبر ربط doctor_id بهوية الجلسة.
--      (الطبيب يرى الرقم الوطني كاملاً لأنه مخوّل سريرياً.)
-- =====================================================================

-- view السجلّ الطبي للطبيب: كامل الأعمدة، مقيّد بمرضى الطبيب الحالي
-- يستخدمه دور: doctor
CREATE OR REPLACE VIEW v_medical_records_doctor AS
SELECT mr.*
FROM medical_records mr
WHERE mr.doctor_id = (
    SELECT d.id
    FROM doctors d
    JOIN staff s ON s.id = d.staff_id
    JOIN users u ON u.staff_id = s.id
    WHERE u.id = current_user_id()
);

COMMENT ON VIEW v_medical_records_doctor IS
'السجلّ الطبي الكامل للطبيب، مقيّد بصفوف مرضى الطبيب الحالي (app.current_user_id).';


-- view التشخيصات للطبيب: مقيّد بسجلّات الطبيب الحالي
-- يستخدمه دور: doctor
CREATE OR REPLACE VIEW v_diagnoses_doctor AS
SELECT dg.*
FROM diagnoses dg
JOIN medical_records mr ON mr.id = dg.medical_record_id
WHERE mr.doctor_id = (
    SELECT d.id
    FROM doctors d
    JOIN staff s ON s.id = d.staff_id
    JOIN users u ON u.staff_id = s.id
    WHERE u.id = current_user_id()
);

COMMENT ON VIEW v_diagnoses_doctor IS
'تشخيصات الطبيب الحالي فقط (مرتبطة بسجلّاته الطبية).';


-- =====================================================================
--  (5) view فنّي المختبر (role_lab_tech)
--      الغرض: تنفيذ طلبات الفحص وإدخال النتائج.
--      يرى: المريض (اسم/رقم ملف فقط)، نوع الفحص، الحالة، النتيجة.
--      لا يرى: تشخيص المريض ولا ملاحظات الطبيب ولا مُعرّفاته الوطنية/المالية.
-- =====================================================================

-- يستخدمه دور: lab_technician
CREATE OR REPLACE VIEW v_lab_orders_lab_tech AS
SELECT
    lo.id,
    lo.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    p.medical_record_number,
    lo.lab_test_id,
    lt.name        AS test_name,
    lt.category,
    lt.reference_range,
    lt.unit,
    lo.status,
    lo.result_value,
    lo.result_notes,
    lo.ordered_at,
    lo.resulted_at
    -- بلا ordered_by_doctor_id details ولا تشخيص؛ فنّي المختبر لا يحتاجها
FROM lab_orders lo
JOIN patients  p  ON p.id  = lo.patient_id
JOIN lab_tests lt ON lt.id = lo.lab_test_id;

COMMENT ON VIEW v_lab_orders_lab_tech IS
'طلبات الفحص لفنّي المختبر: المريض ونوع الفحص والنتيجة، دون تشخيص أو بيانات مالية.';


-- =====================================================================
--  (6) view الصيدلي (role_pharmacist)
--      الغرض: صرف الأدوية حسب الوصفات.
--      يرى: المريض (اسم/رقم ملف)، الوصفة وبنودها وحالتها، مخزون الدواء.
--      لا يرى: التشخيص الكامل ولا الملاحظات السريرية ولا المُعرّفات الوطنية.
-- =====================================================================

-- يستخدمه دور: pharmacist
CREATE OR REPLACE VIEW v_prescriptions_pharmacist AS
SELECT
    pr.id              AS prescription_id,
    pr.patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    p.medical_record_number,
    pr.doctor_id,
    pr.issued_at,
    pr.status,
    pi.id              AS item_id,
    m.name             AS medication_name,
    m.form,
    m.strength,
    m.stock_quantity,                 -- يحتاجه الصيدلي للصرف
    pi.dosage,
    pi.frequency,
    pi.duration_days,
    pi.quantity,
    pi.instructions
FROM prescriptions      pr
JOIN patients           p  ON p.id  = pr.patient_id
JOIN prescription_items pi ON pi.prescription_id = pr.id
JOIN medications        m  ON m.id  = pi.medication_id;

COMMENT ON VIEW v_prescriptions_pharmacist IS
'وصفات الصيدلي للصرف: المريض والأدوية والجرعات والمخزون، دون تشخيص أو ملاحظات سريرية.';


-- =====================================================================
--  (7) بوابة المريض (role_patient)
--      الغرض: يرى المريض بياناته هو فقط (تقييد صفوف صارم).
--      التقييد: patient_id المرتبط بالمستخدم الحالي عبر users.patient_id.
--      إخفاء الحقول الإدارية الداخلية (created_by وتفاصيل الموظّفين).
-- =====================================================================

-- view بيانات المريض الشخصية (سجلّ المريض نفسه فقط، بلا تقنيع لأنها بياناته)
-- يستخدمه دور: patient
CREATE OR REPLACE VIEW v_my_patient_profile AS
SELECT
    p.id,
    p.medical_record_number,
    p.first_name,
    p.last_name,
    p.national_id,                    -- بياناته هو، تظهر كاملة
    p.gender,
    p.date_of_birth,
    p.blood_type,
    p.phone,
    p.email,
    p.address,
    p.emergency_contact_name,
    p.emergency_contact_phone
FROM patients p
WHERE p.id = (SELECT u.patient_id FROM users u WHERE u.id = current_user_id());

COMMENT ON VIEW v_my_patient_profile IS
'الملف الشخصي لبوابة المريض: صفّ المريض المرتبط بالمستخدم الحالي فقط.';


-- view مواعيد المريض نفسه
-- يستخدمه دور: patient
CREATE OR REPLACE VIEW v_my_appointments AS
SELECT
    a.id,
    a.doctor_id,
    s.first_name || ' ' || s.last_name AS doctor_name,
    a.department_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.reason
    -- created_by مُخفى: حقل إداري داخلي لا يخصّ المريض
FROM appointments a
JOIN doctors d ON d.id = a.doctor_id
JOIN staff   s ON s.id = d.staff_id
WHERE a.patient_id = (SELECT u.patient_id FROM users u WHERE u.id = current_user_id());

COMMENT ON VIEW v_my_appointments IS
'مواعيد بوابة المريض: مواعيد المستخدم الحالي فقط، دون الحقول الإدارية (created_by).';


-- view وصفات المريض نفسه (قراءة فقط لما وصفه له الطبيب)
-- يستخدمه دور: patient
CREATE OR REPLACE VIEW v_my_prescriptions AS
SELECT
    pr.id            AS prescription_id,
    pr.issued_at,
    pr.status,
    m.name           AS medication_name,
    m.form,
    m.strength,
    pi.dosage,
    pi.frequency,
    pi.duration_days,
    pi.instructions
FROM prescriptions      pr
JOIN prescription_items pi ON pi.prescription_id = pr.id
JOIN medications        m  ON m.id  = pi.medication_id
WHERE pr.patient_id = (SELECT u.patient_id FROM users u WHERE u.id = current_user_id());

COMMENT ON VIEW v_my_prescriptions IS
'وصفات بوابة المريض: أدوية المستخدم الحالي وجرعاتها فقط.';


-- view فواتير المريض نفسه (الإجمالي والحالة، دون تفاصيل المدفوعات الداخلية)
-- يستخدمه دور: patient
CREATE OR REPLACE VIEW v_my_invoices AS
SELECT
    i.id,
    i.invoice_number,
    i.total_amount,
    i.status,
    i.issued_at,
    i.due_date
    -- created_by مُخفى
FROM invoices i
WHERE i.patient_id = (SELECT u.patient_id FROM users u WHERE u.id = current_user_id());

COMMENT ON VIEW v_my_invoices IS
'فواتير بوابة المريض: فواتير المستخدم الحالي (إجمالي وحالة) دون تفاصيل داخلية.';


-- =====================================================================
--  (8) دالة قراءة آمنة موحّدة للأدوار الدنيا
--      تختار شكل بيانات المرضى المناسب بحسب الدور المضبوط في app.current_role.
--      تبسّط استدعاء التطبيق: SELECT * FROM fn_safe_patients();
--      وتُرجِع نفس الشكل الأعمدي بصرف النظر عن الدور (مع تقنيع مناسب).
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_safe_patients()
RETURNS TABLE (
    id                      BIGINT,
    medical_record_number   VARCHAR,
    first_name              VARCHAR,
    last_name               VARCHAR,
    national_id             TEXT,
    gender                  CHAR,
    date_of_birth           DATE,
    phone                   TEXT
) AS $$
DECLARE
    v_role TEXT := current_setting('app.current_role', true);
BEGIN
    -- الأدمن والطبيب: بيانات كاملة (الطبيب مخوّل سريرياً)
    IF v_role IN ('admin', 'doctor') THEN
        RETURN QUERY
            SELECT p.id, p.medical_record_number, p.first_name, p.last_name,
                   p.national_id::text, p.gender, p.date_of_birth, p.phone::text
            FROM patients p;

    -- الممرّض/الصيدلي/فنّي المختبر: بلا رقم وطني، هاتف مُقنّع
    ELSIF v_role IN ('nurse', 'pharmacist', 'lab_technician') THEN
        RETURN QUERY
            SELECT p.id, p.medical_record_number, p.first_name, p.last_name,
                   NULL::text, p.gender, p.date_of_birth, mask_phone(p.phone)
            FROM patients p;

    -- الاستقبال: رقم وطني وهاتف مُقنّعان
    ELSIF v_role = 'receptionist' THEN
        RETURN QUERY
            SELECT p.id, p.medical_record_number, p.first_name, p.last_name,
                   mask_national_id(p.national_id), p.gender, p.date_of_birth, mask_phone(p.phone)
            FROM patients p;

    -- المريض: صفّه هو فقط، بياناته كاملة
    ELSIF v_role = 'patient' THEN
        RETURN QUERY
            SELECT p.id, p.medical_record_number, p.first_name, p.last_name,
                   p.national_id::text, p.gender, p.date_of_birth, p.phone::text
            FROM patients p
            WHERE p.id = (SELECT u.patient_id FROM users u WHERE u.id = current_user_id());

    -- دور غير معروف: لا تُرجِع شيئاً (افتراض المنع الآمن)
    ELSE
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_safe_patients() IS
'قراءة آمنة موحّدة لبيانات المرضى تُطبّق التقنيع/التقييد تلقائياً حسب app.current_role.';


-- =====================================================================
--  (9) منح الصلاحيات وسحبها (GRANT / REVOKE)
--      القاعدة: تُسحب SELECT المباشرة عن الجداول الحسّاسة من الأدوار الدنيا،
--      وتُمنح SELECT على الـ views المخصّصة لكل دور فقط.
-- =====================================================================

-- (9-1) سحب الوصول المباشر للجداول الحسّاسة عن الأدوار الدنيا
-- الاستقبال: ممنوع منه تماماً السجلّ الطبي والتشخيص والوصفات والمدفوعات
REVOKE ALL ON patients, medical_records, diagnoses, prescriptions,
              prescription_items, lab_orders, payments
       FROM role_receptionist;

-- الممرّض: ممنوع منه التشخيص والمالية والمُعرّفات الوطنية المباشرة
REVOKE ALL ON diagnoses, invoices, invoice_items, payments
       FROM role_nurse;

-- فنّي المختبر: ممنوع منه التشخيص والسجلّ الطبي الكامل والمالية
REVOKE ALL ON medical_records, diagnoses, prescriptions,
              invoices, invoice_items, payments
       FROM role_lab_tech;

-- الصيدلي: ممنوع منه التشخيص والسجلّ الطبي الكامل والمالية
REVOKE ALL ON medical_records, diagnoses, lab_orders,
              invoices, invoice_items, payments
       FROM role_pharmacist;

-- المريض: لا يصل لأي جدول مباشرة — عبر views بوابته فقط
REVOKE ALL ON patients, medical_records, diagnoses, prescriptions,
              prescription_items, lab_orders, appointments,
              invoices, invoice_items, payments
       FROM role_patient;

-- (9-2) منح SELECT على الـ views لكل دور حسب حاجته
-- الاستقبال
GRANT SELECT ON v_patients_reception, v_appointments_reception, v_invoices_reception
       TO role_receptionist;

-- الممرّض
GRANT SELECT ON v_patients_nurse, v_medical_records_nurse, v_prescription_items_nurse
       TO role_nurse;

-- الطبيب (views مقيّدة بمرضاه)
GRANT SELECT ON v_medical_records_doctor, v_diagnoses_doctor
       TO role_doctor;

-- فنّي المختبر
GRANT SELECT ON v_lab_orders_lab_tech
       TO role_lab_tech;

-- الصيدلي
GRANT SELECT ON v_prescriptions_pharmacist, v_prescription_items_nurse
       TO role_pharmacist;

-- المريض (بوابة المريض)
GRANT SELECT ON v_my_patient_profile, v_my_appointments,
                v_my_prescriptions, v_my_invoices
       TO role_patient;

-- (9-3) منح تنفيذ دوال القراءة الآمنة والتقنيع لكل الأدوار
GRANT EXECUTE ON FUNCTION fn_safe_patients()     TO role_receptionist, role_nurse,
                          role_doctor, role_lab_tech, role_pharmacist, role_patient, role_admin;
GRANT EXECUTE ON FUNCTION mask_phone(TEXT)       TO PUBLIC;
GRANT EXECUTE ON FUNCTION mask_national_id(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION mask_email(TEXT)       TO PUBLIC;


-- =====================================================================
--  ملاحظة الترقية المستقبلية (للمناقشة فقط):
--    البديل المؤسسي الأقوى هو Row Level Security (RLS) عبر CREATE POLICY
--    على الجداول مباشرة، وهو أصعب تجاوزاً لكنه يتطلّب أدوار DB حقيقية
--    متعددة الاتصالات. نهج الـ views هنا أبسط وأوضح لمشروع طالب باتصال
--    تطبيق واحد، ويعتمد على ضبط التطبيق لـ app.current_role / app.current_user_id
--    داخل كل معاملة.
--
--  نهاية ملف إخفاء وتقنيع البيانات
-- =====================================================================
