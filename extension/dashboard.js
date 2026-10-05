/**
 * Anti-Distraction - Live Keyword Sentinel
 * Core Engine: Speech Recognition, Web Audio Synthesizer, Dynamic Visualizer & Keyword Trigger
 * YouTube Embedded Player Sentinel & Direct Extension Two-Way Synchronization Bridge
 */

// Application State
const state = {
  isListening: false,
  audioSource: 'mic', // 'mic' | 'tab' | 'simulation' | 'youtube'
  language: 'pt-BR',
  keywords: [
    { text: 'meu nome', category: 'urgent' },
    { text: 'prova', category: 'academic' },
    { text: 'trabalho', category: 'academic' },
    { text: 'apresentar', category: 'meeting' },
    { text: 'urgente', category: 'urgent' },
    { text: 'atenção', category: 'urgent' },
    { text: 'dúvida', category: 'meeting' },
    { text: 'sorteio', category: 'custom' }
  ],
  alertSound: 'chime',
  volume: 0.8,
  gainMultiplier: 1.5,
  gainNode: null,
  visualAlert: true,
  desktopNotify: true,
  ttsVoice: false,
  cooldownMs: 3500,
  lastAlertTime: 0,
  history: [],
  stream: null,
  recognition: null,
  audioContext: null,
  analyser: null,
  animationFrameId: null
};

// Preset Kits
const PRESETS = {
  academic: [
    { text: 'prova', category: 'academic' },
    { text: 'vai cair', category: 'academic' },
    { text: 'trabalho', category: 'academic' },
    { text: 'exercício', category: 'academic' },
    { text: 'chamada', category: 'academic' },
    { text: 'anotem isso', category: 'academic' },
    { text: 'data de entrega', category: 'academic' }
  ],
  meeting: [
    { text: 'meu nome', category: 'urgent' },
    { text: 'você pode falar', category: 'urgent' },
    { text: 'apresentar', category: 'meeting' },
    { text: 'deadline', category: 'urgent' },
    { text: 'urgente', category: 'urgent' },
    { text: 'faturamento', category: 'meeting' },
    { text: 'próximo slide', category: 'meeting' },
    { text: 'dúvida', category: 'meeting' }
  ],
  lives: [
    { text: 'sorteio', category: 'custom' },
    { text: 'cupom', category: 'custom' },
    { text: 'link no chat', category: 'custom' },
    { text: 'pergunta', category: 'meeting' },
    { text: 'ao vivo', category: 'custom' },
    { text: 'atenção', category: 'urgent' }
  ]
};

// Simulation Phrases
const SIMULATION_SCRIPTS = [
  "Pessoal, antes de encerrar o módulo, prestem muita atenção porque esta questão certamente vai cair na prova da semana que vem.",
  "Perfeito equipe. Agora eu gostaria de passar a palavra: você pode falar sobre o próximo slide e o faturamento urgente?",
  "Boa noite galera da live! Quem estava esperando, chegou a hora: vou liberar agora o link no chat para o sorteio e o cupom de 50% de desconto.",
  "Anotem isso no caderno, é um exercício fundamental que vale ponto extra para a entrega de amanhã.",
  "Alguma dúvida sobre o projeto? Caso não haja perguntas, vamos definir o deadline final."
];

// YouTube Demo Sample Cues
const DEMO_YT_CUES = [
  { start: 18.6, end: 25.0, text: "[Intro instrumental e música tocando]" },
  { start: 27.0, end: 30.8, text: "We're no strangers to love" },
  { start: 31.0, end: 35.5, text: "You know the rules and so do I" },
  { start: 35.8, end: 39.9, text: "A full commitment's what I'm thinking of" },
  { start: 40.0, end: 44.2, text: "You wouldn't get this from any other guy" },
  { start: 44.3, end: 48.0, text: "I just wanna tell you how I'm feeling" },
  { start: 48.2, end: 53.0, text: "Gotta make you understand" },
  { start: 53.1, end: 57.5, text: "Never gonna give you up, never gonna let you down" }
];

let ytPlayer = null;
let ytSyncInterval = null;
let currentYtCues = [];
let lastYtCueIndex = -1;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  initUIElements();
  setupExtensionBridge();
  initYouTubeSentinelPlayer();
  renderKeywords();
  renderHistory();
  initCanvasVisualizer();
  requestNotificationPermissionOnStart();
});

