-- =====================================================================
--  نظام قاعدة بيانات مستشفى آمن مع RBAC
--  الملف: 05_seed.sql  — بيانات تجريبية واقعية (Seed Data)
--  المنصّة: PostgreSQL
--
--  يفترض هذا الملف أن المخطّط (01_schema.sql) قد نُفّذ مسبقاً،
--  وأن امتداد pgcrypto مفعّل (لاستعمال crypt/gen_salt في تجزئة كلمات المرور).
--
--  مبادئ التعبئة:
--    - كل الروابط بين الجداول تُحَلّ عبر subqueries (SELECT id FROM ... WHERE ...)
--      لا أرقاماً ثابتة هشّة، لتبقى البيانات صحيحة مهما تغيّرت المعرّفات.
--    - بيانات منطقية متّسقة: تواريخ معقولة، مفاتيح أجنبية صحيحة، حالات سليمة.
--    - كلمة مرور كل المستخدمين التجريبيين: 'Passw0rd!' (مجزّأة بـ bcrypt).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;


-- =====================================================================
--  (1) الأدوار (roles) — مُدارة حصراً في 02_rbac_rls.sql
-- =====================================================================
--  محذوف عمداً: الأدوار السبعة تُدرَج في 02_rbac_rls.sql (مصدر الحقيقة الوحيد).
--  إدراجها هنا ثانيةً يخالف قيد roles_name_key ويُجهض صفقة الـseed كاملةً
--  (كان السبب الجذري لفشل CI: لم تُدرَج staff/users/patients إطلاقاً).


-- =====================================================================
--  (2) الصلاحيات والأدوار — مُدارة حصراً في 02_rbac_rls.sql
-- =====================================================================
--  تحذير: لا تُدرج هنا أي سجلات في جدولَي permissions أو role_permissions.
--  02_rbac_rls.sql هو مصدر الحقيقة الوحيد لرموز الصلاحيات وربط الأدوار.
--  إدراجها هنا كان يُنشئ رموزاً مغايرة (مثل patients:write, users:manage,
--  lab_orders:result) تتعارض مع الرموز الدقيقة الموحَّدة في 02_rbac_rls.sql
--  (patients:create/update, users:read/create/update/delete, lab_orders:update ...).
-- =====================================================================


-- =====================================================================
--  (3) ربط الصلاحيات بالأدوار — مُدار حصراً في 02_rbac_rls.sql
-- =====================================================================
--  محذوف عمداً: كان يُنشئ ربطاً مكرّراً/متعارضاً مع 02_rbac_rls.sql.
-- =====================================================================


-- =====================================================================
--  (4) الأقسام (departments)
--      نُنشئها أولاً بلا رئيس قسم، ثم نُسند head_staff_id بعد إنشاء الموظفين.
-- =====================================================================
INSERT INTO departments (name, location, phone) VALUES
    ('الباطنية',  'الطابق الأول - جناح A',  '07700000101'),
    ('الجراحة',   'الطابق الثاني - جناح B', '07700000102'),
    ('المختبر',   'الطابق الأرضي - جناح C', '07700000103');


-- =====================================================================
--  (5) الموظفون (staff) — 3 أطباء + 2 ممرّضين + استقبال + فنّي مختبر + صيدلي + admin
--      department_id يُحَلّ عبر subquery على اسم القسم.
-- =====================================================================

-- (5-أ) الأطباء الثلاثة
INSERT INTO staff (first_name, last_name, national_id, gender, date_of_birth, phone, email, staff_type, department_id, hire_date) VALUES
    ('أحمد',  'العزاوي',  '19800101001', 'M', '1980-01-01', '07710000001', 'ahmed.azzawi@hospital.iq',  'doctor', (SELECT id FROM departments WHERE name = 'الباطنية'), '2015-03-01'),
    ('سارة',  'الجبوري',  '19850202002', 'F', '1985-02-02', '07710000002', 'sara.jabouri@hospital.iq',  'doctor', (SELECT id FROM departments WHERE name = 'الجراحة'),  '2017-09-15'),
    ('علي',   'الموسوي',  '19780303003', 'M', '1978-03-03', '07710000003', 'ali.mousawi@hospital.iq',   'doctor', (SELECT id FROM departments WHERE name = 'الباطنية'), '2012-06-10');

