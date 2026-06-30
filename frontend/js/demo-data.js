/* =====================================================================
   demo-data.js — وضع العرض التجريبي (Demo Mode)
   يُحاكي الـ backend كاملاً داخل المتصفّح بدون أي شبكة.
   المصدر: database/05_seed.sql
   كلمة المرور الموحّدة: Passw0rd!
   ===================================================================== */

(function (global) {
  'use strict';

  /* ── ثوابت ────────────────────────────────────────────────────────── */
  var DEMO_PASSWORD = 'Passw0rd!';

  /* ── بيانات المستخدمين (مستمدّة من seed: users + staff + roles) ── */
  var USERS = [
    {
      id: 'u-001', username: 'dr.ahmed', email: 'ahmed.azzawi@hospital.iq',
      full_name: 'أحمد العزاوي', is_active: true,
      roles: ['doctor'],
      staff_id: 's-001', patient_id: null,
    },
    {
      id: 'u-002', username: 'dr.sara', email: 'sara.jabouri@hospital.iq',
      full_name: 'سارة الجبوري', is_active: true,
      roles: ['doctor'],
      staff_id: 's-002', patient_id: null,
    },
    {
      id: 'u-003', username: 'dr.ali', email: 'ali.mousawi@hospital.iq',
      full_name: 'علي الموسوي', is_active: true,
      roles: ['doctor'],
      staff_id: 's-003', patient_id: null,
    },
    {
      id: 'u-004', username: 'nurse.zainab', email: 'zainab.husseini@hospital.iq',
      full_name: 'زينب الحسيني', is_active: true,
      roles: ['nurse'],
      staff_id: 's-004', patient_id: null,
    },
    {
      id: 'u-005', username: 'nurse.hassan', email: 'hassan.kanani@hospital.iq',
      full_name: 'حسن الكناني', is_active: true,
      roles: ['nurse'],
      staff_id: 's-005', patient_id: null,
    },
    {
      id: 'u-006', username: 'reception.mariam', email: 'mariam.obeidi@hospital.iq',
      full_name: 'مريم العبيدي', is_active: true,
      roles: ['receptionist'],
      staff_id: 's-006', patient_id: null,
    },
    {
      id: 'u-007', username: 'lab.omar', email: 'omar.dulaimi@hospital.iq',
      full_name: 'عمر الدليمي', is_active: true,
      roles: ['lab_technician'],
      staff_id: 's-007', patient_id: null,
    },
    {
      id: 'u-008', username: 'pharma.noor', email: 'noor.zubaidi@hospital.iq',
      full_name: 'نور الزبيدي', is_active: true,
      roles: ['pharmacist'],
      staff_id: 's-008', patient_id: null,
    },
    {
      id: 'u-009', username: 'admin.karrar', email: 'karrar.tamimi@hospital.iq',
      full_name: 'كرار التميمي', is_active: true,
      roles: ['admin'],
      staff_id: 's-009', patient_id: null,
    },
    {
      id: 'u-010', username: 'patient.mohammed', email: 'mohammed.saadi@mail.iq',
      full_name: 'محمد الساعدي', is_active: true,
      roles: ['patient'],
      staff_id: null, patient_id: 'p-001',
    },
    {
      id: 'u-011', username: 'patient.fatima', email: 'fatima.khafaji@mail.iq',
      full_name: 'فاطمة الخفاجي', is_active: true,
      roles: ['patient'],
      staff_id: null, patient_id: 'p-002',
    },
  ];

  /* ── الأدوار المتاحة في النظام ─────────────────────────────────── */
  var ALL_ROLES = [
    { id: 'r-1', name: 'admin' },
    { id: 'r-2', name: 'doctor' },
    { id: 'r-3', name: 'nurse' },
    { id: 'r-4', name: 'receptionist' },
    { id: 'r-5', name: 'lab_technician' },
    { id: 'r-6', name: 'pharmacist' },
    { id: 'r-7', name: 'patient' },
  ];

  /* ── الأقسام ────────────────────────────────────────────────────── */
  var DEPARTMENTS = [
    {
      id: 'd-001', name: 'الباطنية',
      location: 'الطابق الأول - جناح A', phone: '07700000101',
      head_staff_id: 's-003', head_staff_name: 'علي الموسوي', head_staff_type: 'doctor',
      staff_count: 4,
      staff: [
        { id: 's-001', first_name: 'أحمد',  last_name: 'العزاوي',  staff_type: 'doctor',       phone: '07710000001', email: 'ahmed.azzawi@hospital.iq' },
        { id: 's-003', first_name: 'علي',   last_name: 'الموسوي',  staff_type: 'doctor',       phone: '07710000003', email: 'ali.mousawi@hospital.iq'  },
        { id: 's-004', first_name: 'زينب',  last_name: 'الحسيني',  staff_type: 'nurse',        phone: '07710000004', email: 'zainab.husseini@hospital.iq' },
        { id: 's-006', first_name: 'مريم',  last_name: 'العبيدي',  staff_type: 'receptionist', phone: '07710000006', email: 'mariam.obeidi@hospital.iq' },
        { id: 's-008', first_name: 'نور',   last_name: 'الزبيدي',  staff_type: 'pharmacist',   phone: '07710000008', email: 'noor.zubaidi@hospital.iq'  },
        { id: 's-009', first_name: 'كرار',  last_name: 'التميمي',  staff_type: 'admin',        phone: '07710000009', email: 'karrar.tamimi@hospital.iq' },
      ],
    },
    {
      id: 'd-002', name: 'الجراحة',
      location: 'الطابق الثاني - جناح B', phone: '07700000102',
      head_staff_id: 's-002', head_staff_name: 'سارة الجبوري', head_staff_type: 'doctor',
      staff_count: 2,
      staff: [
        { id: 's-002', first_name: 'سارة',  last_name: 'الجبوري',  staff_type: 'doctor', phone: '07710000002', email: 'sara.jabouri@hospital.iq' },
        { id: 's-005', first_name: 'حسن',   last_name: 'الكناني',  staff_type: 'nurse',  phone: '07710000005', email: 'hassan.kanani@hospital.iq' },
      ],
    },
    {
      id: 'd-003', name: 'المختبر',
      location: 'الطابق الأرضي - جناح C', phone: '07700000103',
      head_staff_id: 's-007', head_staff_name: 'عمر الدليمي', head_staff_type: 'lab_technician',
      staff_count: 1,
      staff: [
        { id: 's-007', first_name: 'عمر',   last_name: 'الدليمي',  staff_type: 'lab_technician', phone: '07710000007', email: 'omar.dulaimi@hospital.iq' },
      ],
    },
  ];

  /* ── المرضى ─────────────────────────────────────────────────────── */
  var PATIENTS = [
    { id: 'p-001', medical_record_number: 'MRN-000001', first_name: 'محمد',  last_name: 'الساعدي',  gender: 'male',   date_of_birth: '1975-10-10', blood_type: 'O+',  phone: '07801000001', address: 'بغداد - الكرادة',     emergency_contact: 'فاطمة الساعدي — 07801000101', created_at: '2025-01-15T08:00:00Z' },
    { id: 'p-002', medical_record_number: 'MRN-000002', first_name: 'فاطمة', last_name: 'الخفاجي',  gender: 'female', date_of_birth: '1988-11-11', blood_type: 'A+',  phone: '07801000002', address: 'بغداد - المنصور',     emergency_contact: 'حيدر الخفاجي — 07801000102',  created_at: '2025-02-20T09:00:00Z' },
    { id: 'p-003', medical_record_number: 'MRN-000003', first_name: 'حيدر',  last_name: 'الربيعي',  gender: 'male',   date_of_birth: '1992-02-12', blood_type: 'B+',  phone: '07801000003', address: 'بغداد - زيونة',       emergency_contact: 'زهراء الربيعي — 07801000103',  created_at: '2025-03-10T10:00:00Z' },
    { id: 'p-004', medical_record_number: 'MRN-000004', first_name: 'زهراء', last_name: 'العامري',  gender: 'female', date_of_birth: '1999-03-13', blood_type: 'AB+', phone: '07801000004', address: 'بغداد - الجادرية',    emergency_contact: 'عباس العامري — 07801000104',   created_at: '2025-04-05T11:00:00Z' },
    { id: 'p-005', medical_record_number: 'MRN-000005', first_name: 'عباس',  last_name: 'الشمري',   gender: 'male',   date_of_birth: '1968-04-14', blood_type: 'O-',  phone: '07801000005', address: 'بغداد - الأعظمية',    emergency_contact: 'سجى الشمري — 07801000105',     created_at: '2025-05-01T08:30:00Z' },
    { id: 'p-006', medical_record_number: 'MRN-000006', first_name: 'سجى',   last_name: 'البياتي',  gender: 'female', date_of_birth: '2001-05-15', blood_type: 'A-',  phone: '07801000006', address: 'بغداد - الكاظمية',    emergency_contact: 'ليث البياتي — 07801000106',    created_at: '2025-06-12T09:00:00Z' },
    { id: 'p-007', medical_record_number: 'MRN-000007', first_name: 'ليث',   last_name: 'الجنابي',  gender: 'male',   date_of_birth: '1983-06-16', blood_type: 'B-',  phone: '07801000007', address: 'بغداد - الدورة',      emergency_contact: 'رغد الجنابي — 07801000107',    created_at: '2025-07-20T10:00:00Z' },
    { id: 'p-008', medical_record_number: 'MRN-000008', first_name: 'رغد',   last_name: 'الطائي',   gender: 'female', date_of_birth: '1996-07-17', blood_type: 'O+',  phone: '07801000008', address: 'بغداد - الغزالية',    emergency_contact: 'مصطفى الطائي — 07801000108',   created_at: '2025-08-08T11:00:00Z' },
  ];

  /* ── المواعيد ────────────────────────────────────────────────────── */
  var APPOINTMENTS = [
    {
      id: 'a-001', patient_id: 'p-001', doctor_id: 'doc-001', department_id: 'd-001',
      patient_name: 'محمد الساعدي', medical_record_number: 'MRN-000001',
      doctor_name: 'د. أحمد العزاوي', specialty: 'أمراض باطنية', department_name: 'الباطنية',
      scheduled_at: '2026-06-20T09:00:00+03:00', duration_minutes: 30,
      status: 'completed', reason: 'ألم في المعدة وحموضة',
    },
    {
      id: 'a-002', patient_id: 'p-002', doctor_id: 'doc-003', department_id: 'd-001',
      patient_name: 'فاطمة الخفاجي', medical_record_number: 'MRN-000002',
      doctor_name: 'د. علي الموسوي', specialty: 'أمراض القلب', department_name: 'الباطنية',
      scheduled_at: '2026-06-20T10:00:00+03:00', duration_minutes: 30,
      status: 'completed', reason: 'خفقان وارتفاع ضغط',
    },
    {
      id: 'a-003', patient_id: 'p-003', doctor_id: 'doc-002', department_id: 'd-002',
      patient_name: 'حيدر الربيعي', medical_record_number: 'MRN-000003',
      doctor_name: 'د. سارة الجبوري', specialty: 'جراحة عامة', department_name: 'الجراحة',
      scheduled_at: '2026-06-21T11:00:00+03:00', duration_minutes: 45,
      status: 'completed', reason: 'تقييم قبل عملية الزائدة',
    },
    {
      id: 'a-004', patient_id: 'p-004', doctor_id: 'doc-001', department_id: 'd-001',
      patient_name: 'زهراء العامري', medical_record_number: 'MRN-000004',
      doctor_name: 'د. أحمد العزاوي', specialty: 'أمراض باطنية', department_name: 'الباطنية',
      scheduled_at: '2026-06-22T09:30:00+03:00', duration_minutes: 30,
      status: 'completed', reason: 'حرارة وسعال مستمر',
    },
    {
      id: 'a-005', patient_id: 'p-005', doctor_id: 'doc-003', department_id: 'd-001',
      patient_name: 'عباس الشمري', medical_record_number: 'MRN-000005',
      doctor_name: 'د. علي الموسوي', specialty: 'أمراض القلب', department_name: 'الباطنية',
      scheduled_at: '2026-07-02T12:00:00+03:00', duration_minutes: 30,
      status: 'scheduled', reason: 'مراجعة دورية للضغط',
    },
    {
      id: 'a-006', patient_id: 'p-006', doctor_id: 'doc-002', department_id: 'd-002',
      patient_name: 'سجى البياتي', medical_record_number: 'MRN-000006',
      doctor_name: 'د. سارة الجبوري', specialty: 'جراحة عامة', department_name: 'الجراحة',
      scheduled_at: '2026-07-03T10:30:00+03:00', duration_minutes: 30,
      status: 'scheduled', reason: 'استشارة جراحية',
    },
  ];

  /* ── السجلات الطبية ─────────────────────────────────────────────── */
  var MEDICAL_RECORDS = [
    {
      id: 'mr-001', patient_id: 'p-001', doctor_id: 'doc-001', appointment_id: 'a-001',
      patient_name: 'محمد الساعدي', medical_record_number: 'MRN-000001',
      doctor_name: 'د. أحمد العزاوي',
      visit_date: '2026-06-20T09:10:00+03:00',
      chief_complaint: 'ألم شرسوفي وحموضة بعد الأكل',
      examination_notes: 'البطن لين غير مؤلم عند الجس، لا علامات إنذار. يُرجّح التهاب معدة.',
      vital_signs: { bp: '120/80', pulse: '78', temp: '36.8', weight: '78 kg' },
    },
    {
      id: 'mr-002', patient_id: 'p-002', doctor_id: 'doc-003', appointment_id: 'a-002',
      patient_name: 'فاطمة الخفاجي', medical_record_number: 'MRN-000002',
      doctor_name: 'د. علي الموسوي',
      visit_date: '2026-06-20T10:15:00+03:00',
      chief_complaint: 'خفقان وارتفاع في ضغط الدم',
      examination_notes: 'ضغط مرتفع، أصوات القلب طبيعية. يُطلب تخطيط ومتابعة.',
      vital_signs: { bp: '150/95', pulse: '92', temp: '36.6', weight: '65 kg' },
    },
    {
      id: 'mr-003', patient_id: 'p-003', doctor_id: 'doc-002', appointment_id: 'a-003',
      patient_name: 'حيدر الربيعي', medical_record_number: 'MRN-000003',
      doctor_name: 'د. سارة الجبوري',
      visit_date: '2026-06-21T11:20:00+03:00',
      chief_complaint: 'ألم في أسفل البطن الأيمن',
      examination_notes: 'إيلام عند نقطة ماكبرني، اشتباه التهاب زائدة دودية. يُطلب فحص دم.',
      vital_signs: { bp: '118/76', pulse: '98', temp: '38.1', weight: '82 kg' },
    },
    {
      id: 'mr-004', patient_id: 'p-004', doctor_id: 'doc-001', appointment_id: 'a-004',
      patient_name: 'زهراء العامري', medical_record_number: 'MRN-000004',
      doctor_name: 'د. أحمد العزاوي',
      visit_date: '2026-06-22T09:40:00+03:00',
      chief_complaint: 'حرارة وسعال منذ ثلاثة أيام',
      examination_notes: 'احتقان بالحلق وأصوات تنفسية خشنة. يُرجّح التهاب قصبات.',
      vital_signs: { bp: '110/70', pulse: '88', temp: '38.5', weight: '58 kg' },
    },
  ];

  /* ── التشخيصات ─────────────────────────────────────────────────── */
  var DIAGNOSES = {
    'mr-001': [
      { id: 'dx-001', medical_record_id: 'mr-001', icd10_code: 'K29.7', description: 'التهاب المعدة غير محدد', diagnosis_type: 'primary', diagnosed_at: '2026-06-20T09:20:00Z' },
    ],
    'mr-002': [
      { id: 'dx-002', medical_record_id: 'mr-002', icd10_code: 'I10', description: 'ارتفاع ضغط الدم الأساسي', diagnosis_type: 'primary', diagnosed_at: '2026-06-20T10:30:00Z' },
    ],
    'mr-003': [
      { id: 'dx-003', medical_record_id: 'mr-003', icd10_code: 'K35.80', description: 'التهاب الزائدة الدودية الحاد', diagnosis_type: 'provisional', diagnosed_at: '2026-06-21T11:45:00Z' },
    ],
    'mr-004': [
      { id: 'dx-004', medical_record_id: 'mr-004', icd10_code: 'J20.9', description: 'التهاب القصبات الحاد غير محدد', diagnosis_type: 'primary', diagnosed_at: '2026-06-22T09:55:00Z' },
    ],
  };

  /* ── الأدوية ────────────────────────────────────────────────────── */
  var MEDICATIONS = [
    { id: 'med-001', name: 'أوميبرازول',  generic_name: 'Omeprazole',  form: 'tablet',    strength: '20mg',  manufacturer: 'سامراء للأدوية', unit_price: 250,  stock_quantity: 500 },
    { id: 'med-002', name: 'أملوديبين',   generic_name: 'Amlodipine',  form: 'tablet',    strength: '5mg',   manufacturer: 'NDI',             unit_price: 300,  stock_quantity: 400 },
    { id: 'med-003', name: 'أموكسيسيلين', generic_name: 'Amoxicillin', form: 'capsule',   strength: '500mg', manufacturer: 'بايونير',         unit_price: 150,  stock_quantity: 800 },
    { id: 'med-004', name: 'باراسيتامول', generic_name: 'Paracetamol', form: 'tablet',    strength: '500mg', manufacturer: 'سامراء للأدوية', unit_price: 100,  stock_quantity: 1000 },
    { id: 'med-005', name: 'ديكلوفيناك',  generic_name: 'Diclofenac',  form: 'injection', strength: '75mg',  manufacturer: 'الكندي',          unit_price: 350,  stock_quantity: 200 },
  ];

  /* ── الوصفات الطبية ─────────────────────────────────────────────── */
  var PRESCRIPTIONS = [
    {
      id: 'rx-001', medical_record_id: 'mr-001', patient_id: 'p-001', doctor_id: 'doc-001',
      patient_name: 'محمد الساعدي', medical_record_number: 'MRN-000001',
      doctor_name: 'د. أحمد العزاوي',
      status: 'active', notes: 'تُؤخذ الأدوية قبل الأكل بنصف ساعة',
      issued_at: '2026-06-20T09:30:00Z', items_count: 1,
      items: [
        {
          id: 'ri-001', medication_id: 'med-001',
          medication_name: 'أوميبرازول', generic_name: 'Omeprazole',
          form: 'tablet', strength: '20mg',
          dosage: 'حبة واحدة', frequency: 'مرة يومياً', duration_days: 14, quantity: 14,
          instructions: 'قبل الفطور بنصف ساعة',
        },
      ],
    },
    {
      id: 'rx-002', medical_record_id: 'mr-002', patient_id: 'p-002', doctor_id: 'doc-003',
      patient_name: 'فاطمة الخفاجي', medical_record_number: 'MRN-000002',
      doctor_name: 'د. علي الموسوي',
      status: 'active', notes: 'متابعة الضغط يومياً وتسجيل القراءات',
      issued_at: '2026-06-20T10:45:00Z', items_count: 1,
      items: [
        {
          id: 'ri-002', medication_id: 'med-002',
          medication_name: 'أملوديبين', generic_name: 'Amlodipine',
          form: 'tablet', strength: '5mg',
          dosage: 'حبة واحدة', frequency: 'مرة يومياً', duration_days: 30, quantity: 30,
          instructions: 'صباحاً بعد الأكل',
        },
      ],
    },
    {
      id: 'rx-003', medical_record_id: 'mr-004', patient_id: 'p-004', doctor_id: 'doc-001',
      patient_name: 'زهراء العامري', medical_record_number: 'MRN-000004',
      doctor_name: 'د. أحمد العزاوي',
      status: 'dispensed', notes: 'إكمال كورس المضاد الحيوي كاملاً',
      issued_at: '2026-06-22T10:00:00Z', items_count: 2,
      items: [
        {
          id: 'ri-003', medication_id: 'med-003',
          medication_name: 'أموكسيسيلين', generic_name: 'Amoxicillin',
          form: 'capsule', strength: '500mg',
          dosage: 'كبسولة واحدة', frequency: 'ثلاث مرات يومياً', duration_days: 7, quantity: 21,
          instructions: 'بعد الأكل',
        },
        {
          id: 'ri-004', medication_id: 'med-004',
          medication_name: 'باراسيتامول', generic_name: 'Paracetamol',
          form: 'tablet', strength: '500mg',
          dosage: 'حبة واحدة', frequency: 'عند الحاجة للحرارة', duration_days: 5, quantity: 10,
          instructions: 'بحد أقصى 4 حبات يومياً',
        },
      ],
    },
  ];

  /* ── طلبات المختبر ─────────────────────────────────────────────── */
  var LAB_ORDERS = [
    {
      id: 'lo-001', medical_record_id: 'mr-003', patient_id: 'p-003', lab_test_id: 'lt-001',
      patient_name: 'حيدر الربيعي', test_name: 'تعداد الدم الكامل (CBC)',
      doctor_name: 'د. سارة الجبوري', ordered_by: 'doc-002',
      ordered_at: '2026-06-21T11:30:00Z',
      status: 'completed',
      result_value: '14.2', result_unit: '10^3/µL', reference_range: '4.5 - 11.0',
      technician_notes: 'ارتفاع في كريات الدم البيضاء يدعم الالتهاب',
      resulted_at: '2026-06-21T12:30:00Z',
      priority: 'urgent',
    },
    {
      id: 'lo-002', medical_record_id: 'mr-002', patient_id: 'p-002', lab_test_id: 'lt-002',
      patient_name: 'فاطمة الخفاجي', test_name: 'سكر الدم الصائم',
      doctor_name: 'د. علي الموسوي', ordered_by: 'doc-003',
      ordered_at: '2026-06-20T11:00:00Z',
      status: 'in_progress',
      priority: 'routine',
    },
  ];

  /* ── الفواتير ────────────────────────────────────────────────────── */
  var INVOICES = [
    {
      id: 'inv-001', invoice_number: 'INV-2026-0001',
      patient_id: 'p-001', appointment_id: 'a-001',
      patient_name: 'محمد الساعدي',
      status: 'paid',
      total_amount: 28500, paid_amount: 28500, balance_due: 0,
      due_date: '2026-06-27', created_at: '2026-06-20T09:00:00Z',
      items: [
        { id: 'ii-001', item_type: 'consultation', description: 'كشفية طبيب باطنية', quantity: 1, unit_price: 25000, line_total: 25000 },
        { id: 'ii-002', item_type: 'medication',   description: 'أوميبرازول 20mg', quantity: 14, unit_price: 250, line_total: 3500 },
      ],
    },
    {
      id: 'inv-002', invoice_number: 'INV-2026-0002',
      patient_id: 'p-003', appointment_id: 'a-003',
      patient_name: 'حيدر الربيعي',
      status: 'partially_paid',
      total_amount: 40000, paid_amount: 20000, balance_due: 20000,
      due_date: '2026-06-28', created_at: '2026-06-21T11:00:00Z',
      items: [
        { id: 'ii-003', item_type: 'consultation', description: 'كشفية جراحة عامة', quantity: 1, unit_price: 35000, line_total: 35000 },
        { id: 'ii-004', item_type: 'lab_test',     description: 'تعداد الدم الكامل (CBC)', quantity: 1, unit_price: 5000, line_total: 5000 },
      ],
    },
  ];

  /* ================================================================
     حالة الجلسة الحالية (تُحدَّث عند تسجيل الدخول)
  ================================================================ */
  var _currentUser  = null;
  var _currentToken = null;  /* التوكن الذي أنتج _currentUser */

  /* ── استخراج المستخدم من التوكن ─────────────────────────────────── */
  function _userFromToken(token) {
    if (!token || !token.startsWith('demo-')) return null;
    /* صيغة التوكن: demo-<role>-<userId>
       userId نفسه قد يحتوي على '-' (مثل: u-001, u-010)
       لذا نحذف 'demo-' ثم أول جزء (الدور) ونُعيد الباقي كـ userId */
    var withoutPrefix = token.slice('demo-'.length); /* "patient-u-010" */
    var dashIdx = withoutPrefix.indexOf('-');
    if (dashIdx === -1) return null;
    var userId = withoutPrefix.slice(dashIdx + 1); /* "u-010" */
    return USERS.find(function (u) { return u.id === userId; }) || null;
  }

  /* ── توليد ID بسيط ────────────────────────────────────────────── */
  var _idCounter = 1000;
  function _newId(prefix) {
    return prefix + '-demo-' + (++_idCounter);
  }

  /* ── استجابة ناجحة موحّدة ─────────────────────────────────────── */
  function _ok(data) {
    return { success: true, data: data };
  }

  /* ── استجابة خطأ ────────────────────────────────────────────────── */
  function _err(status, message) {
    var e = new Error(message);
    e.status = status;
    e.name   = 'ApiError';
    return e;
  }

  /* ── تحقّق المصادقة من localStorage ─────────────────────────────── */
  /* يُفضَّل دائماً قراءة التوكن من localStorage حتى لو تغيّر بعد Login */
  function _getSessionUser() {
    var token = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('hms_token')
      : null;
    if (!token) return null;
    /* إعادة استخدام _currentUser فقط إذا لم يتغيّر التوكن */
    if (token === _currentToken && _currentUser) return _currentUser;
    /* التوكن تغيّر أو لا يوجد cache: اشتقّ المستخدم من التوكن */
    var u = _userFromToken(token);
    _currentUser  = u;
    _currentToken = token;
    return u;
  }

  /* ── فلترة RBAC مبسّطة: هل يملك المستخدم أحد الأدوار؟ ─────────── */
  function _hasRole(user, roles) {
    if (!user) return false;
    return roles.some(function (r) { return user.roles.indexOf(r) !== -1; });
  }

  /* ================================================================
     مُوجّه الطلبات الرئيسي  window.DEMO.handle(method, path, body)
  ================================================================ */
  function handle(method, rawPath, body) {
    /* إزالة query string من المسار */
    var path = rawPath.split('?')[0];

    /* ── المصادقة ─────────────────────────────────────────────────── */

    /* POST /auth/login */
    if (method === 'POST' && path === '/auth/login') {
      return _handleLogin(body);
    }

    /* GET /auth/me */
    if (method === 'GET' && path === '/auth/me') {
      var me = _getSessionUser();
      if (!me) return Promise.reject(_err(401, 'غير مصادق'));
      return Promise.resolve(_ok({ user: _publicUser(me) }));
    }

    /* ── التحقّق من الجلسة لبقية الطلبات ─────────────────────────── */
    var user = _getSessionUser();
    if (!user) return Promise.reject(_err(401, 'انتهت الجلسة. أعِد تسجيل الدخول.'));

    /* ── المرضى ─────────────────────────────────────────────────── */
    if (path === '/patients') {
      if (method === 'GET') return _getPatients(user, rawPath);
      if (method === 'POST') return _createPatient(user, body);
    }
    var mPatient = path.match(/^\/patients\/([^/]+)$/);
    if (mPatient) {
      if (method === 'PATCH') return _updatePatient(user, mPatient[1], body);
    }

    /* ── المواعيد ────────────────────────────────────────────────── */
    if (path === '/appointments') {
      if (method === 'GET') return _getAppointments(user, rawPath);
      if (method === 'POST') return _createAppointment(user, body);
    }
    var mAppt = path.match(/^\/appointments\/([^/]+)$/);
    if (mAppt) {
      if (method === 'PATCH') return _updateAppointment(user, mAppt[1], body);
    }

    /* ── السجلات الطبية ─────────────────────────────────────────── */
    if (path === '/medical-records') {
      if (method === 'GET') return _getMedicalRecords(user);
      if (method === 'POST') return _createMedicalRecord(user, body);
    }
    var mMR = path.match(/^\/medical-records\/([^/]+)$/);
    if (mMR) {
      if (method === 'PATCH') return _updateMedicalRecord(user, mMR[1], body);
    }
    var mDx = path.match(/^\/medical-records\/([^/]+)\/diagnoses$/);
    if (mDx) {
      if (method === 'GET')  return _getDiagnoses(user, mDx[1]);
      if (method === 'POST') return _createDiagnosis(user, mDx[1], body);
    }

    /* ── الوصفات ─────────────────────────────────────────────────── */
    if (path === '/prescriptions') {
      if (method === 'GET') return _getPrescriptions(user, rawPath);
      if (method === 'POST') return _createPrescription(user, body);
    }
    var mRx = path.match(/^\/prescriptions\/([^/]+)$/);
    if (mRx) {
      if (method === 'GET') return _getPrescriptionById(user, mRx[1]);
    }
    var mRxStatus = path.match(/^\/prescriptions\/([^/]+)\/status$/);
    if (mRxStatus) {
      if (method === 'PATCH') return _updatePrescriptionStatus(user, mRxStatus[1], body);
    }

    /* ── المختبر ─────────────────────────────────────────────────── */
    if (path === '/lab-orders') {
      if (method === 'GET') return _getLabOrders(user);
      if (method === 'POST') return _createLabOrder(user, body);
    }
    var mLabResult = path.match(/^\/lab-orders\/([^/]+)\/result$/);
    if (mLabResult) {
      if (method === 'PATCH') return _updateLabResult(user, mLabResult[1], body);
    }

    /* ── الفوترة ─────────────────────────────────────────────────── */
    if (path === '/billing/invoices') {
      if (method === 'GET') return _getInvoices(user);
      if (method === 'POST') return _createInvoice(user, body);
    }
    var mPay = path.match(/^\/billing\/invoices\/([^/]+)\/payments$/);
    if (mPay) {
      if (method === 'POST') return _createPayment(user, mPay[1], body);
    }

    /* ── الأقسام ─────────────────────────────────────────────────── */
    if (path === '/departments') {
      if (method === 'GET') return _getDepartments(user);
      if (method === 'POST') return _createDepartment(user, body);
    }
    var mDept = path.match(/^\/departments\/([^/]+)$/);
    if (mDept) {
      if (method === 'GET')   return _getDepartmentById(user, mDept[1]);
      if (method === 'PATCH') return _updateDepartment(user, mDept[1], body);
    }

    /* ── المستخدمون ──────────────────────────────────────────────── */
    if (path === '/users') {
      if (method === 'GET') return _getUsers(user);
      if (method === 'POST') return _createUser(user, body);
    }
    if (path === '/users/roles/list') {
      if (method === 'GET') return _getRolesList(user);
    }
    var mUser = path.match(/^\/users\/([^/]+)$/);
    if (mUser) {
      if (method === 'PATCH') return _updateUser(user, mUser[1], body);
    }
    var mUserRoles = path.match(/^\/users\/([^/]+)\/roles$/);
    if (mUserRoles) {
      if (method === 'POST') return _assignRoles(user, mUserRoles[1], body);
    }

    /* مسار غير معروف */
    return Promise.reject(_err(404, 'المسار غير موجود في وضع العرض: ' + path));
  }

  /* ================================================================
     المصادقة
  ================================================================ */
  function _handleLogin(body) {
    var username = (body && body.username) ? body.username.trim() : '';
    var password = (body && body.password) ? body.password : '';

    var found = USERS.find(function (u) { return u.username === username; });
    if (!found || password !== DEMO_PASSWORD) {
      return Promise.reject(_err(401, 'اسم المستخدم أو كلمة المرور غير صحيحة.'));
    }

    var token     = 'demo-' + found.roles[0] + '-' + found.id;
    _currentUser  = found;
    _currentToken = token;

    return Promise.resolve({
      success: true,
      data: {
        access_token: token,
        user: _publicUser(found),
      },
    });
  }

  function _publicUser(u) {
    return {
      id:        u.id,
      username:  u.username,
      email:     u.email,
      full_name: u.full_name,
      is_active: u.is_active,
      roles:     u.roles.map(function (r) { return { name: r }; }),
      staff_id:  u.staff_id,
      patient_id: u.patient_id,
    };
  }

  /* ================================================================
     المرضى
  ================================================================ */
  function _getPatients(user, rawPath) {
    if (!_hasRole(user, ['admin', 'doctor', 'nurse', 'receptionist', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض المرضى.'));
    }
    /* RBAC: المريض يرى نفسه فقط */
    var list;
    if (_hasRole(user, ['patient']) && !_hasRole(user, ['admin', 'doctor', 'nurse', 'receptionist'])) {
      list = PATIENTS.filter(function (p) { return p.id === user.patient_id; });
    } else {
      list = PATIENTS.slice();
    }
    return Promise.resolve(_ok(list));
  }

  function _createPatient(user, body) {
    if (!_hasRole(user, ['admin', 'receptionist'])) {
      return Promise.reject(_err(403, 'غير مخوّل لإضافة مرضى.'));
    }
    var newP = Object.assign({}, body, {
      id: _newId('p'), medical_record_number: 'MRN-DEMO-' + _idCounter,
      created_at: new Date().toISOString(),
    });
    PATIENTS.push(newP);
    return Promise.resolve(_ok(newP));
  }

  function _updatePatient(user, id, body) {
    if (!_hasRole(user, ['admin', 'receptionist', 'doctor', 'nurse'])) {
      return Promise.reject(_err(403, 'غير مخوّل لتعديل بيانات المريض.'));
    }
    var idx = PATIENTS.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'المريض غير موجود.'));
    PATIENTS[idx] = Object.assign({}, PATIENTS[idx], body);
    return Promise.resolve(_ok(PATIENTS[idx]));
  }

  /* ================================================================
     المواعيد
  ================================================================ */
  function _getAppointments(user, rawPath) {
    if (!_hasRole(user, ['admin', 'doctor', 'nurse', 'receptionist', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض المواعيد.'));
    }
    var params = {};
    var qs = rawPath.indexOf('?') !== -1 ? rawPath.split('?')[1] : '';
    qs.split('&').forEach(function (p) {
      var kv = p.split('='); if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
    });

    var list = APPOINTMENTS.slice();

    /* RBAC: المريض يرى مواعيده فقط */
    if (_hasRole(user, ['patient']) && !_hasRole(user, ['admin', 'receptionist', 'doctor', 'nurse'])) {
      list = list.filter(function (a) { return a.patient_id === user.patient_id; });
    }

    /* فلترة الحالة */
    if (params.status) {
      list = list.filter(function (a) { return a.status === params.status; });
    }
    /* فلترة التاريخ */
    if (params.date_from && params.date_to) {
      var from = new Date(params.date_from).getTime();
      var to   = new Date(params.date_to).getTime();
      list = list.filter(function (a) {
        var t = new Date(a.scheduled_at).getTime();
        return t >= from && t <= to;
      });
    }
    return Promise.resolve(_ok(list));
  }

  function _createAppointment(user, body) {
    if (!_hasRole(user, ['admin', 'receptionist', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لحجز مواعيد.'));
    }
    var newA = Object.assign({}, body, {
      id: _newId('a'), status: 'scheduled',
      patient_name: 'مريض تجريبي', doctor_name: 'طبيب تجريبي',
      department_name: '—', specialty: '—',
      created_at: new Date().toISOString(),
    });
    APPOINTMENTS.push(newA);
    return Promise.resolve(_ok(newA));
  }

  function _updateAppointment(user, id, body) {
    if (!_hasRole(user, ['admin', 'receptionist', 'doctor'])) {
      return Promise.reject(_err(403, 'غير مخوّل لتعديل المواعيد.'));
    }
    var idx = APPOINTMENTS.findIndex(function (a) { return a.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'الموعد غير موجود.'));
    APPOINTMENTS[idx] = Object.assign({}, APPOINTMENTS[idx], body);
    return Promise.resolve(_ok(APPOINTMENTS[idx]));
  }

  /* ================================================================
     السجلات الطبية
  ================================================================ */
  function _getMedicalRecords(user) {
    /* موظف الاستقبال لا يملك صلاحية قراءة السجلات الطبية */
    if (_hasRole(user, ['receptionist']) && !_hasRole(user, ['admin', 'doctor', 'nurse', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل: موظفو الاستقبال لا يملكون صلاحية قراءة السجلات الطبية.'));
    }
    if (!_hasRole(user, ['admin', 'doctor', 'nurse', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض السجلات الطبية.'));
    }
    var list;
    /* RBAC: المريض يرى سجلاته فقط */
    if (_hasRole(user, ['patient']) && !_hasRole(user, ['admin', 'doctor', 'nurse'])) {
      list = MEDICAL_RECORDS.filter(function (r) { return r.patient_id === user.patient_id; });
    } else {
      list = MEDICAL_RECORDS.slice();
    }
    return Promise.resolve(_ok(list));
  }

  function _createMedicalRecord(user, body) {
    if (!_hasRole(user, ['doctor'])) {
      return Promise.reject(_err(403, 'إنشاء السجلات الطبية مخصّص للأطباء فقط.'));
    }
    var newMR = Object.assign({}, body, {
      id: _newId('mr'),
      doctor_name: user.full_name,
      patient_name: '—',
      medical_record_number: '—',
      created_at: new Date().toISOString(),
    });
    MEDICAL_RECORDS.push(newMR);
    DIAGNOSES[newMR.id] = [];
    return Promise.resolve(_ok(newMR));
  }

  function _updateMedicalRecord(user, id, body) {
    if (!_hasRole(user, ['doctor', 'nurse'])) {
      return Promise.reject(_err(403, 'غير مخوّل لتعديل السجلات الطبية.'));
    }
    var idx = MEDICAL_RECORDS.findIndex(function (r) { return r.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'السجل الطبي غير موجود.'));
    MEDICAL_RECORDS[idx] = Object.assign({}, MEDICAL_RECORDS[idx], body);
    return Promise.resolve(_ok(MEDICAL_RECORDS[idx]));
  }

  function _getDiagnoses(user, recordId) {
    if (!_hasRole(user, ['admin', 'doctor', 'nurse', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض التشخيصات.'));
    }
    var list = DIAGNOSES[recordId] || [];
    return Promise.resolve(_ok(list));
  }

  function _createDiagnosis(user, recordId, body) {
    if (!_hasRole(user, ['doctor'])) {
      return Promise.reject(_err(403, 'إضافة التشخيصات مخصّصة للأطباء فقط.'));
    }
    if (!DIAGNOSES[recordId]) DIAGNOSES[recordId] = [];
    var newDx = Object.assign({}, body, {
      id: _newId('dx'), medical_record_id: recordId,
      diagnosed_at: new Date().toISOString(),
    });
    DIAGNOSES[recordId].push(newDx);
    return Promise.resolve(_ok(newDx));
  }

  /* ================================================================
     الوصفات الطبية
  ================================================================ */
  function _getPrescriptions(user, rawPath) {
    if (!_hasRole(user, ['admin', 'doctor', 'pharmacist', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض الوصفات الطبية.'));
    }
    var params = {};
    var qs = rawPath.indexOf('?') !== -1 ? rawPath.split('?')[1] : '';
    qs.split('&').forEach(function (p) {
      var kv = p.split('='); if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
    });

    var list = PRESCRIPTIONS.slice();

    /* RBAC: المريض يرى وصفاته فقط */
    if (_hasRole(user, ['patient']) && !_hasRole(user, ['admin', 'doctor', 'pharmacist'])) {
      list = list.filter(function (rx) { return rx.patient_id === user.patient_id; });
    }

    if (params.status) {
      list = list.filter(function (rx) { return rx.status === params.status; });
    }

    /* نُرجع بدون حقل items في قائمة الوصفات */
    var listSummary = list.map(function (rx) {
      return {
        id: rx.id, patient_id: rx.patient_id, doctor_id: rx.doctor_id,
        patient_name: rx.patient_name, medical_record_number: rx.medical_record_number,
        doctor_name: rx.doctor_name, status: rx.status, notes: rx.notes,
        issued_at: rx.issued_at, items_count: rx.items_count,
      };
    });
    return Promise.resolve(_ok(listSummary));
  }

  function _getPrescriptionById(user, id) {
    if (!_hasRole(user, ['admin', 'doctor', 'pharmacist', 'patient'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض تفاصيل الوصفة.'));
    }
    var rx = PRESCRIPTIONS.find(function (r) { return r.id === id; });
    if (!rx) return Promise.reject(_err(404, 'الوصفة غير موجودة.'));
    /* RBAC: المريض يرى وصفاته فقط */
    if (_hasRole(user, ['patient']) && !_hasRole(user, ['admin', 'doctor', 'pharmacist'])) {
      if (rx.patient_id !== user.patient_id) {
        return Promise.reject(_err(403, 'لا تملك صلاحية عرض هذه الوصفة.'));
      }
    }
    return Promise.resolve(_ok(rx));
  }

  function _createPrescription(user, body) {
    if (!_hasRole(user, ['doctor'])) {
      return Promise.reject(_err(403, 'إنشاء الوصفات مخصّص للأطباء فقط.'));
    }
    var newRx = Object.assign({}, body, {
      id: _newId('rx'), doctor_id: user.id,
      doctor_name: user.full_name,
      patient_name: '—', medical_record_number: '—',
      status: 'active',
      issued_at: new Date().toISOString(),
      items_count: (body.items || []).length,
    });
    PRESCRIPTIONS.push(newRx);
    return Promise.resolve(_ok(newRx));
  }

  function _updatePrescriptionStatus(user, id, body) {
    if (!_hasRole(user, ['admin', 'doctor', 'pharmacist'])) {
      return Promise.reject(_err(403, 'غير مخوّل لتحديث حالة الوصفة.'));
    }
    var idx = PRESCRIPTIONS.findIndex(function (rx) { return rx.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'الوصفة غير موجودة.'));
    PRESCRIPTIONS[idx].status = body.status;
    return Promise.resolve(_ok(PRESCRIPTIONS[idx]));
  }

  /* ================================================================
     المختبر
  ================================================================ */
  function _getLabOrders(user) {
    if (!_hasRole(user, ['admin', 'doctor', 'lab_technician', 'nurse'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض طلبات الفحص.'));
    }
    return Promise.resolve(_ok(LAB_ORDERS.slice()));
  }

  function _createLabOrder(user, body) {
    if (!_hasRole(user, ['admin', 'doctor'])) {
      return Promise.reject(_err(403, 'طلب الفحوص مخصّص للأطباء والإدارة فقط.'));
    }
    var newO = Object.assign({}, body, {
      id: _newId('lo'), status: 'pending',
      patient_name: '—', test_name: 'فحص تجريبي',
      doctor_name: user.full_name, ordered_by: user.id,
      ordered_at: new Date().toISOString(),
    });
    LAB_ORDERS.push(newO);
    return Promise.resolve(_ok(newO));
  }

  function _updateLabResult(user, id, body) {
    if (!_hasRole(user, ['admin', 'lab_technician'])) {
      return Promise.reject(_err(403, 'إدخال نتائج الفحص مخصّص لفنّيي المختبر فقط.'));
    }
    var idx = LAB_ORDERS.findIndex(function (o) { return o.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'طلب الفحص غير موجود.'));
    LAB_ORDERS[idx] = Object.assign({}, LAB_ORDERS[idx], body, {
      status: 'completed', resulted_at: new Date().toISOString(),
    });
    return Promise.resolve(_ok(LAB_ORDERS[idx]));
  }

  /* ================================================================
     الفوترة
  ================================================================ */
  function _getInvoices(user) {
    if (!_hasRole(user, ['admin', 'receptionist'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض الفواتير.'));
    }
    return Promise.resolve(_ok(INVOICES.slice()));
  }

  function _createInvoice(user, body) {
    if (!_hasRole(user, ['admin', 'receptionist'])) {
      return Promise.reject(_err(403, 'غير مخوّل لإنشاء فواتير.'));
    }
    var num = 'INV-DEMO-' + _idCounter;
    var newInv = Object.assign({}, body, {
      id: _newId('inv'), invoice_number: num,
      patient_name: '—', status: 'unpaid',
      total_amount: 0, paid_amount: 0, balance_due: 0,
      created_at: new Date().toISOString(),
      items: [],
    });
    INVOICES.push(newInv);
    return Promise.resolve(_ok(newInv));
  }

  function _createPayment(user, invoiceId, body) {
    if (!_hasRole(user, ['admin', 'receptionist'])) {
      return Promise.reject(_err(403, 'غير مخوّل لتسجيل المدفوعات.'));
    }
    var idx = INVOICES.findIndex(function (inv) { return inv.id === invoiceId; });
    if (idx === -1) return Promise.reject(_err(404, 'الفاتورة غير موجودة.'));
    var inv  = INVOICES[idx];
    var amt  = parseFloat(body.amount) || 0;
    inv.paid_amount  = (inv.paid_amount || 0) + amt;
    inv.balance_due  = Math.max(0, (inv.total_amount || 0) - inv.paid_amount);
    inv.status       = inv.balance_due <= 0 ? 'paid' : 'partially_paid';
    INVOICES[idx]    = inv;
    return Promise.resolve(_ok({ success: true, invoice_id: invoiceId }));
  }

  /* ================================================================
     الأقسام
  ================================================================ */
  function _getDepartments(user) {
    if (!_hasRole(user, ['admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist'])) {
      return Promise.reject(_err(403, 'غير مخوّل لعرض الأقسام.'));
    }
    /* نُرجع نسخة بدون حقل staff التفصيلي */
    var list = DEPARTMENTS.map(function (d) {
      return {
        id: d.id, name: d.name, location: d.location, phone: d.phone,
        head_staff_id: d.head_staff_id, head_staff_name: d.head_staff_name,
        head_staff_type: d.head_staff_type, staff_count: d.staff_count,
      };
    });
    return Promise.resolve(_ok(list));
  }

  function _getDepartmentById(user, id) {
    if (!_hasRole(user, ['admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist'])) {
      return Promise.reject(_err(403, 'غير مخوّل.'));
    }
    var dept = DEPARTMENTS.find(function (d) { return d.id === id; });
    if (!dept) return Promise.reject(_err(404, 'القسم غير موجود.'));
    return Promise.resolve(_ok(dept));
  }

  function _createDepartment(user, body) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'إنشاء الأقسام مخصّص للإدارة فقط.'));
    }
    var newD = Object.assign({}, body, {
      id: _newId('d'), staff_count: 0, staff: [],
      head_staff_name: null, head_staff_type: null,
    });
    DEPARTMENTS.push(newD);
    return Promise.resolve(_ok(newD));
  }

  function _updateDepartment(user, id, body) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'تعديل الأقسام مخصّص للإدارة فقط.'));
    }
    var idx = DEPARTMENTS.findIndex(function (d) { return d.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'القسم غير موجود.'));
    DEPARTMENTS[idx] = Object.assign({}, DEPARTMENTS[idx], body);
    return Promise.resolve(_ok(DEPARTMENTS[idx]));
  }

  /* ================================================================
     المستخدمون
  ================================================================ */
  function _getUsers(user) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'إدارة المستخدمين مخصّصة للمسؤولين فقط.'));
    }
    var list = USERS.map(function (u) { return _publicUser(u); });
    return Promise.resolve(_ok(list));
  }

  function _getRolesList(user) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'غير مخوّل.'));
    }
    return Promise.resolve(_ok(ALL_ROLES));
  }

  function _createUser(user, body) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'إنشاء المستخدمين مخصّص للمسؤولين فقط.'));
    }
    var newU = {
      id: _newId('u'), username: body.username, email: body.email || null,
      full_name: body.full_name, is_active: true, roles: [],
      staff_id: null, patient_id: null,
    };
    USERS.push(newU);
    return Promise.resolve(_ok(_publicUser(newU)));
  }

  function _updateUser(user, id, body) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'غير مخوّل.'));
    }
    var idx = USERS.findIndex(function (u) { return u.id === id; });
    if (idx === -1) return Promise.reject(_err(404, 'المستخدم غير موجود.'));
    USERS[idx] = Object.assign({}, USERS[idx], body);
    return Promise.resolve(_ok(_publicUser(USERS[idx])));
  }

  function _assignRoles(user, userId, body) {
    if (!_hasRole(user, ['admin'])) {
      return Promise.reject(_err(403, 'تعيين الأدوار مخصّص للمسؤولين فقط.'));
    }
    var idx = USERS.findIndex(function (u) { return u.id === userId; });
    if (idx === -1) return Promise.reject(_err(404, 'المستخدم غير موجود.'));
    var roleIds = body.role_ids || [];
    var newRoles = ALL_ROLES
      .filter(function (r) { return roleIds.indexOf(r.id) !== -1 || roleIds.indexOf(r.name) !== -1; })
      .map(function (r) { return r.name; });
    USERS[idx].roles = newRoles;
    return Promise.resolve(_ok(_publicUser(USERS[idx])));
  }

  /* ── تصدير ─────────────────────────────────────────────────────── */
  global.DEMO = {
    handle: handle,
    /* للاختبار والتفحّص من Console */
    _data: {
      users: USERS, patients: PATIENTS, appointments: APPOINTMENTS,
      medicalRecords: MEDICAL_RECORDS, diagnoses: DIAGNOSES,
      prescriptions: PRESCRIPTIONS, labOrders: LAB_ORDERS,
      invoices: INVOICES, departments: DEPARTMENTS,
    },
  };

})(window);