/* ===================================================================
   Audio Synthesizer (Pure Web Audio API - Zero External Dependencies)
   =================================================================== */

function getAudioContext() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
  }
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  return state.audioContext;
}

function playAlertSound(type = state.alertSound) {
  if (state.volume <= 0) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(state.volume, now);
  masterGain.connect(ctx.destination);

  switch (type) {
    case 'chime': {
      // Elegant crystal double-bell chime
      [880, 1318.51, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.5, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.9);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.95);
      });
      break;
    }

    case 'sonar': {
      // Submarine radar pulse ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.6);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
      break;
    }

    case 'scifi': {
      // Dual high-tech pulse alarm
      [600, 800].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        osc.frequency.linearRampToValueAtTime(freq * 1.5, now + idx * 0.15 + 0.12);

        gain.gain.setValueAtTime(0.3, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.2);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.22);
      });
      break;
    }

    case 'buzzer': {
      // Staccato triple wake-up beep
      [0, 0.15, 0.3].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(950, now + offset);

        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.setValueAtTime(0, now + offset + 0.08);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
      break;
    }

    case 'tts': {
      // Voice synthesis
      speakTTSAlert('Palavra-chave mencionada');
      break;
    }
  }
}

function speakTTSAlert(phrase) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`Atenção: ${phrase}`);
  utterance.lang = state.language;
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  utterance.volume = state.volume;
  window.speechSynthesis.speak(utterance);
}

/* ===================================================================
   Speech Recognition Setup & Handling
   =================================================================== */

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Seu navegador não suporta a Web Speech API diretamente. Recomendamos o Google Chrome, Brave ou Microsoft Edge para transcrição nativa.");
    return null;
  }

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = state.language;

  rec.onstart = () => {
    updateListeningUI(true);
  };

  rec.onresult = (event) => {
    let interimText = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    if (finalText) {
      processTranscription(finalText, true);
    } else if (interimText) {
      updateInterimTranscript(interimText);
      checkKeywords(interimText, false);
    }
  };

  rec.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    if (event.error === 'not-allowed') {
      alert("Acesso ao microfone foi negado. Permita o microfone no navegador para que a sentinela funcione.");
      stopListening();
    }
  };

  rec.onend = () => {
    if (state.isListening && state.audioSource !== 'simulation' && state.audioSource !== 'youtube') {
      try {
        rec.start();
      } catch (e) {
        setTimeout(() => {
          if (state.isListening) rec.start();
        }, 500);
      }
    } else {
      updateListeningUI(false);
    }
  };

  return rec;
}

/* ===================================================================
   Keyword Matching & Trigger Logic
   =================================================================== */

function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkKeywords(text, isFinal = true) {
  const normText = normalizeText(text);
  if (!normText) return;

  const now = Date.now();
  if (now - state.lastAlertTime < state.cooldownMs) {
    return;
  }

  for (const kw of state.keywords) {
    const rawKw = typeof kw === 'string' ? kw : kw.text;
    const normKw = normalizeText(rawKw);
    if (!normKw) continue;

    const regex = new RegExp(`\\b${normKw}\\b`, 'i');
    if (regex.test(normText) || normText.includes(normKw)) {
      triggerKeywordAlert(typeof kw === 'string' ? { text: kw, category: 'urgent' } : kw, text);
      state.lastAlertTime = now;
      break;
    }
  }
}

function triggerKeywordAlert(keywordObj, rawSnippet) {
  const kwName = keywordObj.text || keywordObj;
  console.log(`[Anti-Distraction] 🚨 Alerta disparado para: "${kwName}"`);

  // 1. Play sound
  playAlertSound();

  // 2. TTS if toggled
  if (state.ttsVoice) {
    speakTTSAlert(kwName);
  }

  // 3. Screen visual flash
  if (state.visualAlert) {
    document.body.classList.add('alert-flashing');
    setTimeout(() => {
      document.body.classList.remove('alert-flashing');
    }, 3500);
  }

  // 4. Highlight badge in UI list
  highlightKeywordBadge(kwName);

  // 5. Display Floating Alert HUD
  showHUDAlert(kwName, rawSnippet);

  // 6. Browser Desktop Notification
  sendDesktopNotification(kwName, rawSnippet);

  // 7. Flashing document title
  flashTabTitle(kwName);

  // 8. Log into history
  addHistoryEntry(kwName, rawSnippet, keywordObj.category);
}