-- (5-ب) الممرّضان
INSERT INTO staff (first_name, last_name, national_id, gender, date_of_birth, phone, email, staff_type, department_id, hire_date) VALUES
    ('زينب',  'الحسيني',  '19900404004', 'F', '1990-04-04', '07710000004', 'zainab.husseini@hospital.iq', 'nurse', (SELECT id FROM departments WHERE name = 'الباطنية'), '2019-01-20'),
    ('حسن',   'الكناني',  '19920505005', 'M', '1992-05-05', '07710000005', 'hassan.kanani@hospital.iq',   'nurse', (SELECT id FROM departments WHERE name = 'الجراحة'),  '2020-11-05');

-- (5-ج) موظف الاستقبال + فنّي المختبر + الصيدلي + الأدمن
INSERT INTO staff (first_name, last_name, national_id, gender, date_of_birth, phone, email, staff_type, department_id, hire_date) VALUES
    ('مريم',  'العبيدي',  '19950606006', 'F', '1995-06-06', '07710000006', 'mariam.obeidi@hospital.iq',  'receptionist',   (SELECT id FROM departments WHERE name = 'الباطنية'), '2021-02-14'),
    ('عمر',   'الدليمي',  '19930707007', 'M', '1993-07-07', '07710000007', 'omar.dulaimi@hospital.iq',   'lab_technician', (SELECT id FROM departments WHERE name = 'المختبر'),  '2018-08-01'),
    ('نور',   'الزبيدي',  '19940808008', 'F', '1994-08-08', '07710000008', 'noor.zubaidi@hospital.iq',   'pharmacist',     (SELECT id FROM departments WHERE name = 'الباطنية'), '2019-05-22'),
    ('كرار',  'التميمي',  '19820909009', 'M', '1982-09-09', '07710000009', 'karrar.tamimi@hospital.iq',  'admin',          (SELECT id FROM departments WHERE name = 'الباطنية'), '2010-01-01');


-- إسناد رؤساء الأقسام بعد إنشاء الموظفين (head_staff_id عبر subquery)
UPDATE departments
SET head_staff_id = (SELECT id FROM staff WHERE national_id = '19780303003')  -- علي الموسوي
WHERE name = 'الباطنية';

UPDATE departments
SET head_staff_id = (SELECT id FROM staff WHERE national_id = '19850202002')  -- سارة الجبوري
WHERE name = 'الجراحة';

UPDATE departments
SET head_staff_id = (SELECT id FROM staff WHERE national_id = '19930707007')  -- عمر الدليمي (فنّي المختبر)
WHERE name = 'المختبر';


-- =====================================================================
--  (6) الأطباء (doctors) — امتداد 1:1 على staff عبر staff_id (subquery)
-- =====================================================================
INSERT INTO doctors (staff_id, specialty, license_number, years_of_experience, consultation_fee) VALUES
    ((SELECT id FROM staff WHERE national_id = '19800101001'), 'أمراض باطنية',  'DOC-1001', 12, 25000.00),
    ((SELECT id FROM staff WHERE national_id = '19850202002'), 'جراحة عامة',    'DOC-1002',  9, 35000.00),
    ((SELECT id FROM staff WHERE national_id = '19780303003'), 'أمراض القلب',   'DOC-1003', 18, 40000.00);


-- =====================================================================
--  (7) الممرّضون (nurses) — امتداد 1:1 على staff
-- =====================================================================
INSERT INTO nurses (staff_id, license_number, shift, ward) VALUES
    ((SELECT id FROM staff WHERE national_id = '19900404004'), 'NUR-2001', 'morning', 'جناح الباطنية A'),
    ((SELECT id FROM staff WHERE national_id = '19920505005'), 'NUR-2002', 'evening', 'جناح الجراحة B');


