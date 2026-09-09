/* ============================================================
   관리자 페이지 전용 Supabase 클라이언트 (supabase-admin-client.js)

   - admin.html 에서만 로드됩니다. 사용자 페이지는 이 파일을 불러오지 않습니다.
   - 기존 사용자 클라이언트와 동일한 storageKey 를 사용하므로,
     이미 사이트에 로그인해 둔 세션을 그대로 인식합니다.
   - admin.html 에는 사용자 스크립트(script.js)를 로드하지 않으므로
     이 페이지 안에는 Supabase 클라이언트가 하나뿐입니다. (인스턴스 충돌 없음)
   ============================================================ */

(function () {
  if (typeof window === 'undefined') return;

  var url = window.SUPABASE_URL;
  var key = window.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.warn('[admin] Supabase 상수를 찾지 못했습니다. supabase-config.js 로드 순서를 확인해 주세요.');
    window.sbAdmin = null;
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('[admin] supabase-js 로드 실패 - 관리자 화면을 열 수 없습니다.');
    window.sbAdmin = null;
    return;
  }

  var authOptions = {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  };
  if (window.SUPABASE_AUTH_STORAGE_KEY) {
    authOptions.storageKey = window.SUPABASE_AUTH_STORAGE_KEY;
  }

  // 통계 테이블(page_views / service_members)은 모두 public 스키마에 있습니다.
  window.sbAdmin = window.supabase.createClient(url, key, {
    db: { schema: 'public' },
    auth: authOptions
  });
})();