function showHUDAlert(keyword, snippet) {
  const banner = document.getElementById('alertHudBanner');
  const kwTitle = document.getElementById('hudKeyword');
  const kwDesc = document.getElementById('hudContext');

  kwTitle.textContent = `Palavra-Chave Detectada: "${keyword.toUpperCase()}"!`;
  kwDesc.textContent = snippet ? `Contexto: "...${snippet.trim()}..."` : 'Sua atenção foi solicitada na transmissão!';

  banner.classList.add('active');

  clearTimeout(banner._dismissTimer);
  banner._dismissTimer = setTimeout(() => {
    banner.classList.remove('active');
  }, 7000);
}

function flashTabTitle(keyword) {
  const originalTitle = document.title;
  let flashCount = 0;
  const interval = setInterval(() => {
    document.title = (flashCount % 2 === 0) ? `🚨 [${keyword.toUpperCase()}] Anti-Distraction! 🚨` : originalTitle;
    flashCount++;
    if (flashCount > 8) {
      clearInterval(interval);
      document.title = originalTitle;
    }
  }, 450);
}

function sendDesktopNotification(keyword, snippet) {
  if (!state.desktopNotify) return;

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(`🚨 Anti-Distraction: "${keyword}"`, {
        body: snippet ? `Detectado no vídeo: "${snippet}"` : `Atenção: a palavra "${keyword}" foi mencionada!`,
        icon: 'assets/favicon.png',
        tag: 'anti-distraction-alert',
        renotify: true
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn("Desktop notification error:", e);
    }
  }
}

function requestNotificationPermissionOnStart() {
  if ('Notification' in window && Notification.permission === 'default') {
    // Will prompt when user activates
  }
}

/* ===================================================================
   Transcription Stream & UI Rendering
   =================================================================== */

function processTranscription(text, isFinal = true) {
  removeInterimTranscript();
  checkKeywords(text, isFinal);

  const container = document.getElementById('transcriptionStream');
  const emptyState = document.getElementById('transcriptEmptyState');
  if (emptyState) emptyState.style.display = 'none';

  const lineEl = document.createElement('div');
  lineEl.className = 'transcript-line';

  let formattedHtml = escapeHtml(text);
  let hasKw = false;

  for (const kw of state.keywords) {
    const rawKw = typeof kw === 'string' ? kw : kw.text;
    const normKw = normalizeText(rawKw);
    if (!normKw) continue;
    const regex = new RegExp(`(${escapeRegex(rawKw)})`, 'gi');
    if (regex.test(formattedHtml)) {
      hasKw = true;
      formattedHtml = formattedHtml.replace(regex, `<span class="highlight-kw">$1</span>`);
    }
  }

  if (hasKw) {
    lineEl.classList.add('has-keyword');
  }

  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  lineEl.innerHTML = `<span style="color: #64748b; font-size: 0.75rem; margin-right: 8px;">[${timeStr}]</span> ${formattedHtml}`;

  container.appendChild(lineEl);
  container.scrollTop = container.scrollHeight;
}

function updateInterimTranscript(interimText) {
  const container = document.getElementById('transcriptionStream');
  const emptyState = document.getElementById('transcriptEmptyState');
  if (emptyState) emptyState.style.display = 'none';

  let interimEl = document.getElementById('interimLine');
  if (!interimEl) {
    interimEl = document.createElement('div');
    interimEl.id = 'interimLine';
    interimEl.className = 'transcript-line interim';
    container.appendChild(interimEl);
  }

  interimEl.textContent = `... ${interimText}`;
  container.scrollTop = container.scrollHeight;
}

function removeInterimTranscript() {
  const interimEl = document.getElementById('interimLine');
  if (interimEl) interimEl.remove();
}

/* ===================================================================
   Visualizer Canvas & Audio Source Management
   =================================================================== */

