/**
 * 마음아 놀자 - 감정 일기(성찰 기록) 및 즐겨찾기 엔진 (record.js)
 */

(function (global) {
  'use strict';

  const STORAGE_LOGS_KEY = 'maum_daily_logs';
  const STORAGE_FAVS_KEY = 'maum_favorites';

  // ------------------------------------------------------------
  // CGAuth 공개 API 접근자
  //   CGAuth 에는 .user / .client 속성이 없습니다. 반드시 getUser() / getClient()
  //   (공통 테이블은 getPublicDb()) 를 호출해야 합니다.
  //   로그인 전이거나 Supabase 가 없으면 null 을 돌려줍니다.
  // ------------------------------------------------------------
  function cloud() {
    const A = global.CGAuth;
    if (!A || typeof A.getUser !== 'function') return null;
    const u = A.getUser();
    if (!u || !u.id) return null;
    const c = (typeof A.getPublicDb === 'function' && A.getPublicDb()) ||
              (typeof A.getClient === 'function' && A.getClient()) || null;
    if (!c) return null;
    return { db: c, uid: u.id };
  }

  // 글로벌 토스트 알림 함수
  function showToast(message, duration = 2800) {
    let toast = document.getElementById('maum-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'maum-toast';
      toast.className = 'toast-msg';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // 감정 성찰 일기 저장
  async function saveDailyLog(entry) {
    if (!entry || !entry.mood) {
      showToast('⚠️ 오늘의 마음 상태(감정)를 선택해 주세요.');
      return false;
    }

    const logItem = {
      id: 'log-' + Date.now(),
      mood: entry.mood,
      note: (entry.note || '').trim(),
      gratitude: (entry.gratitude || '').trim(),
      let_go: (entry.let_go || '').trim(),
      created_at: new Date().toISOString()
    };

    // 1. Supabase 클라우드 저장 (로그인 시)
    let synced = false;
    try {
      const cn = cloud();
      if (cn) {
        const { error } = await cn.db.from('maum_daily_logs').insert({
          user_id: cn.uid,
          mood: logItem.mood,
          note: logItem.note || null,
          gratitude: logItem.gratitude || null,
          let_go: logItem.let_go || null,
          created_at: logItem.created_at
        });
        if (error) throw error;
        synced = true;
      }
    } catch (e) {
      console.warn('[Record] Cloud sync skipped, saved locally:', e);
    }

    // 2. 로컬스토리지 저장 (_synced 를 남겨 재로그인 시 중복 업로드를 막습니다)
    try {
      logItem._synced = synced;
      const logs = JSON.parse(localStorage.getItem(STORAGE_LOGS_KEY) || '[]');
      logs.unshift(logItem);
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
    } catch (e) {
      console.warn('[Record] Local storage write error:', e);
    }

    showToast(synced ? '🌸 마음에 소중히 기록되었습니다 (클라우드 저장)' : '🌸 마음에 소중히 기록되었습니다');
    
    // UI 업데이트 이벤트
    window.dispatchEvent(new CustomEvent('maum:log-saved', { detail: logItem }));
    return true;
  }

  // 로컬 기록 조회
  function getLocalLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_LOGS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  // ============================================================
  // 즐겨찾기(Favorites) 관리
  // ============================================================
  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_FAVS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function isFavorite(type, key) {
    const list = getFavorites();
    return list.some(item => item.content_type === type && item.content_key === key);
  }

  async function toggleFavorite(item) {
    // item: { content_type: 'daily'|'wisdom'|'card', content_key: string, title: string, text: string, category?: string }
    const list = getFavorites();
    const existingIndex = list.findIndex(i => i.content_type === item.content_type && i.content_key === item.content_key);
    let isFavNow = false;

    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
      isFavNow = false;
      showToast('🤍 보관함에서 삭제되었습니다.');
    } else {
      list.unshift({
        ...item,
        created_at: new Date().toISOString()
      });
      isFavNow = true;
      showToast('🪷 마음 보관함에 담았습니다.');
    }

    try {
      localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify(list));
    } catch (e) {}

    // Supabase 동기화 (로그인 시)
    try {
      const cn = cloud();
      if (cn) {
        if (isFavNow) {
          const { error } = await cn.db.from('maum_favorites').upsert({
            user_id: cn.uid,
            content_type: item.content_type,
            content_key: item.content_key,
            title: item.title,
            text: item.text,
            category: item.category || null
          }, { onConflict: 'user_id,content_type,content_key' });
          if (error) throw error;
          // 업로드가 끝난 항목은 _synced 를 남겨 중복 업로드를 막습니다
          const saved = JSON.parse(localStorage.getItem(STORAGE_FAVS_KEY) || '[]');
          const hit = saved.find(i => i.content_type === item.content_type && i.content_key === item.content_key);
          if (hit) {
            hit._synced = true;
            localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify(saved));
          }
        } else {
          const { error } = await cn.db.from('maum_favorites')
            .delete()
            .match({
              user_id: cn.uid,
              content_type: item.content_type,
              content_key: item.content_key
            });
          if (error) throw error;
        }
      }
    } catch (e) {
      console.warn('[Record] Fav cloud sync error:', e);
    }

    window.dispatchEvent(new CustomEvent('maum:fav-updated', { detail: { item, isFav: isFavNow } }));
    return isFavNow;
  }

  // 로그인 시 로컬 데이터를 클라우드로 마이그레이션
  //   my.html 과 아래 auth 이벤트 핸들러가 동시에 호출할 수 있어 중복 업로드를 막습니다.
  let syncInFlight = null;
  function syncLocalToCloud() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = doSyncLocalToCloud().then(
      (v) => { syncInFlight = null; return v; },
      (e) => { syncInFlight = null; throw e; }
    );
    return syncInFlight;
  }

  async function doSyncLocalToCloud() {
    const cn = cloud();
    if (!cn) return;
    const client = cn.db;
    const uid = cn.uid;

    // 1. 일기 동기화
    const localLogs = getLocalLogs();
    if (localLogs.length > 0) {
      for (const log of localLogs) {
        if (log._synced) continue;
        try {
          const { error } = await client.from('maum_daily_logs').insert({
            user_id: uid,
            mood: log.mood,
            note: log.note || null,
            gratitude: log.gratitude || null,
            let_go: log.let_go || null,
            created_at: log.created_at || new Date().toISOString()
          });
          if (!error) log._synced = true;
        } catch (_) {}
      }
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(localLogs));
    }

    // 2. 즐겨찾기 동기화
    const favs = getFavorites();
    if (favs.length > 0) {
      for (const f of favs) {
        if (f._synced) continue;
        try {
          const { error } = await client.from('maum_favorites').upsert({
            user_id: uid,
            content_type: f.content_type,
            content_key: f.content_key,
            title: f.title,
            text: f.text,
            category: f.category || null
          }, { onConflict: 'user_id,content_type,content_key' });
          if (!error) f._synced = true;
        } catch (_) {}
      }
      localStorage.setItem(STORAGE_FAVS_KEY, JSON.stringify(favs));
    }
  }

  // CGAuth 인증 상태 변화 감지 및 동기화
  if (global.CGAuth && typeof global.CGAuth.onChange === 'function') {
    global.CGAuth.onChange((detail) => {
      if (detail && detail.user) {
        syncLocalToCloud();
      }
    });
  }
  document.addEventListener('cg:auth-changed', (e) => {
    if (e.detail && e.detail.user) {
      syncLocalToCloud();
    }
  });

  global.showToast = showToast;
  global.MaumRecord = {
    cloud,
    saveDailyLog,
    getLocalLogs,
    getFavorites,
    isFavorite,
    toggleFavorite,
    syncLocalToCloud
  };
})(window);