-- =====================================================================
--  (8) المرضى (patients) — 8 مرضى بأسماء عربية واقعية مع MRN
-- =====================================================================
INSERT INTO patients (medical_record_number, first_name, last_name, national_id, gender, date_of_birth, blood_type, phone, email, address, emergency_contact_name, emergency_contact_phone) VALUES
    ('MRN-000001', 'محمد',   'الساعدي',  '19751010010', 'M', '1975-10-10', 'O+',  '07801000001', 'mohammed.saadi@mail.iq',  'بغداد - الكرادة',     'فاطمة الساعدي',  '07801000101'),
    ('MRN-000002', 'فاطمة',  'الخفاجي',  '19881111011', 'F', '1988-11-11', 'A+',  '07801000002', 'fatima.khafaji@mail.iq',  'بغداد - المنصور',     'حيدر الخفاجي',   '07801000102'),
    ('MRN-000003', 'حيدر',   'الربيعي',  '19920212012', 'M', '1992-02-12', 'B+',  '07801000003', 'haidar.rabiei@mail.iq',   'بغداد - زيونة',       'زهراء الربيعي',  '07801000103'),
    ('MRN-000004', 'زهراء',  'العامري',  '19990313013', 'F', '1999-03-13', 'AB+', '07801000004', 'zahraa.amiri@mail.iq',    'بغداد - الجادرية',    'عباس العامري',   '07801000104'),
    ('MRN-000005', 'عباس',   'الشمري',   '19680414014', 'M', '1968-04-14', 'O-',  '07801000005', 'abbas.shammari@mail.iq',  'بغداد - الأعظمية',    'سجى الشمري',     '07801000105'),
    ('MRN-000006', 'سجى',    'البياتي',  '20010515015', 'F', '2001-05-15', 'A-',  '07801000006', 'saja.bayati@mail.iq',     'بغداد - الكاظمية',    'ليث البياتي',    '07801000106'),
    ('MRN-000007', 'ليث',    'الجنابي',  '19830616016', 'M', '1983-06-16', 'B-',  '07801000007', 'laith.janabi@mail.iq',    'بغداد - الدورة',      'رغد الجنابي',    '07801000107'),
    ('MRN-000008', 'رغد',    'الطائي',   '19960717017', 'F', '1996-07-17', 'O+',  '07801000008', 'raghad.taei@mail.iq',     'بغداد - الغزالية',    'مصطفى الطائي',   '07801000108');


-- =====================================================================
--  (9) المستخدمون (users) — حساب لكل موظّف + حساب بوابة لمريضين
--      password_hash = bcrypt للكلمة 'Passw0rd!' عبر crypt + gen_salt('bf').
--      staff_id / patient_id يُحَلّان عبر subqueries.
-- =====================================================================

-- (9-أ) حسابات الموظفين
INSERT INTO users (username, email, password_hash, staff_id) VALUES
    ('dr.ahmed',    'ahmed.azzawi@hospital.iq',   crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19800101001')),
    ('dr.sara',     'sara.jabouri@hospital.iq',   crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19850202002')),
    ('dr.ali',      'ali.mousawi@hospital.iq',    crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19780303003')),
    ('nurse.zainab','zainab.husseini@hospital.iq',crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19900404004')),
    ('nurse.hassan','hassan.kanani@hospital.iq',  crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19920505005')),
    ('reception.mariam','mariam.obeidi@hospital.iq', crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19950606006')),
    ('lab.omar',    'omar.dulaimi@hospital.iq',   crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19930707007')),
    ('pharma.noor', 'noor.zubaidi@hospital.iq',   crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19940808008')),
    ('admin.karrar','karrar.tamimi@hospital.iq',  crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM staff WHERE national_id = '19820909009'));

-- (9-ب) حسابات بوابة المريض (مريضان لهما حساب دخول)
INSERT INTO users (username, email, password_hash, patient_id) VALUES
    ('patient.mohammed', 'mohammed.saadi@mail.iq', crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001')),
    ('patient.fatima',   'fatima.khafaji@mail.iq', crypt('Passw0rd!', gen_salt('bf')), (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002'));


-- =====================================================================
--  (10) إسناد الأدوار للمستخدمين (user_roles) — عبر subqueries بالاسم
-- =====================================================================
INSERT INTO user_roles (user_id, role_id) VALUES
    ((SELECT id FROM users WHERE username = 'dr.ahmed'),        (SELECT id FROM roles WHERE name = 'doctor')),
    ((SELECT id FROM users WHERE username = 'dr.sara'),         (SELECT id FROM roles WHERE name = 'doctor')),
    ((SELECT id FROM users WHERE username = 'dr.ali'),          (SELECT id FROM roles WHERE name = 'doctor')),
    ((SELECT id FROM users WHERE username = 'nurse.zainab'),    (SELECT id FROM roles WHERE name = 'nurse')),
    ((SELECT id FROM users WHERE username = 'nurse.hassan'),    (SELECT id FROM roles WHERE name = 'nurse')),
    ((SELECT id FROM users WHERE username = 'reception.mariam'),(SELECT id FROM roles WHERE name = 'receptionist')),
    ((SELECT id FROM users WHERE username = 'lab.omar'),        (SELECT id FROM roles WHERE name = 'lab_technician')),
    ((SELECT id FROM users WHERE username = 'pharma.noor'),     (SELECT id FROM roles WHERE name = 'pharmacist')),
    ((SELECT id FROM users WHERE username = 'admin.karrar'),    (SELECT id FROM roles WHERE name = 'admin')),
    ((SELECT id FROM users WHERE username = 'patient.mohammed'),(SELECT id FROM roles WHERE name = 'patient')),
    ((SELECT id FROM users WHERE username = 'patient.fatima'),  (SELECT id FROM roles WHERE name = 'patient'));


-- =====================================================================
--  (11) المواعيد (appointments) — 6 مواعيد
--      doctor_id عبر license_number، patient_id عبر MRN، created_by حساب الاستقبال.
-- =====================================================================
INSERT INTO appointments (patient_id, doctor_id, department_id, scheduled_at, duration_minutes, status, reason, created_by) VALUES
    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000001'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1001'),
     (SELECT id FROM departments WHERE name = 'الباطنية'),
     '2026-06-20 09:00:00+03', 30, 'completed', 'ألم في المعدة وحموضة', (SELECT id FROM users WHERE username = 'reception.mariam')),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000002'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1003'),
     (SELECT id FROM departments WHERE name = 'الباطنية'),
     '2026-06-20 10:00:00+03', 30, 'completed', 'خفقان وارتفاع ضغط', (SELECT id FROM users WHERE username = 'reception.mariam')),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000003'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1002'),
     (SELECT id FROM departments WHERE name = 'الجراحة'),
     '2026-06-21 11:00:00+03', 45, 'completed', 'تقييم قبل عملية الزائدة', (SELECT id FROM users WHERE username = 'reception.mariam')),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000004'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1001'),
     (SELECT id FROM departments WHERE name = 'الباطنية'),
     '2026-06-22 09:30:00+03', 30, 'completed', 'حرارة وسعال مستمر', (SELECT id FROM users WHERE username = 'reception.mariam')),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000005'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1003'),
     (SELECT id FROM departments WHERE name = 'الباطنية'),
     '2026-07-02 12:00:00+03', 30, 'scheduled', 'مراجعة دورية للضغط', (SELECT id FROM users WHERE username = 'reception.mariam')),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000006'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1002'),
     (SELECT id FROM departments WHERE name = 'الجراحة'),
     '2026-07-03 10:30:00+03', 30, 'scheduled', 'استشارة جراحية', (SELECT id FROM users WHERE username = 'reception.mariam'));


