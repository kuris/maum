/**
 * 마음아 놀자 - 호흡 명상 타이머 및 Web Audio 차임벨 엔진
 */

(function (global) {
  'use strict';

  let audioCtx = null;
  let timerInterval = null;
  let remainingSeconds = 60;
  let totalDuration = 60;
  let isRunning = false;
  let currentPhase = 'ready'; // ready, inhale, hold, exhale, hold2
  let phaseTimer = 0;
  let soundEnabled = true;
  let currentTechnique = 'box'; // 'box' (4-4-4-4) or 'calm' (4-7-8)

  // Web Audio API를 이용한 싱잉볼(Tibetan Singing Bowl) 화음 차임 생성
  function playSingingBowlChime() {
    if (!soundEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!audioCtx) {
        audioCtx = new AudioCtxClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;
      // 기본 주파수 및 은은한 오버톤 배음 (432Hz 평화의 주파수 기반)
      const freqs = [432, 864, 1296, 2160];
      const gains = [0.4, 0.15, 0.08, 0.03];

      freqs.forEach((f, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);

        // 부드러운 시작(Attack)과 긴 감쇠(Decay)
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(gains[idx], now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 4.0);
      });
    } catch (e) {
      console.warn('[Meditation] Audio chime skipped:', e);
    }
  }

  // 호흡 패턴 주기 정의 (초 단위)
  const TECHNIQUES = {
    box: [
      { name: '들숨', key: 'inhale', duration: 4, label: '숨을 들이쉽니다' },
      { name: '멈춤', key: 'hold', duration: 4, label: '숨을 멈추고 고요히' },
      { name: '날숨', key: 'exhale', duration: 4, label: '천천히 비워냅니다' },
      { name: '멈춤', key: 'hold2', duration: 4, label: '비워진 평화를 느낍니다' }
    ],
    calm: [
      { name: '들숨', key: 'inhale', duration: 4, label: '코로 깊게 들이쉽니다' },
      { name: '멈춤', key: 'hold', duration: 7, label: '숨을 멈추어 산소를 채웁니다' },
      { name: '날숨', key: 'exhale', duration: 8, label: '입으로 부드럽게 내쉽니다' }
    ]
  };

  let phaseIndex = 0;

  function setTechnique(tech) {
    if (TECHNIQUES[tech]) {
      currentTechnique = tech;
    }
  }

  function setDuration(seconds) {
    totalDuration = seconds;
    remainingSeconds = seconds;
    updateTimerDisplay();
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
  }

  function startBreathing() {
    if (isRunning) return;
    isRunning = true;
    phaseIndex = 0;
    phaseTimer = 0;

    playSingingBowlChime();
    nextPhase();

    timerInterval = setInterval(() => {
      remainingSeconds--;
      phaseTimer++;

      const pattern = TECHNIQUES[currentTechnique];
      const cur = pattern[phaseIndex];

      if (phaseTimer >= cur.duration) {
        phaseIndex = (phaseIndex + 1) % pattern.length;
        phaseTimer = 0;
        nextPhase();
      } else {
        updatePhaseDisplay(cur.name, cur.duration - phaseTimer, cur.label);
      }

      updateTimerDisplay();

      if (remainingSeconds <= 0) {
        finishBreathing();
      }
    }, 1000);

    dispatchState('start');
  }

  function nextPhase() {
    const pattern = TECHNIQUES[currentTechnique];
    const cur = pattern[phaseIndex];
    currentPhase = cur.key;
    
    // 들숨 전환 시 은은한 소리
    if (cur.key === 'inhale' && phaseIndex === 0) {
      playSingingBowlChime();
    }

    const circle = document.querySelector('.breathing-circle-wrapper');
    if (circle) {
      circle.className = 'breathing-circle-wrapper ' + cur.key;
    }

    updatePhaseDisplay(cur.name, cur.duration - phaseTimer, cur.label);
  }

  function pauseBreathing() {
    if (!isRunning) return;
    clearInterval(timerInterval);
    isRunning = false;
    dispatchState('pause');
  }

  function resetBreathing() {
    clearInterval(timerInterval);
    isRunning = false;
    remainingSeconds = totalDuration;
    phaseIndex = 0;
    phaseTimer = 0;

    const circle = document.querySelector('.breathing-circle-wrapper');
    if (circle) {
      circle.className = 'breathing-circle-wrapper ready';
    }

    updatePhaseDisplay('준비', '', '마음을 차분히 가라앉히세요');
    updateTimerDisplay();
    dispatchState('reset');
  }

  function finishBreathing() {
    clearInterval(timerInterval);
    isRunning = false;
    playSingingBowlChime();

    const circle = document.querySelector('.breathing-circle-wrapper');
    if (circle) {
      circle.className = 'breathing-circle-wrapper ready';
    }

    updatePhaseDisplay('완료', '🕊️', '오늘의 평화로운 숨쉬기를 마쳤습니다');
    saveMeditationLog(totalDuration);
    dispatchState('finish');
  }

  function updatePhaseDisplay(name, secondsLeft, label) {
    const phaseEl = document.getElementById('breath-phase-text');
    const labelEl = document.getElementById('breath-label-text');
    if (phaseEl) phaseEl.textContent = name;
    if (labelEl) labelEl.textContent = label || '';
  }

  function updateTimerDisplay() {
    const timeEl = document.getElementById('breath-timer-display');
    if (!timeEl) return;
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    timeEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // 세션 완료 기록 저장 (LocalStorage + Supabase)
  async function saveMeditationLog(duration) {
    const logItem = {
      id: 'med-' + Date.now(),
      duration: duration,
      technique: currentTechnique,
      created_at: new Date().toISOString()
    };

    // 1. LocalStorage 저장
    try {
      const local = JSON.parse(localStorage.getItem('maum_meditation_logs') || '[]');
      local.unshift(logItem);
      localStorage.setItem('maum_meditation_logs', JSON.stringify(local.slice(0, 100)));
    } catch (e) {}

    // 2. Supabase 저장 (로그인 시)
    try {
      if (global.CGAuth && global.CGAuth.user && global.CGAuth.client) {
        const client = global.CGAuth.client;
        await client.from('maum_meditation_logs').insert({
          user_id: global.CGAuth.user.id,
          duration_seconds: duration,
          technique: currentTechnique,
          completed: true
        });
      }
    } catch (e) {
      console.warn('[Meditation] Cloud sync failed, kept locally:', e);
    }

    if (global.showToast) {
      global.showToast(`✨ ${Math.round(duration / 60)}분 명상을 완료했습니다.`);
    }
  }

  function dispatchState(status) {
    const evt = new CustomEvent('maum:meditation-state', {
      detail: { status, remaining: remainingSeconds, total: totalDuration }
    });
    window.dispatchEvent(evt);
  }

  global.MaumMeditation = {
    start: startBreathing,
    pause: pauseBreathing,
    reset: resetBreathing,
    setDuration: setDuration,
    setTechnique: setTechnique,
    toggleSound: toggleSound,
    isSoundEnabled: () => soundEnabled,
    isRunning: () => isRunning,
    playChime: playSingingBowlChime
  };
})(window);