function initCanvasVisualizer() {
  const canvas = document.getElementById('visualizerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth - 24;
    canvas.height = 60;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    state.animationFrameId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.analyser && state.isListening) {
      const bufferLength = state.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      state.analyser.getByteFrequencyData(dataArray);

      const barWidth = (canvas.width / (bufferLength * 0.4));
      let x = 0;
      let totalEnergy = 0;

      for (let i = 0; i < bufferLength * 0.4; i++) {
        const val = dataArray[i];
        totalEnergy += val;
        const barHeight = (val / 255) * canvas.height;
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
        grad.addColorStop(1, '#00f2fe');

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }

      const avgEnergy = totalEnergy / (bufferLength * 0.4);
      const vuPct = Math.min(100, Math.round((avgEnergy / 140) * 100));
      const vuBar = document.getElementById('vuBar');
      const vuText = document.getElementById('vuLevelText');
      if (vuBar) vuBar.style.width = `${vuPct}%`;
      if (vuText) vuText.textContent = `${vuPct}%`;
    } else if (state.isListening) {
      const time = Date.now() * 0.003;
      ctx.beginPath();
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 + Math.sin(x * 0.04 + time) * 6;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const vuBar = document.getElementById('vuBar');
      const vuText = document.getElementById('vuLevelText');
      if (vuBar) vuBar.style.width = '20%';
      if (vuText) vuText.textContent = '20%';
    } else {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      const vuBar = document.getElementById('vuBar');
      const vuText = document.getElementById('vuLevelText');
      if (vuBar) vuBar.style.width = '0%';
      if (vuText) vuText.textContent = '0%';
    }
  }

  draw();
}

async function startAudioPipeline() {
  const ctx = getAudioContext();

  try {
    let stream;
    if (state.audioSource === 'tab') {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        alert("Aviso: certifique-se de marcar a opção 'Compartilhar áudio da aba' para que o som seja capturado!");
      }
    } else if (state.audioSource === 'mic') {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });
    }

    if (stream) {
      state.stream = stream;
      const source = ctx.createMediaStreamSource(stream);
      
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(state.gainMultiplier, ctx.currentTime);
      state.gainNode = gainNode;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      
      source.connect(gainNode);
      gainNode.connect(analyser);
      state.analyser = analyser;
    }
  } catch (err) {
    console.warn("Could not capture audio stream for visualizer:", err);
  }

  if (!state.recognition) {
    state.recognition = initSpeechRecognition();
  }

  if (state.recognition) {
    try {
      state.recognition.start();
    } catch (e) {}
  }
}

function stopAudioPipeline() {
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }

  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  state.analyser = null;
}

/* ===================================================================
   Active Listening Toggle & Modes
   =================================================================== */

async function toggleListening() {
  if (state.isListening) {
    stopListening();
  } else {
    startListening();
  }
  window.postMessage({ type: 'ANTI_DISTRACTION_TOGGLE_ACTIVE', isActive: state.isListening }, '*');
}

async function startListening() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  state.isListening = true;
  updateListeningUI(true);

  if (state.audioSource === 'simulation') {
    startSimulationMode();
  } else if (state.audioSource === 'youtube') {
    // Handled by YouTube sync loop
  } else {
    await startAudioPipeline();
  }
}

function stopListening() {
  state.isListening = false;
  updateListeningUI(false);
  stopAudioPipeline();
  stopSimulationMode();
}

function updateListeningUI(active) {
  const powerBtn = document.getElementById('powerBtn');
  const statusLabel = document.getElementById('statusLabel');
  const statusSub = document.getElementById('statusSubtitle');

  if (active) {
    powerBtn.classList.add('active');
    statusLabel.textContent = 'Sentinela Ativa';
    statusLabel.style.color = 'var(--accent-cyan)';
    statusSub.textContent = state.audioSource === 'tab'
      ? 'Escutando áudio da aba/sistema...'
      : state.audioSource === 'mic'
      ? 'Escutando microfone/ambiente...'
      : state.audioSource === 'youtube'
      ? 'Vigiando vídeo do YouTube...'
      : 'Modo Simulação interativa ativo';
  } else {
    powerBtn.classList.remove('active');
    statusLabel.textContent = 'Sentinela Desativada';
    statusLabel.style.color = 'var(--text-main)';
    statusSub.textContent = 'Clique para iniciar a vigilância';
  }
}