-- =====================================================================
--  (12) السجلات الطبية (medical_records) — 4 سجلات للمواعيد المكتملة
--      مرتبطة بالمريض والطبيب والموعد عبر subqueries.
-- =====================================================================
INSERT INTO medical_records (patient_id, doctor_id, appointment_id, visit_date, chief_complaint, examination_notes, vital_signs) VALUES
    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000001'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1001'),
     (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001')
        AND scheduled_at = '2026-06-20 09:00:00+03'),
     '2026-06-20 09:10:00+03',
     'ألم شرسوفي وحموضة بعد الأكل',
     'البطن لين غير مؤلم عند الجس، لا علامات إنذار. يُرجّح التهاب معدة.',
     '{"bp":"120/80","pulse":78,"temp":36.8}'),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000002'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1003'),
     (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002')
        AND scheduled_at = '2026-06-20 10:00:00+03'),
     '2026-06-20 10:15:00+03',
     'خفقان وارتفاع في ضغط الدم',
     'ضغط مرتفع، أصوات القلب طبيعية. يُطلب تخطيط ومتابعة.',
     '{"bp":"150/95","pulse":92,"temp":36.6}'),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000003'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1002'),
     (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000003')
        AND scheduled_at = '2026-06-21 11:00:00+03'),
     '2026-06-21 11:20:00+03',
     'ألم في أسفل البطن الأيمن',
     'إيلام عند نقطة ماكبرني، اشتباه التهاب زائدة دودية. يُطلب فحص دم.',
     '{"bp":"118/76","pulse":98,"temp":38.1}'),

    ((SELECT id FROM patients WHERE medical_record_number = 'MRN-000004'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1001'),
     (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000004')
        AND scheduled_at = '2026-06-22 09:30:00+03'),
     '2026-06-22 09:40:00+03',
     'حرارة وسعال منذ ثلاثة أيام',
     'احتقان بالحلق وأصوات تنفسية خشنة. يُرجّح التهاب قصبات.',
     '{"bp":"110/70","pulse":88,"temp":38.5}');


-- =====================================================================
--  (13) التشخيصات (diagnoses) — تشخيص لكل سجلّ طبي (subquery على المريض)
--      نربط السجلّ الطبي عبر مريضه الفريد.
-- =====================================================================
INSERT INTO diagnoses (medical_record_id, icd10_code, description, diagnosis_type) VALUES
    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001')),
     'K29.7', 'التهاب المعدة غير محدد', 'primary'),

    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002')),
     'I10', 'ارتفاع ضغط الدم الأساسي', 'primary'),

    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000003')),
     'K35.80', 'التهاب الزائدة الدودية الحاد', 'provisional'),

    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000004')),
     'J20.9', 'التهاب القصبات الحاد غير محدد', 'primary');


