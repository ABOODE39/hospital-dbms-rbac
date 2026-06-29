/* =====================================================================
   app.js — منسّق التطبيق الرئيسي
   يقرأ window.HMS.modules، يبني القائمة الجانبية، ويدير تبديل الوحدات
   ===================================================================== */

(function () {
  'use strict';

  /* ── 1. حارس الصفحة: يمنع الوصول بلا توكن ──────────────────── */
  if (!HMS_Auth.requireAuth()) return;

  /* ── 2. بيانات المستخدم الحالي ──────────────────────────────── */
  const user      = HMS_Auth.getCurrentUser();
  const userRoles = HMS_Auth.getUserRoles();

  /* ── 3. تعبئة الشريط العلوي ──────────────────────────────────── */
  function initTopbar() {
    const nameEl   = document.getElementById('topbar-username');
    const rolesEl  = document.getElementById('topbar-roles');
    const avatarEl = document.getElementById('topbar-avatar');

    if (!user) return;

    const displayName = user.full_name || user.username || user.name || 'مستخدم';
    nameEl.textContent   = displayName;
    rolesEl.textContent  = userRoles.join(' | ') || 'بلا دور';
    /* أول حرف من الاسم كصورة بديلة */
    avatarEl.textContent = displayName.charAt(0).toUpperCase();
  }

  /* ── 4. بناء القائمة الجانبية من window.HMS.modules ─────────── */
  function buildSidebar() {
    const nav     = document.getElementById('sidebar-nav');
    const modules = (window.HMS && window.HMS.modules) ? window.HMS.modules : [];

    /* تصفية الوحدات حسب أدوار المستخدم */
    const visible = modules.filter(mod => {
      if (!mod.roles || mod.roles.length === 0) return true;
      return mod.roles.some(r => userRoles.includes(r));
    });

    if (visible.length === 0) {
      nav.innerHTML = '<p style="color:rgba(255,255,255,.4);padding:1rem;font-size:.85rem;">لا توجد وحدات متاحة</p>';
      return visible;
    }

    visible.forEach((mod, idx) => {
      const li = document.createElement('div');
      li.className       = 'nav-item' + (idx === 0 ? ' active' : '');
      li.dataset.modId   = mod.id;
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-label', mod.label);
      li.innerHTML = `<span class="nav-icon" aria-hidden="true">${mod.icon || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'}</span>
                      <span>${mod.label}</span>`;

      /* نقر الفأرة */
      li.addEventListener('click', () => activateModule(mod, li));
      /* لوحة المفاتيح */
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') activateModule(mod, li);
      });

      nav.appendChild(li);
    });

    return visible;
  }

  /* ── 5. تفعيل وحدة وتحميل محتواها ──────────────────────────── */
  async function activateModule(mod, navEl) {
    /* تحديث القائمة: إزالة active من الكل ثم إضافتها للعنصر المختار */
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    navEl.classList.add('active');

    /* تحديث عنوان الشريط العلوي */
    const titleEl = document.getElementById('topbar-module-title');
    if (titleEl) titleEl.textContent = mod.label;

    /* مؤشر التحميل */
    const content = document.getElementById('content-area');
    content.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span>جارٍ تحميل ${mod.label}...</span>
      </div>`;

    try {
      await mod.render(content);
    } catch (err) {
      const msg = err?.message || 'حدث خطأ غير متوقع أثناء تحميل الوحدة.';
      content.innerHTML = `
        <div class="alert alert-error" role="alert">
          تعذّر تحميل وحدة "${mod.label}": ${msg}
        </div>`;
    }
  }

  /* ── 6. زر تسجيل الخروج ─────────────────────────────────────── */
  function initLogout() {
    const btn = document.getElementById('logout-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (confirm('هل تريد تسجيل الخروج؟')) HMS_Auth.logout();
      });
    }
  }

  /* ── 7. التهيئة الكاملة ──────────────────────────────────────── */
  function init() {
    initTopbar();
    initLogout();
    const visible = buildSidebar();

    /* تحميل أول وحدة مرئية تلقائياً */
    if (visible.length > 0) {
      const firstNavEl = document.querySelector('.nav-item');
      if (firstNavEl) activateModule(visible[0], firstNavEl);
    } else {
      const content = document.getElementById('content-area');
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <p>ليس لديك وحدات متاحة بصلاحياتك الحالية.</p>
        </div>`;
    }
  }

  /* تشغيل بعد اكتمال DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
