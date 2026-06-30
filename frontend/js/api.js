/* =====================================================================
   api.js — طبقة التواصل مع الـ Backend
   يُصدِّر: apiGet, apiPost, apiPatch, apiDelete
   ===================================================================== */

(function (global) {
  'use strict';

  /* ── كشف وضع العرض التجريبي ──────────────────────────────────── */
  var DEMO_MODE = (
    window.FORCE_DEMO === true ||
    location.hostname.endsWith('github.io') ||
    location.hostname.includes('pages.dev') ||
    location.hostname.includes('netlify.app') ||
    /* صفحة مفتوحة مباشرة كـ file:// */
    location.protocol === 'file:'
  );

  /* القاعدة الثابتة للـ API (تُستخدم فقط خارج وضع العرض) */
  const BASE = 'http://localhost:3000/api/v1';

  /* ── استرجاع التوكن من localStorage ── */
  function getToken() {
    return localStorage.getItem('hms_token') || '';
  }

  /* ── بناء رؤوس الطلب الموحّدة ── */
  function buildHeaders(extra) {
    const token = getToken();
    return Object.assign(
      {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      },
      extra || {}
    );
  }

  /* ── معالجة الاستجابة الموحّدة ── */
  async function handleResponse(res) {
    /* 401 → انتهت الجلسة، أعِد للدخول */
    if (res.status === 401) {
      localStorage.removeItem('hms_token');
      localStorage.removeItem('hms_user');
      window.location.href = 'index.html';
      return;
    }

    /* 403 → غير مخوّل */
    if (res.status === 403) {
      throw new ApiError('غير مخوّل: ليس لديك صلاحية تنفيذ هذا الإجراء.', 403);
    }

    /* استخراج الجسم */
    let body;
    try {
      body = await res.json();
    } catch {
      body = {};
    }

    if (!res.ok) {
      /* رسالة الخطأ من الـ backend أو رسالة افتراضية */
      const msg = body?.message || body?.error || `خطأ ${res.status}`;
      throw new ApiError(msg, res.status, body);
    }

    return body;
  }

  /* ── فئة الخطأ المخصّصة ── */
  function ApiError(message, status, data) {
    this.message = message;
    this.status  = status;
    this.data    = data || null;
    this.name    = 'ApiError';
  }
  ApiError.prototype = Object.create(Error.prototype);

  /* ── وسيط وضع العرض: يُحوّل استجابة DEMO.handle إلى وعد أو خطأ ── */
  async function demoCall(method, path, body) {
    if (!global.DEMO) {
      throw new ApiError('demo-data.js غير محمّل. تأكّد من ترتيب السكريبتات.', 500);
    }
    try {
      const result = await global.DEMO.handle(method, path, body);
      return result;
    } catch (err) {
      /* إذا كان الخطأ 401 أعِد توجيه الصفحة */
      if (err && err.status === 401) {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('hms_user');
        window.location.href = 'index.html';
        return;
      }
      /* إعادة رمي الخطأ كـ ApiError */
      throw new ApiError(
        err.message || 'خطأ في وضع العرض',
        err.status  || 500
      );
    }
  }

  /* ── GET ── */
  async function apiGet(path, params) {
    let fullPath = path;
    if (params && Object.keys(params).length) {
      fullPath += '?' + new URLSearchParams(params).toString();
    }

    if (DEMO_MODE) return demoCall('GET', fullPath, null);

    let url = BASE + fullPath;
    const res = await fetch(url, {
      method:  'GET',
      headers: buildHeaders(),
    });
    return handleResponse(res);
  }

  /* ── POST ── */
  async function apiPost(path, body) {
    if (DEMO_MODE) return demoCall('POST', path, body);

    const res = await fetch(BASE + path, {
      method:  'POST',
      headers: buildHeaders(),
      body:    JSON.stringify(body || {}),
    });
    return handleResponse(res);
  }

  /* ── PATCH ── */
  async function apiPatch(path, body) {
    if (DEMO_MODE) return demoCall('PATCH', path, body);

    const res = await fetch(BASE + path, {
      method:  'PATCH',
      headers: buildHeaders(),
      body:    JSON.stringify(body || {}),
    });
    return handleResponse(res);
  }

  /* ── DELETE ── */
  async function apiDelete(path) {
    if (DEMO_MODE) return demoCall('DELETE', path, null);

    const res = await fetch(BASE + path, {
      method:  'DELETE',
      headers: buildHeaders(),
    });
    return handleResponse(res);
  }

  /* ── تصدير عبر النافذة ── */
  global.apiGet    = apiGet;
  global.apiPost   = apiPost;
  global.apiPatch  = apiPatch;
  global.apiDelete = apiDelete;
  global.ApiError  = ApiError;

  /* ── تصدير علامة الوضع للاستخدام في الشارة ── */
  global.HMS_DEMO_MODE = DEMO_MODE;

})(window);