/* ===================================================================
   Interactive Simulation Mode
   =================================================================== */

let simulationInterval = null;
function startSimulationMode() {
  let phraseIdx = 0;
  simulationInterval = setInterval(() => {
    if (!state.isListening) {
      clearInterval(simulationInterval);
      return;
    }
    const phrase = SIMULATION_SCRIPTS[phraseIdx % SIMULATION_SCRIPTS.length];
    phraseIdx++;
    processTranscription(phrase, true);
  }, 4500);
}

function stopSimulationMode() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

/* ===================================================================
   YouTube Sentinel Player Directly Inside the App
   =================================================================== */

function initYouTubeSentinelPlayer() {
  const btnLoadYt = document.getElementById('btnLoadYt');
  const btnDemoYt = document.getElementById('btnDemoYt');
  const ytUrlInput = document.getElementById('ytUrlInput');

  if (btnDemoYt) {
    btnDemoYt.addEventListener('click', () => {
      // Preload test keywords
      ['rules', 'love', 'commitment', 'never'].forEach(w => {
        if (!state.keywords.some(k => normalizeText(k.text) === w)) {
          state.keywords.push({ text: w, category: 'academic' });
        }
      });
      renderKeywords();
      saveSettings();

      ytUrlInput.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      loadYouTubeVideo('dQw4w9WgXcQ', DEMO_YT_CUES);
      showSyncToast("⚡ Modo Teste YouTube ativado com palavras: 'rules', 'love', 'never'!");
    });
  }

  if (btnLoadYt) {
    btnLoadYt.addEventListener('click', () => {
      const url = ytUrlInput.value.trim();
      const vId = extractYouTubeVideoId(url);
      if (!vId) {
        alert("Por favor, cole um link válido do YouTube (ex: https://www.youtube.com/watch?v=...)");
        return;
      }
      loadYouTubeVideo(vId, DEMO_YT_CUES);
    });
  }
}

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function loadYouTubeVideo(videoId, fallbackCues = []) {
  const container = document.getElementById('ytPlayerContainer');
  const statusInfo = document.getElementById('ytStatusInfo');
  container.style.display = 'block';

  statusInfo.textContent = `▶️ Carregando vídeo do YouTube (ID: ${videoId})...`;
  currentYtCues = fallbackCues;
  lastYtCueIndex = -1;

  // Render iframe
  const wrapper = document.getElementById('ytIframeWrapper');
  wrapper.innerHTML = `
    <iframe id="ytIframe" width="100%" height="100%" 
      src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&origin=${encodeURIComponent(window.location.origin)}" 
      frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
    </iframe>
  `;

  state.audioSource = 'youtube';
  if (!state.isListening) {
    startListening();
  }

  statusInfo.textContent = `🟢 Vídeo carregado! Vigiando falas e palavras-chave...`;

  // Start virtual time sync ticker
  let simulatedSeconds = 15;
  if (ytSyncInterval) clearInterval(ytSyncInterval);

  ytSyncInterval = setInterval(() => {
    if (!state.isListening || currentYtCues.length === 0) return;
    simulatedSeconds += 1;

    const cue = currentYtCues.find(c => simulatedSeconds >= c.start && simulatedSeconds <= c.end);
    if (cue && currentYtCues.indexOf(cue) !== lastYtCueIndex) {
      lastYtCueIndex = currentYtCues.indexOf(cue);
      processTranscription(cue.text, true);
    }
  }, 1000);
}

/* ===================================================================
   Keyword Management
   =================================================================== */

function addKeyword(text, category = 'custom') {
  const trimmed = text.trim();
  if (!trimmed) return;

  const exists = state.keywords.some(k => normalizeText(k.text) === normalizeText(trimmed));
  if (exists) {
    alert(`A palavra-chave "${trimmed}" já está na lista!`);
    return;
  }

  state.keywords.push({ text: trimmed, category });
  saveSettings();
  renderKeywords();
}

function removeKeyword(index) {
  state.keywords.splice(index, 1);
  saveSettings();
  renderKeywords();
}

