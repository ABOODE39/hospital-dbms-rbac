/* =====================================================================
   modules/lab.js — وحدة المختبر (طلبات الفحص + النتائج)
   ===================================================================== */
window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  id:    'lab',
  label: 'المختبر',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-4 6h14l-4-6V3"/><line x1="3" y1="9" x2="21" y2="9"/></svg>`,
  roles: ['admin', 'doctor', 'lab_technician', 'nurse'],

  async render(container) {
    const canOrder  = HMS_Auth.hasAnyRole(['admin', 'doctor']);
    const canResult = HMS_Auth.hasAnyRole(['admin', 'lab_technician']);

    container.innerHTML = `
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-4 6h14l-4-6V3"/><line x1="3" y1="9" x2="21" y2="9"/></svg> المختبر</h2>
        ${canOrder ? `<button class="btn btn-primary" id="btn-add-lab">+ طلب فحص</button>` : ''}
      </div>
      <div id="lab-msg" hidden></div>
      <div class="table-wrapper">
        <table aria-label="طلبات الفحص المختبري">
          <thead>
            <tr><th>#</th><th>المريض</th><th>نوع الفحص</th><th>الطبيب الطالب</th><th>تاريخ الطلب</th><th>الحالة</th><th>إجراءات</th></tr>
          </thead>
          <tbody id="lab-tbody">
            <tr><td colspan="7"><div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div></td></tr>
          </tbody>
        </table>
      </div>

      <!-- نافذة طلب فحص -->
      <div class="modal-overlay" id="lab-modal" hidden role="dialog" aria-modal="true">
        <div class="modal-box">
          <h3 class="modal-title">طلب فحص مختبري</h3>
          <div id="lab-modal-msg" hidden></div>
          <form id="lab-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="lab-patient">معرّف المريض *</label>
              <input class="form-control" id="lab-patient" required placeholder="UUID المريض" />
            </div>
            <div class="form-group">
              <label class="form-label" for="lab-test-id">معرّف نوع الفحص *</label>
              <input class="form-control" id="lab-test-id" required placeholder="UUID نوع الفحص" />
            </div>
            <div class="form-group">
              <label class="form-label" for="lab-priority">الأولوية</label>
              <select class="form-control" id="lab-priority">
                <option value="routine">عادية</option>
                <option value="urgent">عاجل</option>
                <option value="stat">فوري</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="lab-clinical-info">المعلومات السريرية</label>
              <textarea class="form-control" id="lab-clinical-info" placeholder="ملاحظات سريرية للمختبر..."></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="lab-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary">إرسال</button>
            </div>
          </form>
        </div>
      </div>

      <!-- نافذة إدخال النتيجة -->
      <div class="modal-overlay" id="result-modal" hidden role="dialog" aria-modal="true">
        <div class="modal-box">
          <h3 class="modal-title">إدخال نتيجة الفحص</h3>
          <div id="result-modal-msg" hidden></div>
          <form id="result-form" novalidate>
            <input type="hidden" id="result-order-id" />
            <div class="form-group">
              <label class="form-label" for="result-value">النتيجة *</label>
              <textarea class="form-control" id="result-value" required placeholder="نص النتيجة أو القيمة..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="result-unit">الوحدة</label>
              <input class="form-control" id="result-unit" placeholder="mg/dL, %, ...إلخ" />
            </div>
            <div class="form-group">
              <label class="form-label" for="result-ref">النطاق الطبيعي</label>
              <input class="form-control" id="result-ref" placeholder="مثال: 70-110" />
            </div>
            <div class="form-group">
              <label class="form-label" for="result-notes">ملاحظات الفني</label>
              <textarea class="form-control" id="result-notes" placeholder="ملاحظات إضافية..."></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="result-cancel">إلغاء</button>
              <button type="submit" class="btn btn-success">تسجيل النتيجة</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const STATUS_LAB = {
      pending:    ['badge-yellow', 'قيد الانتظار'],
      in_progress:['badge-blue',   'جارٍ التنفيذ'],
      completed:  ['badge-green',  'مكتمل'],
      cancelled:  ['badge-red',    'ملغى'],
    };

    const PRIORITY_MAP = { routine: 'عادية', urgent: 'عاجل', stat: 'فوري' };

    async function load() {
      try {
        const data  = await apiGet('/lab-orders');
        const orders = Array.isArray(data) ? data : (data.data || data.orders || []);
        const tbody  = document.getElementById('lab-tbody');

        if (!orders.length) {
          tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-4 6h14l-4-6V3"/><line x1="3" y1="9" x2="21" y2="9"/></svg></div><p>لا توجد طلبات فحص.</p></div></td></tr>`;
          return;
        }

        tbody.innerHTML = orders.map((o, i) => {
          const [cls, lbl] = STATUS_LAB[o.status] || ['badge-gray', o.status || '—'];
          const date = o.ordered_at ? new Date(o.ordered_at).toLocaleDateString('ar-IQ') : '—';
          return `<tr>
            <td>${i + 1}</td>
            <td>${o.patient_name || o.patient_id || '—'}</td>
            <td>${o.test_name    || o.lab_test_id || '—'}</td>
            <td>${o.doctor_name  || o.ordered_by  || '—'}</td>
            <td>${date}</td>
            <td><span class="badge ${cls}">${lbl}</span></td>
            <td>
              ${canResult && o.status !== 'completed' ? `
                <button class="btn btn-success btn-sm"
                  onclick="HMS.lab.openResult('${o.id}')">إدخال نتيجة</button>` : ''}
            </td>
          </tr>`;
        }).join('');
      } catch (err) {
        _labMsg('lab-msg', 'error', 'تعذّر تحميل طلبات الفحص: ' + err.message);
      }
    }

    window.HMS.lab = {
      openResult(orderId) {
        document.getElementById('result-order-id').value = orderId;
        document.getElementById('result-form').reset();
        document.getElementById('result-order-id').value = orderId;
        document.getElementById('result-modal-msg').hidden = true;
        document.getElementById('result-modal').hidden = false;
      }
    };

    /* ── نموذج طلب فحص ── */
    if (canOrder) {
      document.getElementById('btn-add-lab').addEventListener('click', () => {
        document.getElementById('lab-form').reset();
        document.getElementById('lab-modal-msg').hidden = true;
        document.getElementById('lab-modal').hidden = false;
      });
    }
    document.getElementById('lab-cancel').addEventListener('click', () => {
      document.getElementById('lab-modal').hidden = true;
    });
    document.getElementById('lab-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });
    document.getElementById('lab-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'جارٍ الإرسال...';
      try {
        await apiPost('/lab-orders', {
          patient_id:    document.getElementById('lab-patient').value.trim(),
          lab_test_id:   document.getElementById('lab-test-id').value.trim(),
          priority:      document.getElementById('lab-priority').value,
          clinical_info: document.getElementById('lab-clinical-info').value.trim() || undefined,
        });
        document.getElementById('lab-modal').hidden = true;
        _labMsg('lab-msg', 'success', 'تم إرسال طلب الفحص بنجاح.');
        await load();
      } catch (err) {
        _labMsg('lab-modal-msg', 'error', err.message);
      } finally { btn.disabled = false; btn.textContent = 'إرسال'; }
    });

    /* ── نموذج إدخال النتيجة ── */
    document.getElementById('result-cancel').addEventListener('click', () => {
      document.getElementById('result-modal').hidden = true;
    });
    document.getElementById('result-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });
    document.getElementById('result-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn     = e.target.querySelector('[type=submit]');
      const orderId = document.getElementById('result-order-id').value;
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';
      try {
        await apiPatch('/lab-orders/' + orderId + '/result', {
          result_value:    document.getElementById('result-value').value.trim(),
          result_unit:     document.getElementById('result-unit').value.trim() || undefined,
          reference_range: document.getElementById('result-ref').value.trim()  || undefined,
          technician_notes:document.getElementById('result-notes').value.trim()|| undefined,
        });
        document.getElementById('result-modal').hidden = true;
        _labMsg('lab-msg', 'success', 'تم تسجيل نتيجة الفحص بنجاح.');
        await load();
      } catch (err) {
        _labMsg('result-modal-msg', 'error', err.message);
      } finally { btn.disabled = false; btn.textContent = 'تسجيل النتيجة'; }
    });

    await load();
  },
});

function _labMsg(id, type, text) {
  const el = document.getElementById(id); if (!el) return;
  el.className = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text; el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}
