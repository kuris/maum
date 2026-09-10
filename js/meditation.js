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
  let selectedBowlType = 'clear'; // 'clear' (12s bell) | 'deep' (30s low resonance)

  // 실제 싱잉볼 고음질 음원 경로
  const BOWL_SOUNDS = {
    clear: '/assets/audio/singing-bowl.mp3',
    deep: '/assets/audio/singing-bowl-deep.mp3'
  };

  // 활성화된 오디오 인스턴스 관리
  let activeAudioInstances = [];

  // 오디오 프리로드
  function preloadBowlSounds() {
    try {
      Object.values(BOWL_SOUNDS).forEach(url => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
      });
    } catch (_) {}
  }
  preloadBowlSounds();

  // 모든 재생 중인 소리 부드럽게 페이드아웃
  function fadeOutActiveSounds() {
    activeAudioInstances.forEach(audio => {
      try {
        let v = audio.volume;
        const timer = setInterval(() => {
          v -= 0.15;
          if (v <= 0.05) {
            audio.pause();
            clearInterval(timer);
          } else {
            audio.volume = Math.max(0, v);
          }
        }, 50);
      } catch (_) {
        audio.pause();
      }
    });
    activeAudioInstances = [];
  }

  // 실제 싱잉볼 음원 재생 (실패 시 Web Audio 하모닉 합성 폴백)
  function playSingingBowlChime(typeOverride, volumeRatio) {
    if (!soundEnabled) return;
    const bowlType = typeOverride || selectedBowlType;
    const soundUrl = BOWL_SOUNDS[bowlType] || BOWL_SOUNDS.clear;
    const vol = typeof volumeRatio === 'number' ? volumeRatio : 0.85;

    try {
      const audio = new Audio(soundUrl);
      audio.volume = Math.max(0.05, Math.min(1.0, vol));

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            activeAudioInstances.push(audio);
            audio.onended = () => {
              activeAudioInstances = activeAudioInstances.filter(a => a !== audio);
            };
          })
          .catch(err => {
            console.warn('[Meditation] Real audio play blocked, falling back to Web Audio:', err);
            playSyntheticSingingBowl(vol);
          });
      }
    } catch (e) {
      console.warn('[Meditation] Audio playback error, fallback to synth:', e);
      playSyntheticSingingBowl(vol);
    }
  }

  // Web Audio API를 이용한 정밀 싱잉볼 물리 합성 (오프라인/폴백용)
  function playSyntheticSingingBowl(volumeRatio) {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!audioCtx) audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const vol = typeof volumeRatio === 'number' ? volumeRatio : 0.8;
      
      // 싱잉볼 고유의 비정수 배음 및 비트 진동 (432Hz 평화의 주파수 기반)
      const harmonics = [
        { f: 432, g: 0.35 * vol, type: 'sine', decay: 4.5 },
        { f: 433.5, g: 0.3 * vol, type: 'sine', decay: 4.2 }, // 1.5Hz 어쿠스틱 비팅 맥동
        { f: 1192, g: 0.12 * vol, type: 'triangle', decay: 3.5 }, // 2.76x 금속 차임 고주파
        { f: 2332, g: 0.05 * vol, type: 'sine', decay: 2.2 }
      ];

      harmonics.forEach(h => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = h.type;
        osc.frequency.setValueAtTime(h.f, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(h.g, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + h.decay);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + h.decay + 0.2);
      });
    } catch (e) {
      console.warn('[Meditation] Web Audio fallback skipped:', e);
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
    fadeOutActiveSounds();
    dispatchState('pause');
  }

  function resetBreathing() {
    clearInterval(timerInterval);
    isRunning = false;
    fadeOutActiveSounds();
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
    // 완료 시 깊고 웅장한 여운의 싱잉볼 울림
    playSingingBowlChime('deep', 1.0);

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
    //    CGAuth 는 .user / .client 속성을 제공하지 않습니다. record.js 의 cloud() 헬퍼를 씁니다.
    try {
      const cn = global.MaumRecord && global.MaumRecord.cloud && global.MaumRecord.cloud();
      if (cn) {
        const { error } = await cn.db.from('maum_meditation_logs').insert({
          user_id: cn.uid,
          duration_seconds: duration,
          technique: currentTechnique,
          completed: true,
          created_at: logItem.created_at
        });
        if (error) throw error;
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
    playChime: playSingingBowlChime,
    setBowlType: (type) => {
      if (BOWL_SOUNDS[type]) selectedBowlType = type;
      return selectedBowlType;
    },
    getBowlType: () => selectedBowlType
  };
})(window);
