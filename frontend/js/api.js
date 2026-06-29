/* =====================================================================
   api.js — طبقة التواصل مع الـ Backend
   يُصدِّر: apiGet, apiPost, apiPatch, apiDelete
   ===================================================================== */

(function (global) {
  'use strict';

  /* القاعدة الثابتة للـ API */
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

  /* ── GET ── */
  async function apiGet(path, params) {
    let url = BASE + path;
    if (params && Object.keys(params).length) {
      url += '?' + new URLSearchParams(params).toString();
    }
    const res = await fetch(url, {
      method:  'GET',
      headers: buildHeaders(),
    });
    return handleResponse(res);
  }

  /* ── POST ── */
  async function apiPost(path, body) {
    const res = await fetch(BASE + path, {
      method:  'POST',
      headers: buildHeaders(),
      body:    JSON.stringify(body || {}),
    });
    return handleResponse(res);
  }

  /* ── PATCH ── */
  async function apiPatch(path, body) {
    const res = await fetch(BASE + path, {
      method:  'PATCH',
      headers: buildHeaders(),
      body:    JSON.stringify(body || {}),
    });
    return handleResponse(res);
  }

  /* ── DELETE ── */
  async function apiDelete(path) {
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

})(window);
