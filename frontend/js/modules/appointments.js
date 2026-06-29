/* =====================================================================
   modules/appointments.js — وحدة المواعيد
   API: GET/POST/PATCH /api/v1/appointments
   ===================================================================== */

window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  /* ── بيانات التسجيل ── */
  id:    'appointments',
  label: 'المواعيد',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  /* appointments:read → receptionist, admin, doctor, nurse, patient */
  roles: ['admin', 'receptionist', 'doctor', 'nurse', 'patient'],

  async render(container) {

    /* ── صلاحيات المستخدم الحالي ─────────────────────────────────── */
    const canCreate = HMS_Auth.hasAnyRole(['admin', 'receptionist', 'patient']);
    const canEdit   = HMS_Auth.hasAnyRole(['admin', 'receptionist', 'doctor']);
    /* المريض يحجز لنفسه — لا يُدخل patient_id يدوياً */
    const isPatient = HMS_Auth.hasAnyRole(['patient']) && !HMS_Auth.hasAnyRole(['admin', 'receptionist']);

    /* ── رسم الهيكل الأساسي ─────────────────────────────────────── */
    container.innerHTML = `
      <!-- رأس الوحدة -->
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> المواعيد</h2>
        ${canCreate ? `<button class="btn btn-primary" id="appt-btn-add">+ حجز موعد</button>` : ''}
      </div>

      <!-- رسالة العمليات -->
      <div id="appt-msg" hidden></div>

      <!-- شريط الفلترة -->
      <div class="search-bar" style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;">
        <select class="form-control" id="appt-filter-status" style="width:auto;">
          <option value="">كل الحالات</option>
          <option value="scheduled">مجدوَل</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغي</option>
          <option value="no_show">لم يحضر</option>
        </select>
        <input type="date" class="form-control" id="appt-filter-date"
               style="width:auto;" title="فلترة بالتاريخ" />
        <button class="btn btn-secondary" id="appt-btn-filter">تصفية</button>
        <button class="btn btn-secondary" id="appt-btn-reset">إعادة ضبط</button>
      </div>

      <!-- جدول المواعيد -->
      <div class="table-wrapper">
        <table id="appt-table" aria-label="قائمة المواعيد">
          <thead>
            <tr>
              <th>#</th>
              <th>المريض</th>
              <th>الطبيب / التخصص</th>
              <th>القسم</th>
              <th>الموعد</th>
              <th>المدة</th>
              <th>الحالة</th>
              <th>السبب</th>
              ${canEdit ? '<th>إجراءات</th>' : ''}
            </tr>
          </thead>
          <tbody id="appt-tbody">
            <tr><td colspan="${canEdit ? 9 : 8}" class="loading-cell">
              <div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>
            </td></tr>
          </tbody>
        </table>
      </div>

      <!-- نافذة الحجز / التعديل -->
      <div class="modal-overlay" id="appt-modal" hidden role="dialog"
           aria-modal="true" aria-labelledby="appt-modal-title">
        <div class="modal-box">
          <h3 class="modal-title" id="appt-modal-title">حجز موعد جديد</h3>
          <div id="appt-modal-msg" hidden></div>
          <form id="appt-form" novalidate>
            <input type="hidden" id="appt-id" />

            ${!isPatient ? `
            <div class="form-group">
              <label class="form-label" for="appt-f-patient">معرّف المريض (ID) *</label>
              <input class="form-control" id="appt-f-patient" type="number"
                     min="1" placeholder="أدخل رقم المريض" required />
            </div>` : `<input type="hidden" id="appt-f-patient" />`}

            <div class="form-group">
              <label class="form-label" for="appt-f-doctor">معرّف الطبيب (ID) *</label>
              <input class="form-control" id="appt-f-doctor" type="number"
                     min="1" placeholder="أدخل رقم الطبيب" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="appt-f-dept">معرّف القسم (اختياري)</label>
              <input class="form-control" id="appt-f-dept" type="number"
                     min="1" placeholder="رقم القسم" />
            </div>

            <div class="form-group">
              <label class="form-label" for="appt-f-date">تاريخ ووقت الموعد *</label>
              <input class="form-control" id="appt-f-date" type="datetime-local" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="appt-f-duration">المدة (دقائق)</label>
              <input class="form-control" id="appt-f-duration" type="number"
                     value="30" min="5" max="240" />
            </div>

            <div class="form-group">
              <label class="form-label" for="appt-f-reason">سبب الزيارة</label>
              <textarea class="form-control" id="appt-f-reason" rows="2"
                        placeholder="وصف مختصر لسبب الحجز"></textarea>
            </div>

            <!-- حقل الحالة: يظهر فقط في وضع التعديل -->
            <div class="form-group" id="appt-status-group" hidden>
              <label class="form-label" for="appt-f-status">الحالة</label>
              <select class="form-control" id="appt-f-status">
                <option value="scheduled">مجدوَل</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
                <option value="no_show">لم يحضر</option>
              </select>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="appt-btn-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="appt-btn-save">حفظ</button>
            </div>
          </form>
        </div>
      </div>
    `;

    /* ── شارة الحالة ملوّنة ─────────────────────────────────────── */
    function statusBadge(status) {
      const map = {
        scheduled: { label: 'مجدوَل',  cls: 'badge-blue'   },
        completed:  { label: 'مكتمل',   cls: 'badge-green'  },
        cancelled:  { label: 'ملغي',    cls: 'badge-red'    },
        no_show:    { label: 'لم يحضر', cls: 'badge-yellow' },
      };
      const s = map[status] || { label: status || '—', cls: '' };
      return `<span class="badge ${s.cls}">${s.label}</span>`;
    }

    /* ── رسم صفوف الجدول ─────────────────────────────────────────── */
    function renderTable(rows) {
      const tbody = document.getElementById('appt-tbody');
      const cols  = canEdit ? 9 : 8;

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="${cols}">
          <div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
            <p>لا توجد مواعيد تطابق معايير البحث.</p></div>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((a, i) => {
        const dt      = a.scheduled_at
          ? new Date(a.scheduled_at).toLocaleString('ar-IQ',
              { dateStyle: 'short', timeStyle: 'short' })
          : '—';
        const duration = a.duration_minutes ? a.duration_minutes + ' د' : '—';
        const reason   = a.reason || '—';

        return `<tr>
          <td>${i + 1}</td>
          <td>
            <strong>${a.patient_name || '—'}</strong><br>
            <small class="text-muted">${a.medical_record_number || ''}</small>
          </td>
          <td>
            ${a.doctor_name || '—'}<br>
            <small class="text-muted">${a.specialty || ''}</small>
          </td>
          <td>${a.department_name || '—'}</td>
          <td dir="ltr" style="white-space:nowrap;">${dt}</td>
          <td style="text-align:center;">${duration}</td>
          <td>${statusBadge(a.status)}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              title="${reason.replace(/"/g, '&quot;')}">${reason}</td>
          ${canEdit ? `
          <td>
            <button class="btn btn-secondary btn-sm"
              onclick="HMS.appointments.openEdit(${JSON.stringify(a).replace(/"/g, '&quot;')})">
              تعديل
            </button>
          </td>` : ''}
        </tr>`;
      }).join('');
    }

    /* ── جلب المواعيد ────────────────────────────────────────────── */
    async function loadAppointments(params) {
      try {
        const data = await apiGet('/appointments', params || {});
        const rows = Array.isArray(data) ? data : (data.data || []);
        renderTable(rows);
      } catch (err) {
        _apptMsg('appt-msg', 'error', 'تعذّر تحميل المواعيد: ' + err.message);
        const cols = canEdit ? 9 : 8;
        document.getElementById('appt-tbody').innerHTML =
          `<tr><td colspan="${cols}" style="text-align:center;color:var(--clr-danger);padding:1rem;">
            خطأ في التحميل
          </td></tr>`;
      }
    }

    /* ── فتح النافذة — إضافة ────────────────────────────────────── */
    function openAdd() {
      document.getElementById('appt-modal-title').textContent = 'حجز موعد جديد';
      document.getElementById('appt-form').reset();
      document.getElementById('appt-id').value                = '';
      document.getElementById('appt-status-group').hidden     = true;
      document.getElementById('appt-modal-msg').hidden        = true;
      document.getElementById('appt-modal').hidden            = false;
    }

    /* ── فتح النافذة — تعديل ────────────────────────────────────── */
    function openEdit(appt) {
      document.getElementById('appt-modal-title').textContent = 'تعديل الموعد';
      document.getElementById('appt-id').value                = appt.id || '';

      const patientEl = document.getElementById('appt-f-patient');
      if (patientEl) patientEl.value = appt.patient_id || '';

      document.getElementById('appt-f-doctor').value   = appt.doctor_id     || '';
      document.getElementById('appt-f-dept').value     = appt.department_id || '';

      /* تحويل scheduled_at إلى صيغة datetime-local */
      if (appt.scheduled_at) {
        document.getElementById('appt-f-date').value =
          new Date(appt.scheduled_at).toISOString().slice(0, 16);
      }

      document.getElementById('appt-f-duration').value = appt.duration_minutes || 30;
      document.getElementById('appt-f-reason').value   = appt.reason || '';

      /* إظهار حقل الحالة في وضع التعديل */
      document.getElementById('appt-status-group').hidden = false;
      document.getElementById('appt-f-status').value      = appt.status || 'scheduled';

      document.getElementById('appt-modal-msg').hidden = true;
      document.getElementById('appt-modal').hidden     = false;
    }

    /* ── إغلاق النافذة ──────────────────────────────────────────── */
    function closeModal() {
      document.getElementById('appt-modal').hidden = true;
    }

    /* ── حفظ النموذج (إضافة أو تعديل) ──────────────────────────── */
    document.getElementById('appt-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('appt-btn-save');
      saveBtn.disabled    = true;
      saveBtn.textContent = 'جارٍ الحفظ...';

      const apptId = document.getElementById('appt-id').value;

      try {
        if (apptId) {
          /* ── تعديل: الحقول المسموح بها في PATCH ── */
          const payload = {
            status:           document.getElementById('appt-f-status').value || undefined,
            reason:           document.getElementById('appt-f-reason').value.trim() || undefined,
            scheduled_at:     document.getElementById('appt-f-date').value || undefined,
            duration_minutes: parseInt(document.getElementById('appt-f-duration').value, 10) || undefined,
            department_id:    parseInt(document.getElementById('appt-f-dept').value, 10) || undefined,
          };
          Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

          await apiPatch('/appointments/' + apptId, payload);
          _apptMsg('appt-msg', 'success', 'تم تحديث الموعد بنجاح.');
        } else {
          /* ── حجز جديد ── */
          const patientEl = document.getElementById('appt-f-patient');
          const payload = {
            patient_id:       patientEl && patientEl.value
                                ? parseInt(patientEl.value, 10)
                                : undefined,
            doctor_id:        parseInt(document.getElementById('appt-f-doctor').value, 10)   || undefined,
            department_id:    parseInt(document.getElementById('appt-f-dept').value, 10)     || undefined,
            scheduled_at:     document.getElementById('appt-f-date').value,
            duration_minutes: parseInt(document.getElementById('appt-f-duration').value, 10) || 30,
            reason:           document.getElementById('appt-f-reason').value.trim() || undefined,
          };
          Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

          await apiPost('/appointments', payload);
          _apptMsg('appt-msg', 'success', 'تم حجز الموعد بنجاح.');
        }

        closeModal();
        await loadAppointments();
      } catch (err) {
        _apptMsg('appt-modal-msg', 'error', err.message || 'فشلت العملية، يُرجى المحاولة مجدداً.');
      } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'حفظ';
      }
    });

    /* ── زر التصفية ─────────────────────────────────────────────── */
    document.getElementById('appt-btn-filter').addEventListener('click', () => {
      const status  = document.getElementById('appt-filter-status').value;
      const dateVal = document.getElementById('appt-filter-date').value;
      const params  = {};
      if (status)  params.status    = status;
      if (dateVal) {
        params.date_from = dateVal + 'T00:00:00';
        params.date_to   = dateVal + 'T23:59:59';
      }
      loadAppointments(params);
    });

    /* ── زر إعادة الضبط ─────────────────────────────────────────── */
    document.getElementById('appt-btn-reset').addEventListener('click', () => {
      document.getElementById('appt-filter-status').value = '';
      document.getElementById('appt-filter-date').value   = '';
      loadAppointments();
    });

    /* ── ربط باقي الأزرار ───────────────────────────────────────── */
    if (canCreate) {
      document.getElementById('appt-btn-add').addEventListener('click', openAdd);
    }

    document.getElementById('appt-btn-cancel').addEventListener('click', closeModal);

    /* إغلاق عند النقر على الخلفية */
    document.getElementById('appt-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    /* ── تصدير openEdit للاستخدام من onclick في الجدول ─────────── */
    window.HMS.appointments = { openEdit };

    /* ── تحميل أولي ─────────────────────────────────────────────── */
    await loadAppointments();
  },
});

/* ── دالة مساعدة لعرض الرسائل (محلية للوحدة) ───────────────────── */
function _apptMsg(elId, type, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className   = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text;
  el.hidden      = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}