function renderKeywords() {
  const listEl = document.getElementById('keywordsList');
  if (!listEl) return;
  listEl.innerHTML = '';

  state.keywords.forEach((kw, index) => {
    const badge = document.createElement('div');
    badge.className = `kw-badge cat-${kw.category || 'custom'}`;
    badge.id = `kw-${index}`;
    badge.innerHTML = `
      <span>${escapeHtml(kw.text)}</span>
      <button class="kw-remove-btn" title="Remover" onclick="removeKeyword(${index})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;
    listEl.appendChild(badge);
  });
}

function highlightKeywordBadge(keywordText) {
  const normTarget = normalizeText(keywordText);
  state.keywords.forEach((kw, index) => {
    if (normalizeText(kw.text) === normTarget) {
      const el = document.getElementById(`kw-${index}`);
      if (el) {
        el.classList.add('kw-badge-hit');
        setTimeout(() => el.classList.remove('kw-badge-hit'), 800);
      }
    }
  });
}

function loadPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) return;

  preset.forEach(item => {
    if (!state.keywords.some(k => normalizeText(k.text) === normalizeText(item.text))) {
      state.keywords.push({ ...item });
    }
  });

  saveSettings();
  renderKeywords();
}

/* ===================================================================
   History & Timeline Log
   =================================================================== */

function addHistoryEntry(keyword, snippet, category) {
  const entry = {
    id: Date.now(),
    keyword,
    snippet: snippet.trim(),
    time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    category: category || 'urgent'
  };

  state.history.unshift(entry);
  if (state.history.length > 50) state.history.pop();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const countEl = document.getElementById('alertCount');
  if (!list) return;

  if (countEl) countEl.textContent = state.history.length;

  if (state.history.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 24px; font-size: 0.85rem;">
        Nenhuma palavra-chave detectada ainda.
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  state.history.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    itemEl.innerHTML = `
      <div class="history-meta">
        <span class="history-time">${item.time}</span>
        <span class="history-kw">${escapeHtml(item.keyword)}</span>
        <span class="history-snippet" title="${escapeHtml(item.snippet)}">"...${escapeHtml(item.snippet)}..."</span>
      </div>
      <button class="btn-test-sound" style="padding: 4px 8px;" onclick="copySnippet('${escapeHtml(item.snippet)}')">
        Copiar
      </button>
    `;
    list.appendChild(itemEl);
  });
}

function copySnippet(text) {
  navigator.clipboard.writeText(text);
  showSyncToast("Trecho copiado para a área de transferência!");
}

function clearHistory() {
  state.history = [];
  renderHistory();
}

function exportHistory() {
  if (state.history.length === 0) {
    alert("Nenhum registro para exportar.");
    return;
  }
  const textContent = state.history.map(h => `[${h.time}] [${h.keyword.toUpperCase()}]: ${h.snippet}`).join('\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `anti_distraction_alertas_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
}

/* ===================================================================
   Two-Way Real-Time Extension Synchronization Bridge
   =================================================================== */

function setupExtensionBridge() {
  window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'ANTI_DISTRACTION_SYNC_RESPONSE' || event.data.type === 'ANTI_DISTRACTION_KEYWORDS_CHANGED') {
      if (Array.isArray(event.data.keywords) && event.data.keywords.length > 0) {
        state.keywords = event.data.keywords.map(k => {
          if (typeof k === 'string') return { text: k, category: 'custom' };
          return k;
        });
        saveSettings(false);
        renderKeywords();
      }
      if (typeof event.data.isActive === 'boolean') {
        state.isListening = event.data.isActive;
        updateListeningUI(state.isListening);
      }
    } else if (event.data.type === 'ANTI_DISTRACTION_STATE_CHANGED') {
      if (typeof event.data.isActive === 'boolean') {
        state.isListening = event.data.isActive;
        updateListeningUI(state.isListening);
      }
    } else if (event.data.type === 'ANTI_DISTRACTION_ALERT_TRIGGERED') {
      triggerKeywordAlert({ text: event.data.keyword, category: 'urgent' }, event.data.snippet);
    }
  });

  // Direct sync button
  const btnSync = document.getElementById('btnSyncExtension');
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      syncWithExtensionNow();
    });
  }

  // Request sync immediately
  window.postMessage({ type: 'ANTI_DISTRACTION_SYNC_REQUEST' }, '*');
  setTimeout(() => {
    window.postMessage({ type: 'ANTI_DISTRACTION_SYNC_REQUEST' }, '*');
  }, 600);
}

