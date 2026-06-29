/* =====================================================================
   auth.js — إدارة المصادقة والجلسة
   يُصدِّر: HMS_Auth.handleLogin, HMS_Auth.logout, HMS_Auth.getCurrentUser
   ===================================================================== */

(function (global) {
  'use strict';

  const TOKEN_KEY = 'hms_token';
  const USER_KEY  = 'hms_user';

  /* ── تسجيل الدخول ──────────────────────────────────────────────── */
  async function handleLogin(username, password) {
    try {
      const data = await apiPost('/auth/login', { username, password });

      /* الـ backend يُرجع: { token, user: { id, username, roles, ... } } */
      const token = data.token || data.accessToken || data.access_token;
      const user  = data.user  || data.data?.user  || data;

      if (!token) {
        return { ok: false, message: 'لم يتم استلام رمز المصادقة من الخادم.' };
      }

      /* تخزين البيانات */
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY,  JSON.stringify(user));

      /* الانتقال للوحة */
      window.location.href = 'dashboard.html';
      return { ok: true };

    } catch (err) {
      const msg = err?.message || 'فشل تسجيل الدخول. تحقّق من البيانات وأعِد المحاولة.';
      return { ok: false, message: msg };
    }
  }

  /* ── تسجيل الخروج ───────────────────────────────────────────────── */
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'index.html';
  }

  /* ── استرجاع بيانات المستخدم الحالي ──────────────────────────── */
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /* ── حارس الصفحة: يتحقق من وجود توكن صالح ──────────────────── */
  function requireAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  /* ── استرجاع أدوار المستخدم كمصفوفة نصية ─────────────────────── */
  function getUserRoles() {
    const user = getCurrentUser();
    if (!user) return [];

    /* الـ backend قد يُرسل roles كـ [{name:'admin'}, ...] أو ['admin', ...] */
    const roles = user.roles || [];
    return roles.map(r => (typeof r === 'string' ? r : r.name));
  }

  /* ── هل المستخدم لديه أحد الأدوار المطلوبة؟ ─────────────────── */
  function hasAnyRole(requiredRoles) {
    const userRoles = getUserRoles();
    return requiredRoles.some(r => userRoles.includes(r));
  }

  /* ── تصدير ─────────────────────────────────────────────────────── */
  global.HMS_Auth = {
    handleLogin,
    logout,
    getCurrentUser,
    requireAuth,
    getUserRoles,
    hasAnyRole,
  };

})(window);
