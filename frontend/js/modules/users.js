/* =====================================================================
   modules/users.js — وحدة إدارة المستخدمين (admin فقط)
   ===================================================================== */
window.HMS = window.HMS || { modules: [] };

window.HMS.modules.push({
  id:    'users',
  label: 'المستخدمون',
  icon:  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  roles: ['admin'],

  async render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2 class="module-title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> إدارة المستخدمين</h2>
        <button class="btn btn-primary" id="btn-add-user">+ مستخدم جديد</button>
      </div>
      <div id="users-msg" hidden></div>
      <div class="search-bar">
        <input type="text" id="users-search" class="form-control" placeholder="بحث بالاسم أو البريد..." />
      </div>
      <div class="table-wrapper">
        <table aria-label="قائمة المستخدمين">
          <thead>
            <tr><th>#</th><th>اسم المستخدم</th><th>الاسم الكامل</th><th>البريد</th><th>الأدوار</th><th>الحالة</th><th>إجراءات</th></tr>
          </thead>
          <tbody id="users-tbody">
            <tr><td colspan="7"><div class="loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div></td></tr>
          </tbody>
        </table>
      </div>

      <!-- نافذة إنشاء مستخدم -->
      <div class="modal-overlay" id="user-modal" hidden role="dialog" aria-modal="true">
        <div class="modal-box">
          <h3 class="modal-title">إنشاء حساب مستخدم جديد</h3>
          <div id="user-modal-msg" hidden></div>
          <form id="user-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="uf-username">اسم المستخدم *</label>
              <input class="form-control" id="uf-username" required placeholder="username" dir="ltr" />
            </div>
            <div class="form-group">
              <label class="form-label" for="uf-fullname">الاسم الكامل *</label>
              <input class="form-control" id="uf-fullname" required placeholder="الاسم الكامل" />
            </div>
            <div class="form-group">
              <label class="form-label" for="uf-email">البريد الإلكتروني</label>
              <input class="form-control" id="uf-email" type="email" placeholder="user@hospital.iq" dir="ltr" />
            </div>
            <div class="form-group">
              <label class="form-label" for="uf-password">كلمة المرور *</label>
              <input class="form-control" id="uf-password" type="password" required placeholder="8 أحرف على الأقل" dir="ltr" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="user-cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary">إنشاء</button>
            </div>
          </form>
        </div>
      </div>

      <!-- نافذة تعيين الأدوار -->
      <div class="modal-overlay" id="role-modal" hidden role="dialog" aria-modal="true">
        <div class="modal-box">
          <h3 class="modal-title">تعيين أدوار المستخدم</h3>
          <div id="role-modal-msg" hidden></div>
          <p id="role-user-label" style="margin-bottom:1rem;color:var(--clr-text-muted);font-size:.9rem;"></p>
          <div id="roles-checklist" style="display:flex;flex-wrap:wrap;gap:.6rem;margin-bottom:1.25rem;"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="role-cancel">إغلاق</button>
            <button type="button" class="btn btn-primary" id="role-save">حفظ الأدوار</button>
          </div>
        </div>
      </div>
    `;

    let allUsers = [];
    let allRoles = [];

    /* ── جلب الأدوار المتاحة مرة واحدة ── */
    async function loadRoles() {
      try {
        const data = await apiGet('/users/roles/list');
        allRoles   = Array.isArray(data) ? data : (data.data || data.roles || []);
      } catch { allRoles = []; }
    }

    async function load() {
      try {
        const data = await apiGet('/users');
        allUsers   = Array.isArray(data) ? data : (data.data || data.users || []);
        renderTable(allUsers);
      } catch (err) {
        _usrMsg('users-msg', 'error', 'تعذّر تحميل المستخدمين: ' + err.message);
      }
    }

    function renderTable(users) {
      const tbody = document.getElementById('users-tbody');
      if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><p>لا يوجد مستخدمون.</p></div></td></tr>`;
        return;
      }
      tbody.innerHTML = users.map((u, i) => {
        const roles = (u.roles || []).map(r => typeof r === 'string' ? r : r.name).join(', ') || '—';
        const active = u.is_active !== false
          ? '<span class="badge badge-green">نشط</span>'
          : '<span class="badge badge-red">معطّل</span>';
        return `<tr>
          <td>${i + 1}</td>
          <td dir="ltr">${u.username || '—'}</td>
          <td>${u.full_name || u.name || '—'}</td>
          <td dir="ltr">${u.email || '—'}</td>
          <td>${roles}</td>
          <td>${active}</td>
          <td>
            <button class="btn btn-secondary btn-sm"
              onclick="HMS.users.openRoles(${JSON.stringify(u).replace(/"/g,'&quot;')})">الأدوار</button>
            <button class="btn btn-${u.is_active !== false ? 'danger' : 'success'} btn-sm"
              onclick="HMS.users.toggleActive('${u.id}', ${u.is_active !== false})">
              ${u.is_active !== false ? 'تعطيل' : 'تفعيل'}
            </button>
          </td>
        </tr>`;
      }).join('');
    }

    /* ── بحث ── */
    document.getElementById('users-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderTable(q ? allUsers.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.full_name || u.name || '').toLowerCase().includes(q) ||
        (u.email     || '').toLowerCase().includes(q)
      ) : allUsers);
    });

    /* ── تفعيل/تعطيل ── */
    async function toggleActive(userId, currentlyActive) {
      if (!confirm(currentlyActive ? 'تعطيل هذا الحساب؟' : 'تفعيل هذا الحساب؟')) return;
      try {
        await apiPatch('/users/' + userId, { is_active: !currentlyActive });
        _usrMsg('users-msg', 'success', currentlyActive ? 'تم تعطيل الحساب.' : 'تم تفعيل الحساب.');
        await load();
      } catch (err) { _usrMsg('users-msg', 'error', err.message); }
    }

    /* ── نافذة الأدوار ── */
    let _currentRoleUserId = null;

    function openRoles(user) {
      _currentRoleUserId = user.id;
      document.getElementById('role-user-label').textContent = `المستخدم: ${user.username || user.full_name || user.id}`;
      const userRoleNames = (user.roles || []).map(r => typeof r === 'string' ? r : r.name);

      document.getElementById('roles-checklist').innerHTML = allRoles.map(r => {
        const roleName = r.name || r;
        const checked  = userRoleNames.includes(roleName) ? 'checked' : '';
        const rid      = r.id || roleName;
        return `<label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;
                  background:var(--clr-primary-light);padding:.35rem .75rem;border-radius:20px;font-size:.85rem;">
          <input type="checkbox" value="${rid}" data-name="${roleName}" ${checked} />
          ${roleName}
        </label>`;
      }).join('') || '<p style="color:var(--clr-text-muted);">لا توجد أدوار محدّدة في النظام.</p>';

      document.getElementById('role-modal-msg').hidden = true;
      document.getElementById('role-modal').hidden = false;
    }

    document.getElementById('role-save').addEventListener('click', async () => {
      if (!_currentRoleUserId) return;
      const checks = document.querySelectorAll('#roles-checklist input[type=checkbox]:checked');
      const roleIds = Array.from(checks).map(c => c.value);
      const btn = document.getElementById('role-save');
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';
      try {
        await apiPost('/users/' + _currentRoleUserId + '/roles', { role_ids: roleIds });
        document.getElementById('role-modal').hidden = true;
        _usrMsg('users-msg', 'success', 'تم تحديث أدوار المستخدم بنجاح.');
        await load();
      } catch (err) {
        _usrMsg('role-modal-msg', 'error', err.message);
      } finally { btn.disabled = false; btn.textContent = 'حفظ الأدوار'; }
    });

    window.HMS.users = { openRoles, toggleActive };

    /* ── نموذج المستخدم الجديد ── */
    document.getElementById('btn-add-user').addEventListener('click', () => {
      document.getElementById('user-form').reset();
      document.getElementById('user-modal-msg').hidden = true;
      document.getElementById('user-modal').hidden = false;
    });

    ['user-cancel', 'role-cancel'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        document.getElementById(id === 'user-cancel' ? 'user-modal' : 'role-modal').hidden = true;
      });
    });
    ['user-modal', 'role-modal'].forEach(id => {
      document.getElementById(id).addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.hidden = true;
      });
    });

    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'جارٍ الإنشاء...';
      try {
        await apiPost('/users', {
          username:  document.getElementById('uf-username').value.trim(),
          full_name: document.getElementById('uf-fullname').value.trim(),
          email:     document.getElementById('uf-email').value.trim()    || undefined,
          password:  document.getElementById('uf-password').value,
        });
        document.getElementById('user-modal').hidden = true;
        _usrMsg('users-msg', 'success', 'تم إنشاء الحساب بنجاح.');
        await load();
      } catch (err) {
        _usrMsg('user-modal-msg', 'error', err.message);
      } finally { btn.disabled = false; btn.textContent = 'إنشاء'; }
    });

    await loadRoles();
    await load();
  },
});

function _usrMsg(id, type, text) {
  const el = document.getElementById(id); if (!el) return;
  el.className = 'alert alert-' + (type === 'error' ? 'error' : 'success');
  el.textContent = text; el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}