-- =====================================================================
--  (14) كتالوج الأدوية (medications) — 5 أدوية
-- =====================================================================
INSERT INTO medications (name, generic_name, form, strength, manufacturer, unit_price, stock_quantity) VALUES
    ('أوميبرازول', 'Omeprazole',    'tablet',    '20mg',  'سامراء للأدوية', 250.00, 500),
    ('أملوديبين',  'Amlodipine',    'tablet',    '5mg',   'NDI',            300.00, 400),
    ('أموكسيسيلين','Amoxicillin',   'capsule',   '500mg', 'بايونير',        150.00, 800),
    ('باراسيتامول','Paracetamol',   'tablet',    '500mg', 'سامراء للأدوية', 100.00, 1000),
    ('ديكلوفيناك', 'Diclofenac',    'injection', '75mg',  'الكندي',         350.00, 200);


-- =====================================================================
--  (15) الوصفات (prescriptions) — 3 وصفات
--      مرتبطة بالسجلّ الطبي والمريض والطبيب عبر subqueries.
-- =====================================================================
INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, status, notes) VALUES
    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001')),
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1001'),
     'active', 'تُؤخذ الأدوية قبل الأكل بنصف ساعة'),

    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002')),
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1003'),
     'active', 'متابعة الضغط يومياً وتسجيل القراءات'),

    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000004')),
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000004'),
     (SELECT id FROM doctors  WHERE license_number = 'DOC-1001'),
     'dispensed', 'إكمال كورس المضاد الحيوي كاملاً');


-- =====================================================================
--  (16) بنود الوصفات (prescription_items)
--      prescription_id يُحَلّ عبر مريض الوصفة؛ medication_id عبر الاسم العام.
-- =====================================================================