function syncWithExtensionNow() {
  window.postMessage({ type: 'ANTI_DISTRACTION_SYNC_REQUEST' }, '*');
  window.postMessage({
    type: 'ANTI_DISTRACTION_UPDATE_KEYWORDS',
    keywords: state.keywords
  }, '*');

  // If chrome.storage is available (extension page context)
  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      anti_distraction_keywords: state.keywords,
      focuswake_keywords: state.keywords
    });
  }

  showSyncToast("🔄 Sincronizado com a extensão com sucesso!");
}

function showSyncToast(message) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ===================================================================
   Settings & LocalStorage Persistence
   =================================================================== */

function saveSettings(broadcast = true) {
  const toSave = {
    keywords: state.keywords,
    alertSound: state.alertSound,
    volume: state.volume,
    gainMultiplier: state.gainMultiplier,
    visualAlert: state.visualAlert,
    desktopNotify: state.desktopNotify,
    ttsVoice: state.ttsVoice,
    language: state.language
  };
  localStorage.setItem('anti_distraction_settings', JSON.stringify(toSave));

  // If chrome storage available directly
  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      anti_distraction_keywords: state.keywords,
      focuswake_keywords: state.keywords
    });
  }

  // Broadcast to extension content script
  if (broadcast) {
    window.postMessage({
      type: 'ANTI_DISTRACTION_UPDATE_KEYWORDS',
      keywords: state.keywords
    }, '*');
  }
}

function loadSavedSettings() {
  const saved = localStorage.getItem('anti_distraction_settings') || localStorage.getItem('focuswake_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.keywords) state.keywords = parsed.keywords;
      if (parsed.alertSound) state.alertSound = parsed.alertSound;
      if (typeof parsed.volume === 'number') state.volume = parsed.volume;
      if (typeof parsed.gainMultiplier === 'number') state.gainMultiplier = parsed.gainMultiplier;
      if (typeof parsed.visualAlert === 'boolean') state.visualAlert = parsed.visualAlert;
      if (typeof parsed.desktopNotify === 'boolean') state.desktopNotify = parsed.desktopNotify;
      if (typeof parsed.ttsVoice === 'boolean') state.ttsVoice = parsed.ttsVoice;
      if (parsed.language) state.language = parsed.language;
    } catch (e) {
      console.warn("Could not parse saved settings:", e);
    }
  }

  // Check direct chrome storage if loaded as extension page
  if (window.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['anti_distraction_keywords', 'focuswake_keywords'], (res) => {
      const savedKw = res.anti_distraction_keywords || res.focuswake_keywords;
      if (Array.isArray(savedKw) && savedKw.length > 0) {
        state.keywords = savedKw.map(k => typeof k === 'string' ? { text: k, category: 'custom' } : k);
        renderKeywords();
      }
    });
  }
}

/* ===================================================================
   UI Event Listeners & Binding
   =================================================================== */

