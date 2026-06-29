/* =====================================================================
   modules/billing.js — وحدة الفوترة والمدفوعات
   ===================================================================== */
window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  id:    'billing',
  label: 'الفوترة',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  roles: ['admin', 'receptionist'],

  async render(container) {
    const canCreate = HMS_Auth.hasAnyRole(['admin', 'receptionist']);
    const canPay    = HMS_Auth.hasAnyRole(['admin', 'receptionist']);

    container.innerHTML = `
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> الفوترة والمدفوعات</h2>
        ${canCreate ? `<button class="btn btn-primary" id="btn-add-invoice">+ فاتورة جديدة</button>` : ''}
      </div>
      <div id="billing-msg" hidden></div>
      <div class="table-wrapper">
        <table aria-label="قائمة الفواتير">
          <thead>
            <tr><th>#</th><th>المريض</th><th>الإجمالي</th><th>المدفوع</th><th>الرصيد</th><th>تاريخ الاستحقاق</th><th>الحالة</th><th>إجراءات</th></tr>
          </thead>
          <tbody id="billing-tbody">
            <tr><td colspan="8"><div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div></td></tr>
          </tbody>
        </table>
      </div>

      <!-- نافذة الفاتورة الجديدة -->
      <div class="modal-overlay" id="inv-modal" hidden role="dialog" aria-modal="true">
        <div class="modal-box">
          <h3 class="modal-title">إنشاء فاتورة جديدة</h3>
          <div id="inv-modal-msg" hidden></div>
          <form id="inv-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="inv-patient">معرّف المريض *</label>
              <input class="form-control" id="inv-patient" required placeholder="UUID المريض" />
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-due">تاريخ الاستحقاق</label>
              <input class="form-control" id="inv-due" type="date" />
            </div>
            <div class="form-group">
              <label class="form-label" for="inv-notes">ملاحظات</label>
              <textarea class="form-control" id="inv-notes" placeholder="تفاصيل الفاتورة..."></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="inv-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary">إنشاء</button>
            </div>
          </form>
        </div>
      </div>

      <!-- نافذة تسجيل دفعة -->
      <div class="modal-overlay" id="pay-modal" hidden role="dialog" aria-modal="true">
        <div class="modal-box">
          <h3 class="modal-title">تسجيل دفعة</h3>
          <div id="pay-modal-msg" hidden></div>
          <form id="pay-form" novalidate>
            <input type="hidden" id="pay-invoice-id" />
            <div class="form-group">
              <label class="form-label" for="pay-amount">المبلغ *</label>
              <input class="form-control" id="pay-amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
            </div>
            <div class="form-group">
              <label class="form-label" for="pay-method">طريقة الدفع</label>
              <select class="form-control" id="pay-method">
                <option value="cash">نقداً</option>
                <option value="card">بطاقة</option>
                <option value="transfer">تحويل بنكي</option>
                <option value="insurance">تأمين</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="pay-ref">رقم المرجع</label>
              <input class="form-control" id="pay-ref" placeholder="رقم الإيصال أو التحويل" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="pay-cancel">إلغاء</button>
              <button type="submit" class="btn btn-success">تسجيل الدفعة</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const INV_STATUS = {
      unpaid:          ['badge-yellow', 'غير مدفوعة'],
      partially_paid:  ['badge-blue',   'مدفوعة جزئياً'],
      paid:            ['badge-green',  'مدفوعة'],
      cancelled:       ['badge-red',    'ملغاة'],
    };

    async function load() {
      try {
        const data  = await apiGet('/billing/invoices');
        const invs  = Array.isArray(data) ? data : (data.data || data.invoices || []);
        const tbody = document.getElementById('billing-tbody');

        if (!invs.length) {
          tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><p>لا توجد فواتير.</p></div></td></tr>`;
          return;
        }

        tbody.innerHTML = invs.map((inv, i) => {
          const [cls, lbl] = INV_STATUS[inv.status] || ['badge-gray', inv.status || '—'];
          const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString('ar-IQ') : '—';
          const total   = parseFloat(inv.total_amount  || 0).toLocaleString('ar-IQ');
          const paid    = parseFloat(inv.paid_amount   || 0).toLocaleString('ar-IQ');
          const balance = parseFloat(inv.balance_due   || (inv.total_amount - inv.paid_amount) || 0).toLocaleString('ar-IQ');
          return `<tr>
            <td>${i + 1}</td>
            <td>${inv.patient_name || inv.patient_id || '—'}</td>
            <td>${total} د.ع</td>
            <td>${paid} د.ع</td>
            <td>${balance} د.ع</td>
            <td>${due}</td>
            <td><span class="badge ${cls}">${lbl}</span></td>
            <td>
              ${canPay && inv.status !== 'paid' && inv.status !== 'cancelled' ? `
                <button class="btn btn-success btn-sm"
                  onclick="HMS.billing.openPay('${inv.id}')">دفعة</button>` : ''}
            </td>
          </tr>`;
        }).join('');
      } catch (err) {
        _bilMsg('billing-msg', 'error', 'تعذّر تحميل الفواتير: ' + err.message);
      }
    }

    window.HMS.billing = {
      openPay(invoiceId) {
        document.getElementById('pay-invoice-id').value = invoiceId;
        document.getElementById('pay-form').reset();
        document.getElementById('pay-invoice-id').value = invoiceId;
        document.getElementById('pay-modal-msg').hidden = true;
        document.getElementById('pay-modal').hidden = false;
      }
    };

    if (canCreate) {
      document.getElementById('btn-add-invoice').addEventListener('click', () => {
        document.getElementById('inv-form').reset();
        document.getElementById('inv-modal-msg').hidden = true;
        document.getElementById('inv-modal').hidden = false;
      });
    }
    ['inv-cancel', 'pay-cancel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => {
        document.getElementById(id === 'inv-cancel' ? 'inv-modal' : 'pay-modal').hidden = true;
      });
    });
    ['inv-modal', 'pay-modal'].forEach(id => {
      document.getElementById(id).addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.hidden = true;
      });
    });

    document.getElementById('inv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'جارٍ الإنشاء...';
      try {
        await apiPost('/billing/invoices', {
          patient_id: document.getElementById('inv-patient').value.trim(),
          due_date:   document.getElementById('inv-due').value || undefined,
          notes:      document.getElementById('inv-notes').value.trim() || undefined,
          items:      [],
        });
        document.getElementById('inv-modal').hidden = true;
        _bilMsg('billing-msg', 'success', 'تم إنشاء الفاتورة بنجاح.');
        await load();
      } catch (err) {
        _bilMsg('inv-modal-msg', 'error', err.message);
      } finally { btn.disabled = false; btn.textContent = 'إنشاء'; }
    });

    document.getElementById('pay-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn       = e.target.querySelector('[type=submit]');
      const invoiceId = document.getElementById('pay-invoice-id').value;
      btn.disabled = true; btn.textContent = 'جارٍ التسجيل...';
      try {
        await apiPost('/billing/invoices/' + invoiceId + '/payments', {
          amount:       parseFloat(document.getElementById('pay-amount').value),
          method:       document.getElementById('pay-method').value,
          reference_no: document.getElementById('pay-ref').value.trim() || undefined,
        });
        document.getElementById('pay-modal').hidden = true;
        _bilMsg('billing-msg', 'success', 'تم تسجيل الدفعة بنجاح.');
        await load();
      } catch (err) {
        _bilMsg('pay-modal-msg', 'error', err.message);
      } finally { btn.disabled = false; btn.textContent = 'تسجيل الدفعة'; }
    });

    await load();
  },
});

function _bilMsg(id, type, text) {
  const el = document.getElementById(id); if (!el) return;
  el.className = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text; el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}
