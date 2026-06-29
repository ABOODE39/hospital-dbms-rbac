/* =====================================================================
   modules/medical-records.js — السجلات الطبية والتشخيصات
   الأدوار: admin, doctor, nurse, patient
   ===================================================================== */

/* تهيئة مساحة الأسماء العالمية */
window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  /* ── بيانات التسجيل ── */
  id:    'medical-records',
  label: 'السجلات الطبية',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
  /* medical_records:read → doctor, nurse, admin, patient */
  roles: ['admin', 'doctor', 'nurse', 'patient'],

  async render(container) {

    /* ── صلاحيات المستخدم الحالي ─────────────────────────────────── */
    /* medical_records:create → doctor فقط */
    const canCreate     = HMS_Auth.hasAnyRole(['doctor']);
    /* medical_records:update → doctor, nurse */
    const canEdit       = HMS_Auth.hasAnyRole(['doctor', 'nurse']);
    /* diagnoses:create → doctor فقط */
    const canDiagnose   = HMS_Auth.hasAnyRole(['doctor']);

    /* ── رسم الهيكل الأساسي ─────────────────────────────────────── */
    container.innerHTML = `
      <!-- رأس الوحدة -->
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg> السجلات الطبية</h2>
        ${canCreate ? `<button class="btn btn-primary" id="mr-btn-add">+ سجل جديد</button>` : ''}
      </div>

      <!-- رسائل العمليات -->
      <div id="mr-msg" hidden></div>

      <!-- جدول السجلات الطبية -->
      <div class="table-wrapper">
        <table id="mr-table" aria-label="السجلات الطبية">
          <thead>
            <tr>
              <th>#</th>
              <th>المريض</th>
              <th>رقم الملف</th>
              <th>الطبيب</th>
              <th>الشكوى الرئيسية</th>
              <th>تاريخ الزيارة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody id="mr-tbody">
            <tr><td colspan="7" class="loading-cell">
              <div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>
            </td></tr>
          </tbody>
        </table>
      </div>

      <!-- ============================================================
           نافذة: إنشاء سجل طبي جديد (doctor فقط)
           الحقول: patient_id, appointment_id, chief_complaint,
                   examination_notes, vital_signs, visit_date
           ============================================================ -->
      <div class="modal-overlay" id="mr-modal-add" hidden role="dialog"
           aria-modal="true" aria-labelledby="mr-add-title">
        <div class="modal-box">
          <h3 class="modal-title" id="mr-add-title">إنشاء سجل طبي جديد</h3>
          <div id="mr-add-msg" hidden></div>
          <form id="mr-add-form" novalidate>

            <div class="form-group">
              <label class="form-label" for="mr-a-patient">معرّف المريض *</label>
              <input class="form-control" id="mr-a-patient" required
                     placeholder="UUID المريض" />
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-a-date">تاريخ الزيارة</label>
              <input class="form-control" type="date" id="mr-a-date" />
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-a-appt">معرّف الموعد (اختياري)</label>
              <input class="form-control" id="mr-a-appt"
                     placeholder="UUID الموعد (إن وُجد)" />
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-a-complaint">الشكوى الرئيسية</label>
              <textarea class="form-control" id="mr-a-complaint"
                        placeholder="وصف الشكوى التي يقدّمها المريض..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-a-notes">ملاحظات الفحص</label>
              <textarea class="form-control" id="mr-a-notes"
                        placeholder="نتائج الفحص السريري..."></textarea>
            </div>
            <!-- العلامات الحيوية — JSON بسيط -->
            <fieldset style="border:1px solid var(--clr-border);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:1rem;">
              <legend style="font-weight:600;padding:0 .5rem;font-size:.9rem">العلامات الحيوية</legend>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                <div class="form-group">
                  <label class="form-label" for="mr-vs-bp">ضغط الدم</label>
                  <input class="form-control" id="mr-vs-bp" placeholder="120/80 mmHg" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mr-vs-pulse">النبض</label>
                  <input class="form-control" id="mr-vs-pulse" placeholder="72 bpm" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mr-vs-temp">الحرارة</label>
                  <input class="form-control" id="mr-vs-temp" placeholder="36.5 °C" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mr-vs-weight">الوزن</label>
                  <input class="form-control" id="mr-vs-weight" placeholder="kg" />
                </div>
              </div>
            </fieldset>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="mr-add-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="mr-add-save">حفظ</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================
           نافذة: تعديل سجل طبي (doctor, nurse)
           doctor → chief_complaint + examination_notes + vital_signs
           nurse  → vital_signs فقط (RLS تفرض)
           ============================================================ -->
      <div class="modal-overlay" id="mr-modal-edit" hidden role="dialog"
           aria-modal="true" aria-labelledby="mr-edit-title">
        <div class="modal-box">
          <h3 class="modal-title" id="mr-edit-title">تعديل السجل الطبي</h3>
          <div id="mr-edit-msg" hidden></div>
          <form id="mr-edit-form" novalidate>
            <input type="hidden" id="mr-e-id" />

            ${canEdit && !canDiagnose ? `
            <!-- الممرض: العلامات الحيوية فقط -->
            <p style="color:var(--clr-text-muted);font-size:.85rem;margin-bottom:.75rem">
              صلاحيتك مقتصرة على تحديث العلامات الحيوية.
            </p>` : ''}

            ${canDiagnose ? `
            <div class="form-group">
              <label class="form-label" for="mr-e-complaint">الشكوى الرئيسية</label>
              <textarea class="form-control" id="mr-e-complaint"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-e-notes">ملاحظات الفحص</label>
              <textarea class="form-control" id="mr-e-notes"></textarea>
            </div>` : ''}

            <fieldset style="border:1px solid var(--clr-border);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:1rem;">
              <legend style="font-weight:600;padding:0 .5rem;font-size:.9rem">العلامات الحيوية</legend>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                <div class="form-group">
                  <label class="form-label" for="mr-e-bp">ضغط الدم</label>
                  <input class="form-control" id="mr-e-bp" placeholder="120/80 mmHg" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mr-e-pulse">النبض</label>
                  <input class="form-control" id="mr-e-pulse" placeholder="72 bpm" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mr-e-temp">الحرارة</label>
                  <input class="form-control" id="mr-e-temp" placeholder="36.5 °C" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mr-e-weight">الوزن</label>
                  <input class="form-control" id="mr-e-weight" placeholder="kg" />
                </div>
              </div>
            </fieldset>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="mr-edit-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="mr-edit-save">حفظ التعديلات</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================
           نافذة: التشخيصات (قراءة + إضافة للطبيب)
           ============================================================ -->
      <div class="modal-overlay" id="mr-modal-dx" hidden role="dialog"
           aria-modal="true" aria-labelledby="mr-dx-title">
        <div class="modal-box" style="max-width:640px">
          <h3 class="modal-title" id="mr-dx-title">التشخيصات</h3>
          <div id="mr-dx-msg" hidden></div>

          <!-- قائمة التشخيصات الحالية -->
          <div id="mr-dx-list" style="margin-bottom:1rem">
            <div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>
          </div>

          <!-- نموذج إضافة تشخيص (doctor فقط) -->
          ${canDiagnose ? `
          <hr style="border-color:var(--clr-border);margin:1rem 0"/>
          <h4 style="font-size:.95rem;font-weight:600;margin-bottom:.75rem">إضافة تشخيص جديد</h4>
          <form id="mr-dx-form" novalidate>
            <input type="hidden" id="mr-dx-record-id" />
            <div class="form-group">
              <label class="form-label" for="mr-dx-desc">وصف التشخيص *</label>
              <textarea class="form-control" id="mr-dx-desc" required
                        placeholder="وصف واضح للتشخيص..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-dx-icd">رمز ICD-10 (اختياري)</label>
              <input class="form-control" id="mr-dx-icd"
                     placeholder="مثال: J06.9" style="text-transform:uppercase" />
            </div>
            <div class="form-group">
              <label class="form-label" for="mr-dx-type">نوع التشخيص</label>
              <select class="form-control" id="mr-dx-type">
                <option value="primary">رئيسي</option>
                <option value="secondary">ثانوي</option>
                <option value="provisional">مبدئي</option>
              </select>
            </div>
            <div class="modal-footer" style="padding:0;margin-top:.5rem">
              <button type="submit" class="btn btn-primary" id="mr-dx-save">إضافة التشخيص</button>
            </div>
          </form>` : ''}

          <div style="margin-top:1rem;text-align:start">
            <button type="button" class="btn btn-secondary" id="mr-dx-close">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    /* ── بيانات محمّلة ───────────────────────────────────────────── */
    let allRecords = [];

    /* ── جلب وعرض السجلات ───────────────────────────────────────── */
    async function loadRecords() {
      try {
        const data = await apiGet('/medical-records');
        allRecords = Array.isArray(data) ? data : (data.data || data.records || []);
        renderTable(allRecords);
      } catch (err) {
        _mrMsg('mr-msg', 'error', 'تعذّر تحميل السجلات الطبية: ' + err.message);
        document.getElementById('mr-tbody').innerHTML =
          `<tr><td colspan="7" style="text-align:center;color:var(--clr-danger);padding:1rem">خطأ في التحميل</td></tr>`;
      }
    }

    /* ── رسم جدول السجلات ───────────────────────────────────────── */
    function renderTable(records) {
      const tbody = document.getElementById('mr-tbody');

      if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="7">
          <div class="empty-state">
            <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div>
            <p>لا توجد سجلات طبية مسجّلة.</p>
          </div>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = records.map((r, i) => {
        const visitDate   = r.visit_date ? new Date(r.visit_date).toLocaleDateString('ar-IQ') : '—';
        const patient     = r.patient_name || r.patient_id || '—';
        const fileNo      = r.medical_record_number
          ? `<span class="badge badge-blue">${r.medical_record_number}</span>` : '—';
        const doctor      = r.doctor_name  || r.doctor_id  || '—';
        const complaint   = r.chief_complaint
          ? (r.chief_complaint.length > 50 ? r.chief_complaint.slice(0, 50) + '...' : r.chief_complaint)
          : '—';

        /* زر التشخيصات للجميع، زر التعديل لمن يملكون الصلاحية */
        const actions = `
          <button class="btn btn-secondary btn-sm"
            onclick="HMS.mr.openDiagnoses('${r.id}')">التشخيصات</button>
          ${canEdit ? `
          <button class="btn btn-secondary btn-sm"
            onclick="HMS.mr.openEdit(${JSON.stringify(r).replace(/"/g, '&quot;')})">تعديل</button>
          ` : ''}
        `;

        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${patient}</strong></td>
          <td>${fileNo}</td>
          <td>${doctor}</td>
          <td>${complaint}</td>
          <td>${visitDate}</td>
          <td>${actions}</td>
        </tr>`;
      }).join('');
    }

    /* ── نافذة إضافة سجل جديد ───────────────────────────────────── */
    function openAdd() {
      document.getElementById('mr-add-form').reset();
      document.getElementById('mr-add-msg').hidden = true;
      document.getElementById('mr-modal-add').hidden = false;
    }

    /* ── نافذة تعديل سجل ────────────────────────────────────────── */
    function openEdit(record) {
      document.getElementById('mr-e-id').value = record.id || '';

      /* حقول الطبيب */
      const cEl = document.getElementById('mr-e-complaint');
      const nEl = document.getElementById('mr-e-notes');
      if (cEl) cEl.value = record.chief_complaint    || '';
      if (nEl) nEl.value = record.examination_notes  || '';

      /* العلامات الحيوية — الكائن مخزّن كـ JSON في DB */
      const vs = typeof record.vital_signs === 'object'
        ? (record.vital_signs || {})
        : {};
      _setVal('mr-e-bp',     vs.bp     || '');
      _setVal('mr-e-pulse',  vs.pulse  || '');
      _setVal('mr-e-temp',   vs.temp   || '');
      _setVal('mr-e-weight', vs.weight || '');

      document.getElementById('mr-edit-msg').hidden    = true;
      document.getElementById('mr-modal-edit').hidden  = false;
    }

    /* ── نافذة التشخيصات ────────────────────────────────────────── */
    async function openDiagnoses(recordId) {
      document.getElementById('mr-dx-record-id') && (
        document.getElementById('mr-dx-record-id').value = recordId
      );
      const dxForm = document.getElementById('mr-dx-form');
      if (dxForm) dxForm.reset();
      document.getElementById('mr-dx-msg').hidden = true;
      document.getElementById('mr-modal-dx').hidden = false;
      await loadDiagnoses(recordId);
    }

    /* ── جلب وعرض التشخيصات ─────────────────────────────────────── */
    async function loadDiagnoses(recordId) {
      const listEl = document.getElementById('mr-dx-list');
      listEl.innerHTML = `<div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>`;
      try {
        const data = await apiGet('/medical-records/' + recordId + '/diagnoses');
        const list = Array.isArray(data) ? data : (data.data || data.diagnoses || []);

        if (!list.length) {
          listEl.innerHTML = `<div class="empty-state" style="padding:.5rem">
            <div class="empty-icon" style="font-size:1.5rem"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <p style="font-size:.9rem">لا توجد تشخيصات مسجّلة لهذا السجل.</p>
          </div>`;
          return;
        }

        /* خريطة أنواع التشخيص للعرض */
        const typeMap = { primary: 'رئيسي', secondary: 'ثانوي', provisional: 'مبدئي' };

        listEl.innerHTML = `<div class="table-wrapper" style="margin:0">
          <table aria-label="التشخيصات">
            <thead>
              <tr>
                <th>#</th>
                <th>رمز ICD-10</th>
                <th>الوصف</th>
                <th>النوع</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((d, i) => `<tr>
                <td>${i + 1}</td>
                <td>${d.icd10_code
                  ? `<span class="badge badge-blue">${d.icd10_code}</span>` : '—'}</td>
                <td>${d.description || '—'}</td>
                <td>${typeMap[d.diagnosis_type] || d.diagnosis_type || '—'}</td>
                <td>${d.diagnosed_at ? new Date(d.diagnosed_at).toLocaleDateString('ar-IQ') : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      } catch (err) {
        listEl.innerHTML = `<p style="color:var(--clr-danger);padding:.5rem">تعذّر تحميل التشخيصات: ${err.message}</p>`;
      }
    }

    /* ── إرسال نموذج إنشاء السجل الطبي ─────────────────────────── */
    document.getElementById('mr-add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('mr-add-save');
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';

      /* بناء كائن vital_signs — أرسله فقط إن كان فيه بيانات */
      const vs = _buildVitalSigns('mr-vs-bp', 'mr-vs-pulse', 'mr-vs-temp', 'mr-vs-weight');

      const payload = {
        patient_id:        document.getElementById('mr-a-patient').value.trim(),
        visit_date:        document.getElementById('mr-a-date').value    || undefined,
        appointment_id:    document.getElementById('mr-a-appt').value.trim() || undefined,
        chief_complaint:   document.getElementById('mr-a-complaint').value.trim() || undefined,
        examination_notes: document.getElementById('mr-a-notes').value.trim()     || undefined,
        vital_signs:       Object.keys(vs).length ? vs : undefined,
      };
      /* حذف الحقول الفارغة */
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      try {
        await apiPost('/medical-records', payload);
        document.getElementById('mr-modal-add').hidden = true;
        _mrMsg('mr-msg', 'success', 'تم إنشاء السجل الطبي بنجاح.');
        await loadRecords();
      } catch (err) {
        _mrMsg('mr-add-msg', 'error', err.message || 'فشلت عملية الإنشاء.');
      } finally {
        btn.disabled = false; btn.textContent = 'حفظ';
      }
    });

    /* ── إرسال نموذج تعديل السجل الطبي ─────────────────────────── */
    document.getElementById('mr-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('mr-edit-save');
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';

      const recordId = document.getElementById('mr-e-id').value;
      const vs       = _buildVitalSigns('mr-e-bp', 'mr-e-pulse', 'mr-e-temp', 'mr-e-weight');

      const payload = {};
      /* الطبيب يُرسل كل الحقول، الممرض يُرسل vital_signs فقط */
      if (canDiagnose) {
        const cEl = document.getElementById('mr-e-complaint');
        const nEl = document.getElementById('mr-e-notes');
        if (cEl && cEl.value.trim()) payload.chief_complaint   = cEl.value.trim();
        if (nEl && nEl.value.trim()) payload.examination_notes = nEl.value.trim();
      }
      if (Object.keys(vs).length) payload.vital_signs = vs;

      if (!Object.keys(payload).length) {
        _mrMsg('mr-edit-msg', 'error', 'لم تُدخَل أي تعديلات.');
        btn.disabled = false; btn.textContent = 'حفظ التعديلات';
        return;
      }

      try {
        await apiPatch('/medical-records/' + recordId, payload);
        document.getElementById('mr-modal-edit').hidden = true;
        _mrMsg('mr-msg', 'success', 'تم تحديث السجل الطبي بنجاح.');
        await loadRecords();
      } catch (err) {
        _mrMsg('mr-edit-msg', 'error', err.message || 'فشلت عملية التحديث.');
      } finally {
        btn.disabled = false; btn.textContent = 'حفظ التعديلات';
      }
    });

    /* ── إرسال نموذج إضافة تشخيص ───────────────────────────────── */
    const dxForm = document.getElementById('mr-dx-form');
    if (dxForm) {
      dxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('mr-dx-save');
        btn.disabled = true; btn.textContent = 'جارٍ الإضافة...';

        const recordId = document.getElementById('mr-dx-record-id').value;
        const icdRaw   = document.getElementById('mr-dx-icd').value.trim().toUpperCase();

        const payload = {
          description:     document.getElementById('mr-dx-desc').value.trim(),
          icd10_code:      icdRaw || undefined,
          diagnosis_type:  document.getElementById('mr-dx-type').value || 'primary',
        };
        if (!payload.icd10_code) delete payload.icd10_code;

        try {
          await apiPost('/medical-records/' + recordId + '/diagnoses', payload);
          dxForm.reset();
          document.getElementById('mr-dx-record-id').value = recordId;
          _mrMsg('mr-dx-msg', 'success', 'تم إضافة التشخيص بنجاح.');
          await loadDiagnoses(recordId);
        } catch (err) {
          _mrMsg('mr-dx-msg', 'error', err.message || 'فشلت إضافة التشخيص.');
        } finally {
          btn.disabled = false; btn.textContent = 'إضافة التشخيص';
        }
      });
    }

    /* ── ربط الأزرار الثابتة ─────────────────────────────────────── */
    if (canCreate) {
      document.getElementById('mr-btn-add').addEventListener('click', openAdd);
    }

    document.getElementById('mr-add-cancel').addEventListener('click', () => {
      document.getElementById('mr-modal-add').hidden = true;
    });
    document.getElementById('mr-modal-add').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });

    document.getElementById('mr-edit-cancel').addEventListener('click', () => {
      document.getElementById('mr-modal-edit').hidden = true;
    });
    document.getElementById('mr-modal-edit').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });

    document.getElementById('mr-dx-close').addEventListener('click', () => {
      document.getElementById('mr-modal-dx').hidden = true;
    });
    document.getElementById('mr-modal-dx').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });

    /* ── تصدير الدوال لـ onclick داخل الجدول ────────────────────── */
    window.HMS.mr = { openEdit, openDiagnoses };

    /* ── تحميل البيانات الأولي ───────────────────────────────────── */
    await loadRecords();
  },
});

/* ── دوال مساعدة محلّية ──────────────────────────────────────────── */

/* عرض رسائل الحالة مع إخفاء تلقائي */
function _mrMsg(elId, type, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className   = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text;
  el.hidden      = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}

/* تعيين قيمة عنصر بأمان */
function _setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/* بناء كائن vital_signs من حقول الإدخال */
function _buildVitalSigns(bpId, pulseId, tempId, weightId) {
  const vs = {};
  const bp     = document.getElementById(bpId)?.value.trim();
  const pulse  = document.getElementById(pulseId)?.value.trim();
  const temp   = document.getElementById(tempId)?.value.trim();
  const weight = document.getElementById(weightId)?.value.trim();
  if (bp)     vs.bp     = bp;
  if (pulse)  vs.pulse  = pulse;
  if (temp)   vs.temp   = temp;
  if (weight) vs.weight = weight;
  return vs;
}
