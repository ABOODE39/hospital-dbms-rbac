/* =====================================================================
   modules/departments.js — وحدة الأقسام
   API: GET/POST/PATCH /api/v1/departments
   ===================================================================== */

window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  /* ── بيانات التسجيل ── */
  id:    'departments',
  label: 'الأقسام',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="9" y1="7" x2="15" y2="7"/></svg>`,
  /* departments:read → جميع الموظفين ما عدا patient */
  roles: ['admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist'],

  async render(container) {

    /* ── صلاحيات المستخدم الحالي ─────────────────────────────────── */
    const canCreate = HMS_Auth.hasAnyRole(['admin']);
    const canEdit   = HMS_Auth.hasAnyRole(['admin']);

    /* ── رسم الهيكل الأساسي ─────────────────────────────────────── */
    container.innerHTML = `
      <!-- رأس الوحدة -->
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="9" y1="7" x2="15" y2="7"/></svg> الأقسام</h2>
        ${canCreate ? `<button class="btn btn-primary" id="dept-btn-add">+ إضافة قسم</button>` : ''}
      </div>

      <!-- رسالة العمليات -->
      <div id="dept-msg" hidden></div>

      <!-- بطاقات الأقسام -->
      <div id="dept-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
        margin-top: .5rem;">
        <!-- محتوى ديناميكي -->
        <div class="loading" style="grid-column:1/-1;">
          <div class="spinner"></div><span>جارٍ تحميل الأقسام...</span>
        </div>
      </div>

      <!-- نافذة تفاصيل القسم (عرض الموظفين) -->
      <div class="modal-overlay" id="dept-detail-modal" hidden role="dialog"
           aria-modal="true" aria-labelledby="dept-detail-title">
        <div class="modal-box" style="max-width:640px;">
          <h3 class="modal-title" id="dept-detail-title">موظّفو القسم</h3>
          <div id="dept-detail-body" style="max-height:400px;overflow-y:auto;"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="dept-detail-close">إغلاق</button>
          </div>
        </div>
      </div>

      <!-- نافذة الإضافة / التعديل -->
      <div class="modal-overlay" id="dept-modal" hidden role="dialog"
           aria-modal="true" aria-labelledby="dept-modal-title">
        <div class="modal-box">
          <h3 class="modal-title" id="dept-modal-title">إضافة قسم جديد</h3>
          <div id="dept-modal-msg" hidden></div>
          <form id="dept-form" novalidate>
            <input type="hidden" id="dept-id" />

            <div class="form-group">
              <label class="form-label" for="dept-f-name">اسم القسم *</label>
              <input class="form-control" id="dept-f-name" required
                     placeholder="مثال: قسم الطوارئ" />
            </div>

            <div class="form-group">
              <label class="form-label" for="dept-f-location">الموقع / الطابق</label>
              <input class="form-control" id="dept-f-location"
                     placeholder="مثال: الطابق الثاني — الجناح الشمالي" />
            </div>

            <div class="form-group">
              <label class="form-label" for="dept-f-phone">رقم الهاتف الداخلي</label>
              <input class="form-control" id="dept-f-phone"
                     placeholder="مثال: 201" />
            </div>

            <div class="form-group">
              <label class="form-label" for="dept-f-head">معرّف رئيس القسم (ID الموظف)</label>
              <input class="form-control" id="dept-f-head" type="number"
                     min="1" placeholder="اختياري" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="dept-btn-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="dept-btn-save">حفظ</button>
            </div>
          </form>
        </div>
      </div>
    `;

    /* ── رسم بطاقات الأقسام ─────────────────────────────────────── */
    function renderGrid(depts) {
      const grid = document.getElementById('dept-grid');

      if (!depts.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="9" y1="7" x2="15" y2="7"/></svg></div>
            <p>لا توجد أقسام مسجّلة.</p>
          </div>`;
        return;
      }

      grid.innerHTML = depts.map(d => `
        <div class="card" style="
          background: var(--clr-surface);
          border: 1px solid var(--clr-border);
          border-radius: var(--radius);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: .5rem;">

          <!-- اسم القسم -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">
            <h3 style="font-size:1rem;font-weight:700;color:var(--clr-primary);margin:0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:.3rem" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="9" y1="7" x2="15" y2="7"/></svg> ${d.name}
            </h3>
            <span class="badge badge-blue" style="white-space:nowrap;">
              ${d.staff_count || 0} موظف
            </span>
          </div>

          <!-- تفاصيل -->
          <div style="font-size:.875rem;color:var(--clr-text-muted);display:flex;flex-direction:column;gap:.25rem;">
            ${d.location ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:.25rem" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${d.location}</span>` : ''}
            ${d.phone    ? `<span dir="ltr"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:.25rem" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${d.phone}</span>` : ''}
            ${d.head_staff_name
              ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:.25rem" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> رئيس القسم: <strong style="color:var(--clr-text);">${d.head_staff_name}</strong>
                 <small>(${d.head_staff_type || ''})</small></span>`
              : `<span><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:.25rem" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> رئيس القسم: <em>غير محدد</em></span>`}
          </div>

          <!-- أزرار -->
          <div style="display:flex;gap:.5rem;margin-top:.5rem;">
            <button class="btn btn-secondary btn-sm"
              onclick="HMS.departments.openDetail(${d.id}, ${JSON.stringify(d.name).replace(/"/g, '&quot;')})">
              الموظّفون
            </button>
            ${canEdit ? `
            <button class="btn btn-secondary btn-sm"
              onclick="HMS.departments.openEdit(${JSON.stringify(d).replace(/"/g, '&quot;')})">
              تعديل
            </button>` : ''}
          </div>
        </div>
      `).join('');
    }

    /* ── جلب قائمة الأقسام ──────────────────────────────────────── */
    async function loadDepartments() {
      try {
        const data  = await apiGet('/departments');
        const depts = Array.isArray(data) ? data : (data.data || []);
        renderGrid(depts);
      } catch (err) {
        _deptMsg('dept-msg', 'error', 'تعذّر تحميل الأقسام: ' + err.message);
        document.getElementById('dept-grid').innerHTML =
          `<div style="grid-column:1/-1;text-align:center;color:var(--clr-danger);padding:1rem;">
            خطأ في التحميل
          </div>`;
      }
    }

    /* ── فتح نافذة تفاصيل القسم (قائمة الموظفين) ───────────────── */
    async function openDetail(deptId, deptName) {
      const body  = document.getElementById('dept-detail-body');
      const modal = document.getElementById('dept-detail-modal');
      document.getElementById('dept-detail-title').textContent = 'موظّفو قسم: ' + deptName;
      body.innerHTML = '<div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>';
      modal.hidden   = false;

      try {
        const data  = await apiGet('/departments/' + deptId);
        const dept  = data.data || data;
        const staff = dept.staff || [];

        if (!staff.length) {
          body.innerHTML = '<div class="empty-state"><p>لا يوجد موظفون نشطون في هذا القسم.</p></div>';
          return;
        }

        body.innerHTML = `
          <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
            <thead>
              <tr style="background:var(--clr-primary-light);">
                <th style="padding:.5rem .75rem;text-align:right;">#</th>
                <th style="padding:.5rem .75rem;text-align:right;">الاسم</th>
                <th style="padding:.5rem .75rem;text-align:right;">النوع</th>
                <th style="padding:.5rem .75rem;text-align:right;">الهاتف</th>
                <th style="padding:.5rem .75rem;text-align:right;">البريد</th>
              </tr>
            </thead>
            <tbody>
              ${staff.map((s, i) => `
                <tr style="border-bottom:1px solid var(--clr-border);">
                  <td style="padding:.5rem .75rem;">${i + 1}</td>
                  <td style="padding:.5rem .75rem;">
                    <strong>${s.first_name || ''} ${s.last_name || ''}</strong>
                  </td>
                  <td style="padding:.5rem .75rem;">
                    <span class="badge badge-blue">${s.staff_type || '—'}</span>
                  </td>
                  <td style="padding:.5rem .75rem;" dir="ltr">${s.phone || '—'}</td>
                  <td style="padding:.5rem .75rem;" dir="ltr">${s.email || '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      } catch (err) {
        body.innerHTML = `<p style="color:var(--clr-danger);padding:1rem;">
          تعذّر تحميل الموظفين: ${err.message}
        </p>`;
      }
    }

    /* ── فتح نافذة الإضافة ──────────────────────────────────────── */
    function openAdd() {
      document.getElementById('dept-modal-title').textContent = 'إضافة قسم جديد';
      document.getElementById('dept-form').reset();
      document.getElementById('dept-id').value               = '';
      document.getElementById('dept-modal-msg').hidden       = true;
      document.getElementById('dept-modal').hidden           = false;
    }

    /* ── فتح نافذة التعديل ──────────────────────────────────────── */
    function openEdit(dept) {
      document.getElementById('dept-modal-title').textContent = 'تعديل القسم';
      document.getElementById('dept-id').value                = dept.id || '';
      document.getElementById('dept-f-name').value           = dept.name     || '';
      document.getElementById('dept-f-location').value       = dept.location || '';
      document.getElementById('dept-f-phone').value          = dept.phone    || '';
      document.getElementById('dept-f-head').value           = dept.head_staff_id || '';
      document.getElementById('dept-modal-msg').hidden       = true;
      document.getElementById('dept-modal').hidden           = false;
    }

    /* ── إغلاق نافذة التعديل ────────────────────────────────────── */
    function closeModal() {
      document.getElementById('dept-modal').hidden = true;
    }

    /* ── حفظ النموذج ────────────────────────────────────────────── */
    document.getElementById('dept-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('dept-btn-save');
      saveBtn.disabled    = true;
      saveBtn.textContent = 'جارٍ الحفظ...';

      const deptId = document.getElementById('dept-id').value;
      const payload = {
        name:          document.getElementById('dept-f-name').value.trim()     || undefined,
        location:      document.getElementById('dept-f-location').value.trim() || undefined,
        phone:         document.getElementById('dept-f-phone').value.trim()    || undefined,
        head_staff_id: parseInt(document.getElementById('dept-f-head').value, 10) || undefined,
      };
      /* حذف الحقول الفارغة */
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      try {
        if (deptId) {
          await apiPatch('/departments/' + deptId, payload);
          _deptMsg('dept-msg', 'success', 'تم تحديث القسم بنجاح.');
        } else {
          await apiPost('/departments', payload);
          _deptMsg('dept-msg', 'success', 'تم إنشاء القسم بنجاح.');
        }
        closeModal();
        await loadDepartments();
      } catch (err) {
        _deptMsg('dept-modal-msg', 'error', err.message || 'فشلت العملية، يُرجى المحاولة مجدداً.');
      } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'حفظ';
      }
    });

    /* ── ربط الأزرار ────────────────────────────────────────────── */
    if (canCreate) {
      document.getElementById('dept-btn-add').addEventListener('click', openAdd);
    }

    document.getElementById('dept-btn-cancel').addEventListener('click', closeModal);

    document.getElementById('dept-detail-close').addEventListener('click', () => {
      document.getElementById('dept-detail-modal').hidden = true;
    });

    /* إغلاق نوافذ بالنقر على الخلفية */
    document.getElementById('dept-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('dept-detail-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.hidden = true;
      }
    });

    /* ── تصدير الدوال للاستخدام من onclick في البطاقات ─────────── */
    window.HMS.departments = { openEdit, openDetail };

    /* ── تحميل أولي ─────────────────────────────────────────────── */
    await loadDepartments();
  },
});

/* ── دالة مساعدة لعرض الرسائل (محلية للوحدة) ───────────────────── */
function _deptMsg(elId, type, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className   = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text;
  el.hidden      = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}
