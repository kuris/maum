/**
 * 마음아 놀자 - 메인 스크립트 (main.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 패밀리 사이트 드롭다운 토글
  const familyBtn = document.getElementById('family-btn');
  const familyDropdown = document.getElementById('family-dropdown');

  if (familyBtn && familyDropdown) {
    familyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      familyDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      familyDropdown.classList.remove('show');
    });
  }

  // 2. 오늘의 마음 카드 렌더링
  renderTodayMindCard();

  // 3. 호흡 명상 위젯 초기화
  initHomeMeditation();

  // 4. 퀵 감정 기록 위젯 초기화
  initQuickMoodLogger();

  // 5. 마음 카드 뽑기 덱 초기화
  initHomeCardDraw();
});

// 오늘의 마음 카드 렌더링
function renderTodayMindCard() {
  const container = document.getElementById('today-card-mount');
  if (!container || typeof getTodayMaumDaily !== 'function') return;

  const today = getTodayMaumDaily();
  const isFav = window.MaumRecord ? window.MaumRecord.isFavorite('daily', today.id) : false;

  container.innerHTML = `
    <div class="daily-header">
      <span class="daily-badge">🪷 오늘의 성찰 · ${today.theme}</span>
      <span class="daily-date">${today.formattedDate}</span>
    </div>

    <div class="daily-quote-box">
      <div class="daily-quote-text">"${today.quote}"</div>
      <div class="daily-buddhist-term">
        <span>📖</span> ${today.buddhistTerm}
      </div>
    </div>

    <div class="daily-commentary">
      ${today.commentary}
    </div>

    <div class="daily-practice-card">
      <div class="practice-icon">🌱</div>
      <div class="practice-content">
        <h4>오늘의 작은 실천</h4>
        <p>${today.practice}</p>
      </div>
    </div>

    <div class="daily-card-footer">
      <span style="font-size: 0.85rem; color: var(--text-subtle);">
        매일 자정 새로운 마음 지혜가 선물처럼 찾아옵니다.
      </span>
      <div class="daily-card-actions">
        <button type="button" class="icon-btn ${isFav ? 'active' : ''}" id="fav-today-btn" title="보관함에 담기">
          <span>${isFav ? '❤️' : '🤍'}</span> <span>${isFav ? '보관됨' : '보관하기'}</span>
        </button>
        <button type="button" class="icon-btn" id="share-today-btn" title="지인에게 공유하기">
          <span>📤</span> <span>공유</span>
        </button>
      </div>
    </div>
  `;

  // 즐겨찾기 버튼 이벤트
  const favBtn = document.getElementById('fav-today-btn');
  if (favBtn && window.MaumRecord) {
    favBtn.addEventListener('click', async () => {
      const nowFav = await window.MaumRecord.toggleFavorite({
        content_type: 'daily',
        content_key: today.id,
        title: today.title,
        text: today.quote,
        category: today.theme
      });
      favBtn.classList.toggle('active', nowFav);
      favBtn.innerHTML = `<span>${nowFav ? '❤️' : '🤍'}</span> <span>${nowFav ? '보관됨' : '보관하기'}</span>`;
    });
  }

  // 공유 버튼 이벤트
  const shareBtn = document.getElementById('share-today-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: `마음아 놀자 - 오늘의 성찰: ${today.theme}`,
        text: `"${today.quote}" - ${today.practice}`,
        url: 'https://maum.chatgpts.kr'
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
          if (window.showToast) window.showToast('📋 글귀가 클립보드에 복사되었습니다.');
        } catch (_) {
          if (window.showToast) window.showToast('공유 기능을 지원하지 않는 브라우저입니다.');
        }
      }
    });
  }
}

// 홈 호흡 명상 위젯
function initHomeMeditation() {
  const startBtn = document.getElementById('med-start-btn');
  const resetBtn = document.getElementById('med-reset-btn');
  const soundBtn = document.getElementById('med-sound-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');

  if (!startBtn || !window.MaumMeditation) return;

  startBtn.addEventListener('click', () => {
    if (window.MaumMeditation.isRunning()) {
      window.MaumMeditation.pause();
      startBtn.innerHTML = '<span>▶️</span> <span>계속하기</span>';
    } else {
      window.MaumMeditation.start();
      startBtn.innerHTML = '<span>⏸️</span> <span>잠시멈춤</span>';
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      window.MaumMeditation.reset();
      startBtn.innerHTML = '<span>▶️</span> <span>명상 시작</span>';
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const enabled = window.MaumMeditation.toggleSound();
      soundBtn.innerHTML = enabled ? '<span>🔔</span> <span>소리 켬</span>' : '<span>🔕</span> <span>소리 끔</span>';
      if (enabled) window.MaumMeditation.playChime();
    });
  }

  const strikeHomeBtn = document.getElementById('med-strike-home-btn');
  if (strikeHomeBtn) {
    strikeHomeBtn.addEventListener('click', () => {
      window.MaumMeditation.playChime(null, 1.0);
      if (window.showToast) window.showToast('🪷 맑은 싱잉볼 소리와 함께 깊게 숨을 쉬어보세요.');
    });
  }

  // 시간 설정 (1분, 3분)
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const seconds = parseInt(btn.getAttribute('data-seconds'), 10) || 60;
      window.MaumMeditation.setDuration(seconds);
      startBtn.innerHTML = '<span>▶️</span> <span>명상 시작</span>';
    });
  });

  window.addEventListener('maum:meditation-state', (e) => {
    if (e.detail.status === 'finish') {
      startBtn.innerHTML = '<span>▶️</span> <span>다시 시작</span>';
    }
  });
}

// 퀵 감정 일기 위젯
function initQuickMoodLogger() {
  const container = document.getElementById('quick-mood-grid');
  const saveBtn = document.getElementById('quick-save-btn');
  const noteInput = document.getElementById('quick-note-input');

  if (!container || !window.MAUM_DATA) return;

  let selectedMood = 'peace';

  // 7가지 감정 렌더링
  container.innerHTML = window.MAUM_DATA.emotions.map(emo => `
    <button type="button" class="emotion-pill ${emo.key === selectedMood ? 'selected' : ''}" data-mood="${emo.key}">
      <span class="emo-icon">${emo.icon}</span>
      <span class="emo-label">${emo.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.emotion-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.emotion-pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.getAttribute('data-mood');
    });
  });

  if (saveBtn && window.MaumRecord) {
    saveBtn.addEventListener('click', async () => {
      const note = noteInput ? noteInput.value : '';
      const success = await window.MaumRecord.saveDailyLog({
        mood: selectedMood,
        note: note
      });

      if (success && noteInput) {
        noteInput.value = '';
      }
    });
  }
}

// 홈 마음 카드 뽑기 위젯
function initHomeCardDraw() {
  const drawArea = document.getElementById('deck-draw-area');
  const shuffleBtn = document.getElementById('deck-shuffle-btn');

  if (!drawArea || typeof getRandomMindCard !== 'function') return;

  function performDraw() {
    const card = getRandomMindCard();
    drawArea.innerHTML = `
      <div class="drawn-card-result">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span class="drawn-card-theme">${card.symbol} ${card.themeLabel} · ${card.keyword}</span>
          <button type="button" class="icon-btn" id="card-fav-btn" style="padding: 4px 10px; font-size: 0.8rem;">
            <span>🤍</span> <span>보관</span>
          </button>
        </div>
        <div class="drawn-card-quote">"${card.quote}"</div>
        <div class="drawn-card-desc">${card.desc}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-light);">
          <span style="font-size: 0.82rem; color: var(--text-subtle);">오늘 나에게 건네는 한 마디</span>
          <button type="button" class="btn-primary" id="card-redraw-btn" style="padding: 8px 16px; font-size: 0.86rem;">
            <span>🔄</span> <span>다시 뽑기</span>
          </button>
        </div>
      </div>
    `;

    // 보관함 추가 이벤트
    const cardFavBtn = document.getElementById('card-fav-btn');
    if (cardFavBtn && window.MaumRecord) {
      let isFav = window.MaumRecord.isFavorite('card', card.id);
      if (isFav) {
        cardFavBtn.innerHTML = '<span>❤️</span> <span>보관됨</span>';
      }
      cardFavBtn.addEventListener('click', async () => {
        const nowFav = await window.MaumRecord.toggleFavorite({
          content_type: 'card',
          content_key: card.id,
          title: `${card.themeLabel} : ${card.keyword}`,
          text: card.quote,
          category: card.themeLabel
        });
        cardFavBtn.innerHTML = `<span>${nowFav ? '❤️' : '🤍'}</span> <span>${nowFav ? '보관됨' : '보관'}</span>`;
      });
    }

    // 다시 뽑기 이벤트
    const redrawBtn = document.getElementById('card-redraw-btn');
    if (redrawBtn) {
      redrawBtn.addEventListener('click', performDraw);
    }
  }

  drawArea.addEventListener('click', (e) => {
    if (e.target.closest('.draw-card')) {
      performDraw();
    }
  });

  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', performDraw);
  }
}

// 무광고 및 프리미엄 사용자 판정 (공통 규칙)
function isAdFreeUser(profile) {
  return profile && (
    profile.role === 'admin' ||
    profile.ads_disabled === true ||
    profile.plan === 'premium'
  );
}

window.isAdFreeUser = isAdFreeUser;