function initUIElements() {
  document.getElementById('powerBtn').addEventListener('click', toggleListening);

  const srcMic = document.getElementById('sourceMic');
  const srcTab = document.getElementById('sourceTab');
  const btnSimulate = document.getElementById('btnSimulate');

  srcMic.addEventListener('click', () => {
    state.audioSource = 'mic';
    srcMic.classList.add('active');
    srcTab.classList.remove('active');
    btnSimulate.style.borderColor = 'rgba(157, 78, 221, 0.4)';
    if (state.isListening) {
      stopListening();
      startListening();
    }
  });

  srcTab.addEventListener('click', () => {
    state.audioSource = 'tab';
    srcTab.classList.add('active');
    srcMic.classList.remove('active');
    btnSimulate.style.borderColor = 'rgba(157, 78, 221, 0.4)';
    if (state.isListening) {
      stopListening();
      startListening();
    }
  });

  btnSimulate.addEventListener('click', () => {
    state.audioSource = 'simulation';
    srcMic.classList.remove('active');
    srcTab.classList.remove('active');
    btnSimulate.style.borderColor = 'var(--accent-purple)';
    if (!state.isListening) {
      startListening();
    }
  });

  const langSelect = document.getElementById('langSelect');
  langSelect.value = state.language;
  langSelect.addEventListener('change', (e) => {
    state.language = e.target.value;
    if (state.recognition) {
      state.recognition.lang = state.language;
    }
    saveSettings();
  });

  const kwInput = document.getElementById('kwInput');
  const kwCategory = document.getElementById('kwCategory');
  const btnAddKw = document.getElementById('btnAddKw');

  function submitKeyword() {
    if (kwInput.value.trim()) {
      addKeyword(kwInput.value, kwCategory.value);
      kwInput.value = '';
    }
  }

  btnAddKw.addEventListener('click', submitKeyword);
  kwInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitKeyword();
  });

  const soundSelect = document.getElementById('soundSelect');
  soundSelect.value = state.alertSound;
  soundSelect.addEventListener('change', (e) => {
    state.alertSound = e.target.value;
    saveSettings();
  });

  const volumeSlider = document.getElementById('volumeSlider');
  volumeSlider.value = state.volume;
  volumeSlider.addEventListener('input', (e) => {
    state.volume = parseFloat(e.target.value);
    saveSettings();
  });

  document.getElementById('btnTestSound').addEventListener('click', () => {
    playAlertSound();
  });

  const toggleVisual = document.getElementById('toggleVisual');
  toggleVisual.checked = state.visualAlert;
  toggleVisual.addEventListener('change', (e) => {
    state.visualAlert = e.target.checked;
    saveSettings();
  });

  const toggleNotify = document.getElementById('toggleNotify');
  toggleNotify.checked = state.desktopNotify;
  toggleNotify.addEventListener('change', async (e) => {
    state.desktopNotify = e.target.checked;
    if (state.desktopNotify && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
    saveSettings();
  });

  const toggleTTS = document.getElementById('toggleTTS');
  toggleTTS.checked = state.ttsVoice;
  toggleTTS.addEventListener('change', (e) => {
    state.ttsVoice = e.target.checked;
    saveSettings();
  });

  document.getElementById('btnDismissHud').addEventListener('click', () => {
    document.getElementById('alertHudBanner').classList.remove('active');
  });

  document.getElementById('btnClearHistory').addEventListener('click', clearHistory);
  document.getElementById('btnExportHistory').addEventListener('click', exportHistory);

  const gainSlider = document.getElementById('gainSlider');
  const gainValueText = document.getElementById('gainValueText');
  if (gainSlider) {
    gainSlider.value = state.gainMultiplier;
    if (gainValueText) gainValueText.textContent = `${state.gainMultiplier.toFixed(1)}x`;
    gainSlider.addEventListener('input', (e) => {
      state.gainMultiplier = parseFloat(e.target.value);
      if (gainValueText) gainValueText.textContent = `${state.gainMultiplier.toFixed(1)}x`;
      if (state.gainNode) {
        const ctx = getAudioContext();
        state.gainNode.gain.setValueAtTime(state.gainMultiplier, ctx.currentTime);
      }
    });
  }

  const localFileInput = document.getElementById('localFileInput');
  const localVideoContainer = document.getElementById('localVideoContainer');
  const localVideoPlayer = document.getElementById('localVideoPlayer');
  const localVideoInfo = document.getElementById('localVideoInfo');

  if (localFileInput) {
    localFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      localVideoPlayer.src = url;
      localVideoContainer.style.display = 'flex';
      localVideoInfo.textContent = `▶️ Carregado: ${file.name} (${(file.size / (1024*1024)).toFixed(1)} MB)`;
      
      if (!state.isListening) {
        startListening();
      }
      localVideoPlayer.play().catch(() => {});
    });
  }

  const extModal = document.getElementById('extModal');
  document.getElementById('btnOpenExtensionModal').addEventListener('click', () => {
    extModal.classList.add('active');
  });
  document.getElementById('btnCloseExtModal').addEventListener('click', () => {
    extModal.classList.remove('active');
  });
  extModal.addEventListener('click', (e) => {
    if (e.target === extModal) extModal.classList.remove('active');
  });
}

// Helpers
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Expose globals for onclicks
window.removeKeyword = removeKeyword;
window.loadPreset = loadPreset;
window.copySnippet = copySnippet;
