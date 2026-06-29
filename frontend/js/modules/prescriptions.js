/* =====================================================================
   modules/prescriptions.js — الوصفات الطبية وصرفها بالصيدلية
   الأدوار: admin, doctor, pharmacist, patient
   ===================================================================== */

/* تهيئة مساحة الأسماء العالمية */
window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  /* ── بيانات التسجيل ── */
  id:    'prescriptions',
  label: 'الوصفات الطبية',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/><path d="m15.5 15.5 5 5"/></svg>`,
  /* prescriptions:read → doctor, pharmacist, admin, patient */
  roles: ['admin', 'doctor', 'pharmacist', 'patient'],

  async render(container) {

    /* ── صلاحيات المستخدم الحالي ─────────────────────────────────── */
    /* prescriptions:create → doctor فقط */
    const canCreate  = HMS_Auth.hasAnyRole(['doctor']);
    /* prescriptions:update → pharmacist (صرف) و doctor (إلغاء + تعديل بنود) */
    const canDispense = HMS_Auth.hasAnyRole(['pharmacist', 'admin']);
    const canCancel   = HMS_Auth.hasAnyRole(['doctor', 'admin']);

    /* ── رسم الهيكل الأساسي ─────────────────────────────────────── */
    container.innerHTML = `
      <!-- رأس الوحدة -->
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/><path d="m15.5 15.5 5 5"/></svg> الوصفات الطبية</h2>
        ${canCreate ? `<button class="btn btn-primary" id="rx-btn-add">+ وصفة جديدة</button>` : ''}
      </div>

      <!-- رسائل العمليات -->
      <div id="rx-msg" hidden></div>

      <!-- شريط الفلتر -->
      <div class="search-bar" style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
        <select id="rx-filter-status" class="form-control" style="max-width:180px">
          <option value="">كل الحالات</option>
          <option value="active">فعّالة</option>
          <option value="dispensed">مصروفة</option>
          <option value="cancelled">ملغاة</option>
        </select>
        <button class="btn btn-secondary" id="rx-btn-filter">فلتر</button>
      </div>

      <!-- جدول الوصفات -->
      <div class="table-wrapper">
        <table id="rx-table" aria-label="قائمة الوصفات الطبية">
          <thead>
            <tr>
              <th>#</th>
              <th>المريض</th>
              <th>الطبيب</th>
              <th>تاريخ الإصدار</th>
              <th>عدد الأدوية</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody id="rx-tbody">
            <tr><td colspan="7" class="loading-cell">
              <div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>
            </td></tr>
          </tbody>
        </table>
      </div>

      <!-- ============================================================
           نافذة: إنشاء وصفة طبية (doctor فقط)
           الـ API يتطلب: medical_record_id, patient_id, items[] (لا يقبل قائمة فارغة)
           ============================================================ -->
      <div class="modal-overlay" id="rx-modal-add" hidden role="dialog"
           aria-modal="true" aria-labelledby="rx-add-title">
        <div class="modal-box" style="max-width:680px">
          <h3 class="modal-title" id="rx-add-title">إنشاء وصفة طبية جديدة</h3>
          <div id="rx-add-msg" hidden></div>
          <form id="rx-add-form" novalidate>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
              <div class="form-group">
                <label class="form-label" for="rx-a-patient">معرّف المريض *</label>
                <input class="form-control" id="rx-a-patient" required
                       placeholder="UUID المريض" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rx-a-record">معرّف السجل الطبي *</label>
                <input class="form-control" id="rx-a-record" required
                       placeholder="UUID السجل الطبي" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="rx-a-notes">ملاحظات الوصفة</label>
              <textarea class="form-control" id="rx-a-notes"
                        placeholder="تعليمات للصيدلاني..."></textarea>
            </div>

            <!-- بنود الأدوية — يجب بند واحد على الأقل -->
            <div style="border:1px solid var(--clr-border);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:1rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
                <h4 style="font-size:.95rem;font-weight:600">بنود الأدوية *</h4>
                <button type="button" class="btn btn-secondary btn-sm" id="rx-btn-add-item">
                  + إضافة دواء
                </button>
              </div>
              <div id="rx-items-container">
                <!-- يُملأ ديناميكياً بـ renderItemRow() -->
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="rx-add-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="rx-add-save">إنشاء الوصفة</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================
           نافذة: تفاصيل الوصفة وبنودها (قراءة + صرف/إلغاء)
           ============================================================ -->
      <div class="modal-overlay" id="rx-modal-view" hidden role="dialog"
           aria-modal="true" aria-labelledby="rx-view-title">
        <div class="modal-box" style="max-width:680px">
          <h3 class="modal-title" id="rx-view-title">تفاصيل الوصفة الطبية</h3>
          <div id="rx-view-msg" hidden></div>

          <!-- بيانات رأس الوصفة -->
          <div id="rx-view-header" style="
            background:var(--clr-primary-light);
            border-radius:var(--radius);
            padding:.75rem 1rem;
            margin-bottom:1rem;
            font-size:.9rem;
            line-height:1.8;
          "></div>

          <!-- جدول البنود -->
          <div id="rx-view-items"></div>

          <!-- أزرار الإجراءات -->
          <div id="rx-view-actions" style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap"></div>

          <div style="margin-top:1rem;text-align:start">
            <button type="button" class="btn btn-secondary" id="rx-view-close">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    /* ── خريطة حالات الوصفة ──────────────────────────────────────── */
    const STATUS_MAP = {
      active:    { cls: 'badge-blue',   label: 'فعّالة'   },
      dispensed: { cls: 'badge-green',  label: 'مصروفة'  },
      cancelled: { cls: 'badge-red',    label: 'ملغاة'   },
    };

    /* ── جلب وعرض الوصفات ───────────────────────────────────────── */
    async function loadPrescriptions(statusFilter) {
      try {
        const params = statusFilter ? { status: statusFilter } : {};
        const data   = await apiGet('/prescriptions', params);
        const list   = Array.isArray(data) ? data : (data.data || data.prescriptions || []);
        renderTable(list);
      } catch (err) {
        _rxMsg('rx-msg', 'error', 'تعذّر تحميل الوصفات: ' + err.message);
        document.getElementById('rx-tbody').innerHTML =
          `<tr><td colspan="7" style="text-align:center;color:var(--clr-danger);padding:1rem">خطأ في التحميل</td></tr>`;
      }
    }

    /* ── رسم جدول الوصفات ───────────────────────────────────────── */
    function renderTable(list) {
      const tbody = document.getElementById('rx-tbody');

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7">
          <div class="empty-state">
            <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="4"/><path d="m15.5 15.5 5 5"/></svg></div>
            <p>لا توجد وصفات طبية.</p>
          </div>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = list.map((rx, i) => {
        const s       = STATUS_MAP[rx.status] || { cls: 'badge-gray', label: rx.status || '—' };
        const issued  = rx.issued_at ? new Date(rx.issued_at).toLocaleDateString('ar-IQ') : '—';
        const itemsC  = rx.items_count !== undefined ? rx.items_count : '—';

        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${rx.patient_name || rx.patient_id || '—'}</strong></td>
          <td>${rx.doctor_name  || rx.doctor_id  || '—'}</td>
          <td>${issued}</td>
          <td style="text-align:center">${itemsC}</td>
          <td><span class="badge ${s.cls}">${s.label}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm"
              onclick="HMS.rx.openView('${rx.id}')">عرض</button>
            ${canDispense && rx.status === 'active' ? `
            <button class="btn btn-primary btn-sm"
              onclick="HMS.rx.dispense('${rx.id}')">صرف</button>` : ''}
            ${canCancel && rx.status === 'active' ? `
            <button class="btn btn-danger btn-sm"
              onclick="HMS.rx.cancel('${rx.id}')">إلغاء</button>` : ''}
          </td>
        </tr>`;
      }).join('');
    }

    /* ── فتح نافذة تفاصيل الوصفة ────────────────────────────────── */
    async function openView(rxId) {
      document.getElementById('rx-view-msg').hidden    = true;
      document.getElementById('rx-view-header').innerHTML = `
        <div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>`;
      document.getElementById('rx-view-items').innerHTML  = '';
      document.getElementById('rx-view-actions').innerHTML = '';
      document.getElementById('rx-modal-view').hidden     = false;

      try {
        const data = await apiGet('/prescriptions/' + rxId);
        const rx   = data.data || data;
        const s    = STATUS_MAP[rx.status] || { cls: 'badge-gray', label: rx.status || '—' };

        /* رأس الوصفة */
        document.getElementById('rx-view-header').innerHTML = `
          <strong>المريض:</strong> ${rx.patient_name || rx.patient_id || '—'}
          &nbsp;|&nbsp;
          <strong>رقم الملف:</strong> ${rx.medical_record_number || '—'}
          <br>
          <strong>الطبيب:</strong> ${rx.doctor_name || rx.doctor_id || '—'}
          &nbsp;|&nbsp;
          <strong>تاريخ الإصدار:</strong>
            ${rx.issued_at ? new Date(rx.issued_at).toLocaleDateString('ar-IQ') : '—'}
          <br>
          <strong>الحالة:</strong> <span class="badge ${s.cls}">${s.label}</span>
          ${rx.notes ? `<br><strong>ملاحظات:</strong> ${rx.notes}` : ''}
        `;

        /* جدول البنود */
        const items = rx.items || [];
        if (!items.length) {
          document.getElementById('rx-view-items').innerHTML =
            `<p style="color:var(--clr-text-muted);font-size:.9rem;margin:.5rem 0">لا توجد أدوية في هذه الوصفة.</p>`;
        } else {
          document.getElementById('rx-view-items').innerHTML = `
            <div class="table-wrapper" style="margin:0">
              <table aria-label="بنود الوصفة">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الدواء</th>
                    <th>الشكل</th>
                    <th>التركيز</th>
                    <th>الجرعة</th>
                    <th>التكرار</th>
                    <th>المدة</th>
                    <th>الكمية</th>
                    <th>تعليمات</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((it, i) => `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${it.medication_name || it.medication_id || '—'}</strong>
                      ${it.generic_name ? `<br><small style="color:var(--clr-text-muted)">${it.generic_name}</small>` : ''}</td>
                    <td>${it.form     || '—'}</td>
                    <td>${it.strength || '—'}</td>
                    <td>${it.dosage   || '—'}</td>
                    <td>${it.frequency || '—'}</td>
                    <td>${it.duration_days ? it.duration_days + ' يوم' : '—'}</td>
                    <td>${it.quantity  !== null && it.quantity !== undefined ? it.quantity : '—'}</td>
                    <td>${it.instructions || '—'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
        }

        /* أزرار الإجراءات داخل النافذة */
        const actEl = document.getElementById('rx-view-actions');
        if (rx.status === 'active') {
          if (canDispense) {
            actEl.innerHTML += `<button class="btn btn-primary"
              onclick="HMS.rx.dispense('${rx.id}')">صرف الوصفة</button>`;
          }
          if (canCancel) {
            actEl.innerHTML += `<button class="btn btn-danger"
              onclick="HMS.rx.cancel('${rx.id}')">إلغاء الوصفة</button>`;
          }
        }
      } catch (err) {
        _rxMsg('rx-view-msg', 'error', 'تعذّر تحميل تفاصيل الوصفة: ' + err.message);
      }
    }

    /* ── صرف وصفة (pharmacist/admin) ────────────────────────────── */
    async function dispense(rxId) {
      if (!confirm('تأكيد صرف هذه الوصفة؟ سيُخصَم المخزون تلقائياً.')) return;
      try {
        await apiPatch('/prescriptions/' + rxId + '/status', { status: 'dispensed' });
        _rxMsg('rx-msg', 'success', 'تم صرف الوصفة بنجاح وتحديث المخزون.');
        /* أعد تحميل القائمة وأغلق نافذة التفاصيل إن كانت مفتوحة */
        document.getElementById('rx-modal-view').hidden = true;
        await loadPrescriptions(document.getElementById('rx-filter-status').value || undefined);
      } catch (err) {
        _rxMsg('rx-msg', 'error', err.message || 'فشلت عملية الصرف.');
      }
    }

    /* ── إلغاء وصفة (doctor/admin) ──────────────────────────────── */
    async function cancel(rxId) {
      if (!confirm('تأكيد إلغاء هذه الوصفة؟')) return;
      try {
        await apiPatch('/prescriptions/' + rxId + '/status', { status: 'cancelled' });
        _rxMsg('rx-msg', 'success', 'تم إلغاء الوصفة.');
        document.getElementById('rx-modal-view').hidden = true;
        await loadPrescriptions(document.getElementById('rx-filter-status').value || undefined);
      } catch (err) {
        _rxMsg('rx-msg', 'error', err.message || 'فشل الإلغاء.');
      }
    }

    /* ── إدارة بنود الأدوية في نموذج الإنشاء ────────────────────── */
    let itemCounter = 0;

    function renderItemRow() {
      const idx  = itemCounter++;
      const wrap = document.createElement('div');
      wrap.id    = `rx-item-${idx}`;
      wrap.style.cssText = 'border:1px dashed var(--clr-border);border-radius:var(--radius-sm);padding:.6rem .75rem;margin-bottom:.5rem;position:relative';
      wrap.innerHTML = `
        <button type="button" class="btn btn-danger btn-sm"
          onclick="HMS.rx._removeItem(${idx})"
          style="position:absolute;top:.4rem;left:.4rem;padding:.15rem .5rem;font-size:.75rem"
          aria-label="حذف هذا البند">✕</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.5rem">
          <div class="form-group">
            <label class="form-label" for="rx-item-med-${idx}">معرّف الدواء *</label>
            <input class="form-control" id="rx-item-med-${idx}" required
                   placeholder="UUID الدواء" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rx-item-dosage-${idx}">الجرعة *</label>
            <input class="form-control" id="rx-item-dosage-${idx}" required
                   placeholder="مثال: قرص واحد" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rx-item-freq-${idx}">التكرار *</label>
            <input class="form-control" id="rx-item-freq-${idx}" required
                   placeholder="مثال: مرتان يومياً" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rx-item-days-${idx}">المدة (أيام)</label>
            <input class="form-control" type="number" id="rx-item-days-${idx}"
                   min="1" placeholder="7" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rx-item-qty-${idx}">الكمية</label>
            <input class="form-control" type="number" id="rx-item-qty-${idx}"
                   min="1" placeholder="14" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rx-item-inst-${idx}">تعليمات</label>
            <input class="form-control" id="rx-item-inst-${idx}"
                   placeholder="مثال: بعد الأكل" />
          </div>
        </div>
      `;
      document.getElementById('rx-items-container').appendChild(wrap);
    }

    /* حذف بند */
    window.HMS = window.HMS || { modules: [] };
    window.HMS.rx = window.HMS.rx || {};
    window.HMS.rx._removeItem = function(idx) {
      const el = document.getElementById('rx-item-' + idx);
      if (el) el.remove();
    };

    /* إضافة بند أول تلقائياً عند فتح النافذة */
    function openAdd() {
      document.getElementById('rx-add-form').reset();
      document.getElementById('rx-add-msg').hidden = true;
      document.getElementById('rx-items-container').innerHTML = '';
      itemCounter = 0;
      renderItemRow(); /* بند افتراضي أول */
      document.getElementById('rx-modal-add').hidden = false;
    }

    /* ── إرسال نموذج إنشاء الوصفة ──────────────────────────────── */
    document.getElementById('rx-add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('rx-add-save');
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';

      /* جمع بنود الأدوية من الـ DOM */
      const itemDivs = document.getElementById('rx-items-container').children;
      const items    = [];

      for (const div of itemDivs) {
        /* استخراج الـ idx من id="rx-item-{n}" */
        const n   = div.id.replace('rx-item-', '');
        const med = document.getElementById('rx-item-med-'    + n)?.value.trim();
        const dos = document.getElementById('rx-item-dosage-' + n)?.value.trim();
        const frq = document.getElementById('rx-item-freq-'   + n)?.value.trim();
        const day = document.getElementById('rx-item-days-'   + n)?.value;
        const qty = document.getElementById('rx-item-qty-'    + n)?.value;
        const ins = document.getElementById('rx-item-inst-'   + n)?.value.trim();

        if (!med || !dos || !frq) {
          _rxMsg('rx-add-msg', 'error', 'كل بند يتطلب: معرّف الدواء والجرعة والتكرار.');
          btn.disabled = false; btn.textContent = 'إنشاء الوصفة';
          return;
        }

        const item = { medication_id: med, dosage: dos, frequency: frq };
        if (day)  item.duration_days = parseInt(day, 10);
        if (qty)  item.quantity      = parseInt(qty, 10);
        if (ins)  item.instructions  = ins;
        items.push(item);
      }

      if (!items.length) {
        _rxMsg('rx-add-msg', 'error', 'أضف دواءً واحداً على الأقل.');
        btn.disabled = false; btn.textContent = 'إنشاء الوصفة';
        return;
      }

      const payload = {
        patient_id:        document.getElementById('rx-a-patient').value.trim(),
        medical_record_id: document.getElementById('rx-a-record').value.trim(),
        notes:             document.getElementById('rx-a-notes').value.trim() || undefined,
        items,
      };
      if (!payload.notes) delete payload.notes;

      try {
        await apiPost('/prescriptions', payload);
        document.getElementById('rx-modal-add').hidden = true;
        _rxMsg('rx-msg', 'success', 'تم إنشاء الوصفة الطبية بنجاح.');
        await loadPrescriptions(document.getElementById('rx-filter-status').value || undefined);
      } catch (err) {
        _rxMsg('rx-add-msg', 'error', err.message || 'فشل إنشاء الوصفة.');
      } finally {
        btn.disabled = false; btn.textContent = 'إنشاء الوصفة';
      }
    });

    /* ── ربط الأزرار الثابتة ─────────────────────────────────────── */
    if (canCreate) {
      document.getElementById('rx-btn-add').addEventListener('click', openAdd);
      document.getElementById('rx-btn-add-item').addEventListener('click', renderItemRow);
    }

    document.getElementById('rx-btn-filter').addEventListener('click', () => {
      const s = document.getElementById('rx-filter-status').value || undefined;
      loadPrescriptions(s);
    });

    document.getElementById('rx-add-cancel').addEventListener('click', () => {
      document.getElementById('rx-modal-add').hidden = true;
    });
    document.getElementById('rx-modal-add').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });

    document.getElementById('rx-view-close').addEventListener('click', () => {
      document.getElementById('rx-modal-view').hidden = true;
    });
    document.getElementById('rx-modal-view').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });

    /* ── تصدير الدوال لـ onclick داخل الجدول ────────────────────── */
    window.HMS.rx = Object.assign(window.HMS.rx || {}, {
      openView,
      dispense,
      cancel,
    });

    /* ── تحميل البيانات الأولي ───────────────────────────────────── */
    await loadPrescriptions();
  },
});

/* ── دالة مساعدة لعرض الرسائل ───────────────────────────────────── */
function _rxMsg(elId, type, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className   = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text;
  el.hidden      = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}
