/**
 * 마음아 놀자 - 힐링 배경음악 엔진 (풍경소리 & 빗소리)
 * - maum.chatgpts.kr 전용 Zen 앰비언트 사운드 시스템
 */

(function (global) {
  'use strict';

  const TRACKS = {
    windchime: {
      id: 'windchime',
      name: '산사 풍경소리',
      icon: '🎐',
      desc: '처마 끝 바람에 맑게 울리는 청동 풍경 소리',
      url: '/assets/audio/windchime.mp3'
    },
    rain: {
      id: 'rain',
      name: '고요한 빗소리',
      icon: '🌧️',
      desc: '마음의 번뇌를 차분히 씻어주는 부드러운 빗소리',
      url: '/assets/audio/rain.mp3'
    }
  };

  let audioInstance = null;
  let activeTrackId = null;
  let volume = 0.55;
  let isPlaying = false;

  // 로컬스토리지에서 이전 설정 복원
  try {
    const savedVol = localStorage.getItem('maum_ambient_vol');
    if (savedVol !== null) volume = parseFloat(savedVol);
  } catch (_) {}

  function getAudio() {
    if (!audioInstance) {
      audioInstance = new Audio();
      audioInstance.loop = true;
      audioInstance.volume = volume;
    }
    return audioInstance;
  }

  // 트랙 재생
  function play(trackId) {
    const track = TRACKS[trackId];
    if (!track) return;

    const audio = getAudio();

    if (activeTrackId === trackId && isPlaying) {
      return; // 이미 재생 중
    }

    // 다른 트랙 전환 시 부드러운 전환
    if (isPlaying) {
      fadeOut(() => {
        startTrack(track);
      });
    } else {
      startTrack(track);
    }
  }

  function startTrack(track) {
    const audio = getAudio();
    activeTrackId = track.id;
    audio.src = track.url;
    audio.volume = 0;

    const promise = audio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          isPlaying = true;
          fadeIn(volume);
          updateUI();
          dispatchChangeEvent();
        })
        .catch(err => {
          console.warn('[AmbientSound] Play blocked (user gesture required):', err);
          isPlaying = false;
          updateUI();
        });
    }
  }

  // 정지
  function stop() {
    if (!isPlaying || !audioInstance) {
      activeTrackId = null;
      isPlaying = false;
      updateUI();
      return;
    }

    fadeOut(() => {
      audioInstance.pause();
      audioInstance.currentTime = 0;
      activeTrackId = null;
      isPlaying = false;
      updateUI();
      dispatchChangeEvent();
    });
  }

  // 볼륨 페이드 인
  function fadeIn(targetVol, durationMs = 800) {
    if (!audioInstance) return;
    const steps = 16;
    const stepTime = durationMs / steps;
    const increment = targetVol / steps;
    let cur = 0;

    const timer = setInterval(() => {
      cur += increment;
      if (cur >= targetVol) {
        audioInstance.volume = Math.max(0, Math.min(1, targetVol));
        clearInterval(timer);
      } else {
        audioInstance.volume = Math.max(0, Math.min(1, cur));
      }
    }, stepTime);
  }

  // 볼륨 페이드 아웃
  function fadeOut(callback, durationMs = 600) {
    if (!audioInstance) {
      if (callback) callback();
      return;
    }
    const steps = 12;
    const stepTime = durationMs / steps;
    const startVol = audioInstance.volume;
    const decrement = startVol / steps;
    let cur = startVol;

    const timer = setInterval(() => {
      cur -= decrement;
      if (cur <= 0.05) {
        audioInstance.volume = 0;
        clearInterval(timer);
        if (callback) callback();
      } else {
        audioInstance.volume = Math.max(0, cur);
      }
    }, stepTime);
  }

  // 볼륨 조절
  function setVolume(val) {
    volume = Math.max(0, Math.min(1, val));
    if (audioInstance && isPlaying) {
      audioInstance.volume = volume;
    }
    try {
      localStorage.setItem('maum_ambient_vol', volume.toString());
    } catch (_) {}
    updateUI();
  }

  function toggle(trackId) {
    if (activeTrackId === trackId && isPlaying) {
      stop();
    } else {
      play(trackId);
    }
  }

  function dispatchChangeEvent() {
    window.dispatchEvent(new CustomEvent('maum:ambient-changed', {
      detail: {
        activeTrackId: activeTrackId,
        isPlaying: isPlaying,
        volume: volume
      }
    }));
  }

  // 화면 우하단 힐링 플로팅 위젯 렌더링
  function injectAmbientFloatingWidget() {
    if (document.getElementById('ambient-widget-root')) return;

    const widget = document.createElement('div');
    widget.id = 'ambient-widget-root';
    widget.className = 'ambient-floating-container';
    widget.innerHTML = `
      <!-- 플로팅 팝업 패널 -->
      <div class="ambient-popup-card" id="ambient-popup" style="display: none;">
        <div class="ambient-popup-header">
          <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
            <span>🎧</span> <span>마음 힐링 배경음</span>
          </div>
          <button type="button" class="ambient-close-btn" id="ambient-close-btn" title="닫기">✕</button>
        </div>

        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
          글을 읽거나 호흡할 때 편안한 자연의 소리를 곁들여보세요.
        </p>

        <!-- 트랙 선택 버튼 -->
        <div class="ambient-track-list">
          <button type="button" class="ambient-track-btn" id="ambient-track-windchime" data-track="windchime">
            <span class="ambient-track-icon">🎐</span>
            <div class="ambient-track-info">
              <div class="ambient-track-name">산사 풍경소리</div>
              <div class="ambient-track-desc">처마 끝 바람에 스치는 청동 풍경</div>
            </div>
            <span class="ambient-track-status" id="status-windchime">재생</span>
          </button>

          <button type="button" class="ambient-track-btn" id="ambient-track-rain" data-track="rain">
            <span class="ambient-track-icon">🌧️</span>
            <div class="ambient-track-info">
              <div class="ambient-track-name">고요한 빗소리</div>
              <div class="ambient-track-desc">번뇌를 씻어주는 부드러운 단비</div>
            </div>
            <span class="ambient-track-status" id="status-rain">재생</span>
          </button>
        </div>

        <!-- 볼륨 슬라이더 -->
        <div class="ambient-volume-bar">
          <span style="font-size: 0.85rem;">🔈</span>
          <input type="range" id="ambient-vol-slider" min="0" max="100" value="${Math.round(volume * 100)}" title="배경음 볼륨">
          <span style="font-size: 0.85rem;">🔊</span>
        </div>

        <!-- 끄기 버튼 -->
        <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
          <button type="button" id="ambient-stop-all-btn" class="btn-chip" style="font-size: 0.8rem; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-muted);">
            ⏹️ 배경음 끄기
          </button>
        </div>
      </div>

      <!-- 플로팅 토글 버튼 -->
      <button type="button" class="ambient-floating-trigger" id="ambient-trigger-btn" title="힐링 배경음악 (풍경 · 빗소리)">
        <span class="ambient-trigger-icon" id="ambient-trigger-icon">🎧</span>
        <span class="ambient-trigger-label" id="ambient-trigger-label">마음 소리</span>
      </button>
    `;

    document.body.appendChild(widget);

    // 이벤트 바인딩
    const triggerBtn = document.getElementById('ambient-trigger-btn');
    const popup = document.getElementById('ambient-popup');
    const closeBtn = document.getElementById('ambient-close-btn');
    const windBtn = document.getElementById('ambient-track-windchime');
    const rainBtn = document.getElementById('ambient-track-rain');
    const stopBtn = document.getElementById('ambient-stop-all-btn');
    const slider = document.getElementById('ambient-vol-slider');

    if (triggerBtn && popup) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.style.display = (popup.style.display === 'none' || !popup.style.display) ? 'block' : 'none';
      });

      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.style.display = 'none';
        });
      }

      document.addEventListener('click', (e) => {
        if (!widget.contains(e.target)) {
          popup.style.display = 'none';
        }
      });
    }

    if (windBtn) {
      windBtn.addEventListener('click', () => toggle('windchime'));
    }
    if (rainBtn) {
      rainBtn.addEventListener('click', () => toggle('rain'));
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => stop());
    }
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        setVolume(val);
      });
    }
  }

  function updateUI() {
    const triggerIcon = document.getElementById('ambient-trigger-icon');
    const triggerLabel = document.getElementById('ambient-trigger-label');
    const windBtn = document.getElementById('ambient-track-windchime');
    const rainBtn = document.getElementById('ambient-track-rain');
    const statusWind = document.getElementById('status-windchime');
    const statusRain = document.getElementById('status-rain');
    const triggerBtn = document.getElementById('ambient-trigger-btn');

    if (triggerIcon && triggerLabel) {
      if (isPlaying && activeTrackId) {
        const tr = TRACKS[activeTrackId];
        triggerIcon.textContent = tr ? tr.icon : '🎶';
        triggerLabel.textContent = tr ? tr.name.split(' ')[1] || tr.name : '재생 중';
        triggerBtn.classList.add('playing');
      } else {
        triggerIcon.textContent = '🎧';
        triggerLabel.textContent = '마음 소리';
        triggerBtn.classList.remove('playing');
      }
    }

    if (windBtn && statusWind) {
      const isCur = isPlaying && activeTrackId === 'windchime';
      windBtn.classList.toggle('active', isCur);
      statusWind.textContent = isCur ? '재생 중 ⏸' : '재생 ▶';
    }

    if (rainBtn && statusRain) {
      const isCur = isPlaying && activeTrackId === 'rain';
      rainBtn.classList.toggle('active', isCur);
      statusRain.textContent = isCur ? '재생 중 ⏸' : '재생 ▶';
    }
  }

  // 초기화
  document.addEventListener('DOMContentLoaded', () => {
    injectAmbientFloatingWidget();
    updateUI();
  });

  global.MaumAmbient = {
    play,
    stop,
    toggle,
    setVolume,
    getActiveTrack: () => activeTrackId,
    isPlaying: () => isPlaying,
    getTracks: () => TRACKS
  };
})(window);