-- وصفة المريض الأول (التهاب معدة): أوميبرازول
INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity, instructions) VALUES
    ((SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001')),
     (SELECT id FROM medications WHERE generic_name = 'Omeprazole'),
     'حبة واحدة', 'مرة يومياً', 14, 14, 'قبل الفطور بنصف ساعة');

-- وصفة المريض الثاني (ارتفاع ضغط): أملوديبين
INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity, instructions) VALUES
    ((SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002')),
     (SELECT id FROM medications WHERE generic_name = 'Amlodipine'),
     'حبة واحدة', 'مرة يومياً', 30, 30, 'صباحاً بعد الأكل');

-- وصفة المريض الرابع (التهاب قصبات): أموكسيسيلين + باراسيتامول
INSERT INTO prescription_items (prescription_id, medication_id, dosage, frequency, duration_days, quantity, instructions) VALUES
    ((SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000004')),
     (SELECT id FROM medications WHERE generic_name = 'Amoxicillin'),
     'كبسولة واحدة', 'ثلاث مرات يومياً', 7, 21, 'بعد الأكل'),

    ((SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000004')),
     (SELECT id FROM medications WHERE generic_name = 'Paracetamol'),
     'حبة واحدة', 'عند الحاجة للحرارة', 5, 10, 'بحد أقصى 4 حبات يومياً');


-- =====================================================================
--  (17) كتالوج الفحوص المختبرية (lab_tests) — مرجع لطلبات الفحص
-- =====================================================================
INSERT INTO lab_tests (name, category, reference_range, unit, price) VALUES
    ('تعداد الدم الكامل (CBC)', 'أمراض الدم',    '4.5 - 11.0', '10^3/µL', 5000.00),
    ('سكر الدم الصائم',        'الكيمياء الحيوية', '70 - 100',   'mg/dL',  3000.00);


-- =====================================================================
--  (18) طلبات الفحص (lab_orders) — 2 طلب
--      السجلّ الطبي/المريض عبر MRN، الطبيب الطالب عبر الترخيص،
--      المنفّذ هو فنّي المختبر (staff)، النوع عبر اسم الفحص.
-- =====================================================================

-- طلب فحص دم للمريض الثالث (اشتباه زائدة) — مكتمل ومُدخلة نتيجته
INSERT INTO lab_orders (medical_record_id, patient_id, lab_test_id, ordered_by_doctor_id, performed_by_staff_id, status, result_value, result_notes, resulted_at) VALUES
    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000003')),
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000003'),
     (SELECT id FROM lab_tests WHERE name = 'تعداد الدم الكامل (CBC)'),
     (SELECT id FROM doctors WHERE license_number = 'DOC-1002'),
     (SELECT id FROM staff WHERE national_id = '19930707007'),
     'completed', '14.2', 'ارتفاع في كريات الدم البيضاء يدعم الالتهاب', '2026-06-21 12:30:00+03');

-- طلب سكر صائم للمريض الثاني (متابعة) — قيد التنفيذ
INSERT INTO lab_orders (medical_record_id, patient_id, lab_test_id, ordered_by_doctor_id, performed_by_staff_id, status) VALUES
    ((SELECT id FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002')),
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000002'),
     (SELECT id FROM lab_tests WHERE name = 'سكر الدم الصائم'),
     (SELECT id FROM doctors WHERE license_number = 'DOC-1003'),
     (SELECT id FROM staff WHERE national_id = '19930707007'),
     'in_progress');


-- =====================================================================
--  (19) الفواتير (invoices) — 2 فاتورة
--      patient_id عبر MRN، appointment_id عبر الموعد، created_by الاستقبال.
-- =====================================================================
INSERT INTO invoices (invoice_number, patient_id, appointment_id, status, due_date, created_by) VALUES
    ('INV-2026-0001',
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001'),
     (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000001')
        AND scheduled_at = '2026-06-20 09:00:00+03'),
     'paid', '2026-06-27', (SELECT id FROM users WHERE username = 'reception.mariam')),

    ('INV-2026-0002',
     (SELECT id FROM patients WHERE medical_record_number = 'MRN-000003'),
     (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN-000003')
        AND scheduled_at = '2026-06-21 11:00:00+03'),
     'partially_paid', '2026-06-28', (SELECT id FROM users WHERE username = 'reception.mariam'));


-- =====================================================================
--  (20) بنود الفواتير (invoice_items) — line_total عمود محسوب تلقائياً
--      invoice_id يُحَلّ عبر invoice_number.
-- =====================================================================

-- بنود فاتورة المريض الأول: كشفية + دواء
INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price) VALUES
    ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0001'), 'consultation', 'كشفية طبيب باطنية', 1, 25000.00),
    ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0001'), 'medication',   'أوميبرازول 20mg',  14,  250.00);

-- بنود فاتورة المريض الثالث: كشفية جراحة + فحص مختبري
INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price) VALUES
    ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0002'), 'consultation', 'كشفية جراحة عامة',          1, 35000.00),
    ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0002'), 'lab_test',     'تعداد الدم الكامل (CBC)',  1,  5000.00);


-- تحديث إجمالي الفاتورة من مجموع بنودها (مشتق من line_total المحسوب)
UPDATE invoices i
SET total_amount = (SELECT COALESCE(SUM(ii.line_total), 0) FROM invoice_items ii WHERE ii.invoice_id = i.id)
WHERE i.invoice_number IN ('INV-2026-0001', 'INV-2026-0002');


-- =====================================================================
--  (21) المدفوعات (payments) — دفعة لكل فاتورة
--      الأولى مسددة بالكامل، الثانية مسددة جزئياً. received_by الاستقبال.
-- =====================================================================

-- سداد كامل لفاتورة المريض الأول (28500 = 25000 + 14×250)
INSERT INTO payments (invoice_id, amount, method, received_by, reference_no) VALUES
    ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0001'),
     28500.00, 'cash',
     (SELECT id FROM users WHERE username = 'reception.mariam'),
     'PAY-0001');

-- سداد جزئي لفاتورة المريض الثالث (دفعة 20000 من أصل 40000)
INSERT INTO payments (invoice_id, amount, method, received_by, reference_no) VALUES
    ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0002'),
     20000.00, 'card',
     (SELECT id FROM users WHERE username = 'reception.mariam'),
     'PAY-0002');


COMMIT;

-- =====================================================================
--  نهاية البيانات التجريبية
-- =====================================================================
