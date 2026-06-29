/* =====================================================================
   modules/patients.js — وحدة المرضى (النموذج المرجعي لعقد الوحدات)
   ===================================================================== */

/* تهيئة مساحة الأسماء العالمية */
window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  /* ── بيانات التسجيل ── */
  id:    'patients',
  label: 'المرضى',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  /* الأدوار التي تملك patients:read على الأقل */
  roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'],

  /* ── الدالة الرئيسية (عقد الوحدة) ──
       التوقيع: async render(container: HTMLElement): Promise<void>
       - container: العنصر الذي يجب ملؤه بالكامل
       - يستخدم apiGet / apiPost / apiPatch من api.js
       - لا يُرجع قيمة؛ يُلقي خطأ عند الفشل ليُعالجه app.js
  ── */
  async render(container) {

    /* ── صلاحيات هذا المستخدم تحديداً ─────────────────────────── */
    const userRoles   = HMS_Auth.getUserRoles();
    const canCreate   = HMS_Auth.hasAnyRole(['admin', 'receptionist']);
    const canEdit     = HMS_Auth.hasAnyRole(['admin', 'receptionist', 'doctor', 'nurse']);

    /* ── رسم الهيكل الأساسي ─────────────────────────────────────── */
    container.innerHTML = `
      <!-- رأس الوحدة -->
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> المرضى</h2>
        ${canCreate ? `<button class="btn btn-primary" id="btn-add-patient">+ إضافة مريض</button>` : ''}
      </div>

      <!-- رسالة العمليات -->
      <div id="patients-msg" hidden></div>

      <!-- شريط البحث -->
      <div class="search-bar">
        <input type="text" id="patients-search" class="form-control"
               placeholder="بحث بالاسم أو رقم الملف..." />
      </div>

      <!-- جدول المرضى -->
      <div class="table-wrapper">
        <table id="patients-table" aria-label="قائمة المرضى">
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم الكامل</th>
              <th>رقم الملف</th>
              <th>الجنس</th>
              <th>تاريخ الميلاد</th>
              <th>الهاتف</th>
              <th>تاريخ التسجيل</th>
              ${canEdit ? '<th>إجراءات</th>' : ''}
            </tr>
          </thead>
          <tbody id="patients-tbody">
            <tr><td colspan="8" class="loading-cell">
              <div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>
            </td></tr>
          </tbody>
        </table>
      </div>

      <!-- نافذة الإضافة/التعديل -->
      <div class="modal-overlay" id="patient-modal" hidden role="dialog"
           aria-modal="true" aria-labelledby="patient-modal-title">
        <div class="modal-box">
          <h3 class="modal-title" id="patient-modal-title">إضافة مريض جديد</h3>
          <div id="modal-msg" hidden></div>
          <form id="patient-form" novalidate>
            <input type="hidden" id="patient-id" />

            <div class="form-group">
              <label class="form-label" for="f-first-name">الاسم الأول *</label>
              <input class="form-control" id="f-first-name" required placeholder="الاسم الأول" />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-last-name">الاسم الأخير *</label>
              <input class="form-control" id="f-last-name" required placeholder="الاسم الأخير" />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-gender">الجنس *</label>
              <select class="form-control" id="f-gender" required>
                <option value="">— اختر —</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
                <option value="other">آخر</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="f-dob">تاريخ الميلاد</label>
              <input class="form-control" type="date" id="f-dob" />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-phone">الهاتف</label>
              <input class="form-control" id="f-phone" placeholder="07xxxxxxxxx" />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-address">العنوان</label>
              <textarea class="form-control" id="f-address" placeholder="المدينة / الحي / الشارع"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="f-blood">فصيلة الدم</label>
              <select class="form-control" id="f-blood">
                <option value="">— غير محدد —</option>
                <option>A+</option><option>A-</option>
                <option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option>
                <option>O+</option><option>O-</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="f-emergency-contact">جهة الطوارئ</label>
              <input class="form-control" id="f-emergency-contact" placeholder="الاسم — رقم الهاتف" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-modal">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="btn-save-patient">حفظ</button>
            </div>
          </form>
        </div>
      </div>
    `;

    /* ── جلب البيانات وعرضها ─────────────────────────────────────── */
    let allPatients = [];

    async function loadPatients() {
      try {
        const data = await apiGet('/patients');
        /* يدعم { data: [...] } أو مصفوفة مباشرة */
        allPatients = Array.isArray(data) ? data : (data.data || data.patients || []);
        renderTable(allPatients);
      } catch (err) {
        showMsg('patients-msg', 'error', 'تعذّر تحميل بيانات المرضى: ' + err.message);
        document.getElementById('patients-tbody').innerHTML =
          `<tr><td colspan="8" style="text-align:center;color:#c0392b;padding:1rem;">
            خطأ في التحميل
          </td></tr>`;
      }
    }

    /* ── رسم صفوف الجدول ─────────────────────────────────────────── */
    function renderTable(patients) {
      const tbody = document.getElementById('patients-tbody');

      if (!patients.length) {
        tbody.innerHTML = `<tr><td colspan="8">
          <div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><p>لا يوجد مرضى مسجّلون.</p></div>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = patients.map((p, i) => {
        const name    = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
        const gender  = p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : (p.gender || '—');
        const dob     = p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('ar-IQ') : '—';
        const regDate = p.created_at    ? new Date(p.created_at).toLocaleDateString('ar-IQ')    : '—';
        const fileNo  = p.medical_record_number || p.file_number || p.id || '—';
        const phone   = p.phone || '—';

        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${name}</strong></td>
          <td><span class="badge badge-blue">${fileNo}</span></td>
          <td>${gender}</td>
          <td>${dob}</td>
          <td dir="ltr">${phone}</td>
          <td>${regDate}</td>
          ${canEdit ? `
          <td>
            <button class="btn btn-secondary btn-sm" onclick="HMS.patients.openEdit(${JSON.stringify(p).replace(/"/g, '&quot;')})">
              تعديل
            </button>
          </td>` : ''}
        </tr>`;
      }).join('');
    }

    /* ── بحث فوري في العميل ─────────────────────────────────────── */
    document.getElementById('patients-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) { renderTable(allPatients); return; }
      const filtered = allPatients.filter(p => {
        const name    = [p.first_name, p.last_name].join(' ').toLowerCase();
        const fileNo  = String(p.medical_record_number || p.file_number || p.id || '').toLowerCase();
        return name.includes(q) || fileNo.includes(q);
      });
      renderTable(filtered);
    });

    /* ── فتح النافذة المنبثقة (إضافة) ──────────────────────────── */
    function openAdd() {
      document.getElementById('patient-modal-title').textContent = 'إضافة مريض جديد';
      document.getElementById('patient-form').reset();
      document.getElementById('patient-id').value = '';
      document.getElementById('modal-msg').hidden  = true;
      document.getElementById('patient-modal').hidden = false;
    }

    /* ── فتح النافذة المنبثقة (تعديل) ──────────────────────────── */
    function openEdit(patient) {
      document.getElementById('patient-modal-title').textContent = 'تعديل بيانات المريض';
      document.getElementById('patient-id').value      = patient.id || '';
      document.getElementById('f-first-name').value   = patient.first_name || '';
      document.getElementById('f-last-name').value    = patient.last_name  || '';
      document.getElementById('f-gender').value        = patient.gender    || '';
      document.getElementById('f-dob').value           = patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '';
      document.getElementById('f-phone').value         = patient.phone     || '';
      document.getElementById('f-address').value       = patient.address   || '';
      document.getElementById('f-blood').value         = patient.blood_type || '';
      document.getElementById('f-emergency-contact').value = patient.emergency_contact || '';
      document.getElementById('modal-msg').hidden = true;
      document.getElementById('patient-modal').hidden = false;
    }

    /* ── إغلاق النافذة ───────────────────────────────────────────── */
    function closeModal() {
      document.getElementById('patient-modal').hidden = true;
    }

    /* ── حفظ النموذج (إضافة أو تعديل) ──────────────────────────── */
    document.getElementById('patient-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-patient');
      saveBtn.disabled = true;
      saveBtn.textContent = 'جارٍ الحفظ...';

      const patientId = document.getElementById('patient-id').value;
      const payload   = {
        first_name:          document.getElementById('f-first-name').value.trim(),
        last_name:           document.getElementById('f-last-name').value.trim(),
        gender:              document.getElementById('f-gender').value,
        date_of_birth:       document.getElementById('f-dob').value       || undefined,
        phone:               document.getElementById('f-phone').value.trim() || undefined,
        address:             document.getElementById('f-address').value.trim() || undefined,
        blood_type:          document.getElementById('f-blood').value     || undefined,
        emergency_contact:   document.getElementById('f-emergency-contact').value.trim() || undefined,
      };

      /* حذف الحقول الفارغة */
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      try {
        if (patientId) {
          await apiPatch('/patients/' + patientId, payload);
          showMsg('patients-msg', 'success', 'تم تحديث بيانات المريض بنجاح.');
        } else {
          await apiPost('/patients', payload);
          showMsg('patients-msg', 'success', 'تم تسجيل المريض بنجاح.');
        }
        closeModal();
        await loadPatients();
      } catch (err) {
        showMsg('modal-msg', 'error', err.message || 'فشلت العملية، يُرجى المحاولة مجدداً.');
      } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'حفظ';
      }
    });

    /* ── ربط الأزرار ─────────────────────────────────────────────── */
    if (canCreate) {
      document.getElementById('btn-add-patient')
        .addEventListener('click', openAdd);
    }

    document.getElementById('btn-cancel-modal')
      .addEventListener('click', closeModal);

    /* إغلاق عند النقر على الخلفية */
    document.getElementById('patient-modal')
      .addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
      });

    /* ── تصدير openEdit للاستخدام من onclick في الجدول ──────────── */
    window.HMS.patients = { openEdit };

    /* ── تحميل البيانات ──────────────────────────────────────────── */
    await loadPatients();
  },
});

/* ── دالة مساعدة لعرض الرسائل ───────────────────────────────────── */
function showMsg(elId, type, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className   = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text;
  el.hidden      = false;
  /* إخفاء تلقائي بعد 5 ثوانٍ */
  setTimeout(() => { el.hidden = true; }, 5000);
}
