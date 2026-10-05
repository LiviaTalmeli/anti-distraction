/**
 * Anti-Distraction Extension - Content Script V2.0
 * 
 * Major Features:
 * 1. Direct YouTube XML Transcript Synchronizer (Zero-latency, works even if CC is off & with headphones)
 * 2. Secondary Live Subtitle Scanner (Google Meet, Teams, Twitch & HTML5 video text tracks)
 * 3. On-Screen Floating Pill with Live Speech Ticker & Instant Master Toggle
 * 4. In-Tab Web Audio Synthesizer Alarm + Screen Border Laser Flash + Floating Alert Card
 * 5. Unified Real-Time Two-Way Synchronization Bridge with Web Dashboard
 */

let isSentinelActive = true;
let sentinelKeywords = [
  { text: 'meu nome', category: 'urgent' },
  { text: 'prova', category: 'academic' },
  { text: 'trabalho', category: 'academic' },
  { text: 'urgente', category: 'urgent' },
  { text: 'atenção', category: 'urgent' },
  { text: 'deadline', category: 'urgent' },
  { text: 'apresentar', category: 'meeting' }
];

let lastAlertTime = 0;
let lastProcessedBuffer = '';
let lastProcessedCueIndex = -1;
const COOLDOWN_MS = 3500;

// YouTube Transcript State
let currentYtVideoId = '';
let currentYtCues = [];
let ytSubtitlePoller = null;

// Initialize on page load
initContentScript();

function initContentScript() {
  loadSettings();
  injectOverlayElements();
  injectFloatingPill();
  setupStorageListener();
  setupWebPageBridge();
  startActiveSubtitleScanner();
  handleSiteSpecificWatchers();
}

/* ===================================================================
   Two-Way Synchronization Bridge with Web App (index.html / dashboard)
   =================================================================== */

function setupWebPageBridge() {
  window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type || !event.data.type.startsWith('ANTI_DISTRACTION_')) return;

    if (event.data.type === 'ANTI_DISTRACTION_SYNC_REQUEST') {
      chrome.storage.local.get(['anti_distraction_active', 'focuswake_active', 'anti_distraction_keywords', 'focuswake_keywords'], (res) => {
        const active = (typeof res.anti_distraction_active === 'boolean') ? res.anti_distraction_active :
                       (typeof res.focuswake_active === 'boolean') ? res.focuswake_active : isSentinelActive;
        const kw = res.anti_distraction_keywords || res.focuswake_keywords || sentinelKeywords;
        window.postMessage({
          type: 'ANTI_DISTRACTION_SYNC_RESPONSE',
          isActive: active,
          keywords: kw
        }, '*');
      });
    } else if (event.data.type === 'ANTI_DISTRACTION_UPDATE_KEYWORDS') {
      if (Array.isArray(event.data.keywords)) {
        sentinelKeywords = event.data.keywords;
        chrome.storage.local.set({
          anti_distraction_keywords: sentinelKeywords,
          focuswake_keywords: sentinelKeywords
        }, () => {
          updatePillUI();
        });
      }
    } else if (event.data.type === 'ANTI_DISTRACTION_TOGGLE_ACTIVE') {
      isSentinelActive = !!event.data.isActive;
      chrome.storage.local.set({
        anti_distraction_active: isSentinelActive,
        focuswake_active: isSentinelActive
      }, () => {
        updatePillUI();
      });
    }
  });
}

function notifyWebPageOfAlert(keyword, snippet) {
  window.postMessage({
    type: 'ANTI_DISTRACTION_ALERT_TRIGGERED',
    keyword: keyword,
    snippet: snippet,
    time: new Date().toLocaleTimeString('pt-BR', { hour12: false })
  }, '*');
}

/* ===================================================================
   Settings & Chrome Storage Synchronization
   =================================================================== */

function loadSettings() {
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['anti_distraction_active', 'focuswake_active', 'anti_distraction_keywords', 'focuswake_keywords'], (res) => {
      if (typeof res.anti_distraction_active === 'boolean') {
        isSentinelActive = res.anti_distraction_active;
      } else if (typeof res.focuswake_active === 'boolean') {
        isSentinelActive = res.focuswake_active;
      }

      const savedKw = res.anti_distraction_keywords || res.focuswake_keywords;
      if (Array.isArray(savedKw) && savedKw.length > 0) {
        sentinelKeywords = savedKw.map(k => typeof k === 'string' ? { text: k, category: 'custom' } : k);
      }
      updatePillUI();
    });
  }
}

function setupStorageListener() {
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      const activeChange = changes.anti_distraction_active || changes.focuswake_active;
      if (activeChange) {
        isSentinelActive = activeChange.newValue;
        updatePillUI();
        window.postMessage({ type: 'ANTI_DISTRACTION_STATE_CHANGED', isActive: isSentinelActive }, '*');
      }

      const kwChange = changes.anti_distraction_keywords || changes.focuswake_keywords;
      if (kwChange) {
        sentinelKeywords = kwChange.newValue.map(k => typeof k === 'string' ? { text: k, category: 'custom' } : k);
        updatePillUI();
        window.postMessage({ type: 'ANTI_DISTRACTION_KEYWORDS_CHANGED', keywords: sentinelKeywords }, '*');
      }
    });
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'SET_STATE') {
        isSentinelActive = msg.isActive;
        updatePillUI();
      }
    });
  }
}

function toggleActiveState() {
  isSentinelActive = !isSentinelActive;
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      anti_distraction_active: isSentinelActive,
      focuswake_active: isSentinelActive
    });
  }
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'TOGGLE_STATE', isActive: isSentinelActive }).catch(() => {});
  }
  updatePillUI();
  window.postMessage({ type: 'ANTI_DISTRACTION_STATE_CHANGED', isActive: isSentinelActive }, '*');
}

/* ===================================================================
   Floating On-Screen Sentinel Widget (Pill with Live Speech Ticker)
   =================================================================== */

function injectFloatingPill() {
  if (document.getElementById('anti-distraction-floating-pill')) return;

  const pill = document.createElement('div');
  pill.id = 'anti-distraction-floating-pill';
  pill.innerHTML = `
    <div class="fw-pill-indicator"></div>
    <div class="fw-pill-content">
      <div class="fw-pill-text" id="fwPillStatus">Anti-Distraction: ATIVO</div>
      <div class="fw-pill-ticker" id="fwPillTicker">Aguardando fala do vídeo...</div>
    </div>
    <button class="fw-pill-btn-toggle" id="fwPillToggleBtn" title="Ativar ou desativar a sentinela">⏸️ Desativar</button>
  `;

  document.body.appendChild(pill);

  document.getElementById('fwPillToggleBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleActiveState();
  });

  updatePillUI();
}

function updatePillUI() {
  const pill = document.getElementById('anti-distraction-floating-pill');
  const status = document.getElementById('fwPillStatus');
  const toggleBtn = document.getElementById('fwPillToggleBtn');
  if (!pill || !status || !toggleBtn) return;

  const kwCount = sentinelKeywords.length;

  if (isSentinelActive) {
    pill.classList.remove('paused');
    status.textContent = `Anti-Distraction: ATIVO (${kwCount} palavras)`;
    toggleBtn.textContent = '⏸️ Desativar';
    toggleBtn.style.background = 'rgba(255, 255, 255, 0.15)';
  } else {
    pill.classList.add('paused');
    status.textContent = 'Anti-Distraction: DESATIVADO';
    toggleBtn.textContent = '▶️ Ativar';
    toggleBtn.style.background = '#00f2fe';
  }
}

function updateLiveTicker(heardText, isAlert = false) {
  const ticker = document.getElementById('fwPillTicker');
  if (ticker && heardText) {
    const clean = heardText.slice(-42);
    ticker.textContent = `Ouvindo: "...${clean}"`;
    ticker.style.color = isAlert ? '#ef4444' : '#00f2fe';
  }
}

/* ===================================================================
   Direct YouTube TimedText Transcript Synchronizer
   =================================================================== */

function handleSiteSpecificWatchers() {
  const host = window.location.hostname;

  if (host.includes('youtube.com')) {
    initYouTubeTranscriptEngine();
  } else if (host.includes('meet.google.com')) {
    initMeetWatcher();
  }
}

function initYouTubeTranscriptEngine() {
  console.log('[Anti-Distraction] Initializing Direct YouTube Transcript Engine...');

  // Inject the MAIN world bridge script to access ytInitialPlayerResponse
  injectYouTubeBridgeScript();

  // Listen for tracks broadcasted by the bridge
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ANTI_DISTRACTION_YT_TRACKS_FOUND') {
      const tracks = event.data.tracks;
      const videoId = event.data.videoId;
      if (Array.isArray(tracks) && tracks.length > 0) {
        handleYouTubeCaptionTracks(tracks, videoId);
      }
    }
  });

  // Watch for URL changes on YouTube SPA navigation
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      checkYouTubeVideoChange();
    }
  }, 1000);

  // YouTube navigation event
  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(checkYouTubeVideoChange, 800);
  });

  // Initial check
  setTimeout(checkYouTubeVideoChange, 1200);
}

function injectYouTubeBridgeScript() {
  if (document.getElementById('anti-distraction-yt-bridge')) return;
  try {
    const s = document.createElement('script');
    s.id = 'anti-distraction-yt-bridge';
    s.src = chrome.runtime.getURL('youtube-bridge.js');
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[Anti-Distraction] Could not inject bridge via URL, using fallback inline:', e);
  }
}

function checkYouTubeVideoChange() {
  const urlParams = new URLSearchParams(window.location.search);
  const vId = urlParams.get('v');
  if (!vId) return;

  if (vId !== currentYtVideoId) {
    currentYtVideoId = vId;
    currentYtCues = [];
    lastProcessedCueIndex = -1;

    const ticker = document.getElementById('fwPillTicker');
    if (ticker) {
      ticker.textContent = 'Sincronizando áudio do YouTube...';
      ticker.style.color = '#38bdf8';
    }

    // Request fresh tracks from bridge
    window.dispatchEvent(new CustomEvent('ANTI_DISTRACTION_REQ_YT_TRACKS'));
    window.postMessage({ type: 'ANTI_DISTRACTION_REQ_YT_TRACKS' }, '*');

    // Also attempt fallback DOM extraction if bridge takes time
    setTimeout(() => {
      if (currentYtCues.length === 0) {
        attemptFallbackYouTubeExtraction(vId);
      }
    }, 1500);
  }
}

function attemptFallbackYouTubeExtraction(videoId) {
  // Search scripts in the page for captionTracks
  try {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      if (s.textContent && s.textContent.includes('captionTracks')) {
        const match = s.textContent.match(/"captionTracks":(\[.*?\])/);
        if (match) {
          const tracks = JSON.parse(match[1]);
          if (Array.isArray(tracks) && tracks.length > 0) {
            handleYouTubeCaptionTracks(tracks, videoId);
            return;
          }
        }
      }
    }
  } catch (e) {}

  // If still empty, display hint
  if (currentYtCues.length === 0) {
    const ticker = document.getElementById('fwPillTicker');
    if (ticker) {
      ticker.textContent = '👁️ Ative o botão CC do YouTube para escuta ao vivo';
      ticker.style.color = '#f59e0b';
    }
  }
}

function handleYouTubeCaptionTracks(tracks, videoId) {
  if (!Array.isArray(tracks) || tracks.length === 0) return;

  // Pick Portuguese if available, then English, then first
  let selected = tracks.find(t => {
    const lang = (t.languageCode || '').toLowerCase();
    return lang.startsWith('pt');
  });

  if (!selected) {
    selected = tracks.find(t => {
      const lang = (t.languageCode || '').toLowerCase();
      return lang.startsWith('en');
    });
  }

  if (!selected) {
    selected = tracks[0];
  }

  if (!selected || !selected.baseUrl) return;

  console.log(`[Anti-Distraction] Loading YouTube caption track: ${selected.name?.simpleText || selected.languageCode}`);

  fetch(selected.baseUrl)
    .then(res => res.text())
    .then(xmlText => {
      parseYouTubeXmlTranscript(xmlText);
    })
    .catch(err => {
      console.warn('[Anti-Distraction] Could not fetch YouTube caption track:', err);
    });
}

function parseYouTubeXmlTranscript(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const textNodes = xmlDoc.getElementsByTagName('text');

    if (!textNodes || textNodes.length === 0) return;

    const parsedCues = [];
    const divHelper = document.createElement('div');

    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const start = parseFloat(node.getAttribute('start')) || 0;
      const dur = parseFloat(node.getAttribute('dur')) || 3.0;

      // Decode HTML/XML entities
      divHelper.innerHTML = node.textContent || '';
      const clean = (divHelper.textContent || node.textContent || '').trim();

      if (clean && clean !== '[Music]' && clean !== '[Música]') {
        parsedCues.push({
          index: i,
          start: start,
          end: start + dur,
          text: clean
        });
      }
    }

    if (parsedCues.length > 0) {
      currentYtCues = parsedCues;
      console.log(`[Anti-Distraction] Sincronizado: ${parsedCues.length} falas carregadas do vídeo!`);
      const ticker = document.getElementById('fwPillTicker');
      if (ticker) {
        ticker.textContent = `Vigiando ${parsedCues.length} falas com sucesso!`;
        ticker.style.color = '#10b981';
      }

      startYouTubeVideoSyncLoop();
    }
  } catch (e) {
    console.warn('[Anti-Distraction] Error parsing transcript XML:', e);
  }
}

function startYouTubeVideoSyncLoop() {
  if (ytSubtitlePoller) clearInterval(ytSubtitlePoller);

  ytSubtitlePoller = setInterval(() => {
    if (!isSentinelActive || currentYtCues.length === 0) return;

    const video = document.querySelector('video');
    if (!video || video.paused) return;

    const currentTime = video.currentTime;
    
    // Find active cue
    const activeCue = currentYtCues.find(c => currentTime >= c.start && currentTime <= (c.end + 0.5));
    if (activeCue && activeCue.index !== lastProcessedCueIndex) {
      lastProcessedCueIndex = activeCue.index;
      updateLiveTicker(activeCue.text);
      checkTextForKeywords(activeCue.text);
    }
  }, 180);
}

/* ===================================================================
   Continuous Multi-Engine Subtitle Scanner (Meet, Teams, Visible CC)
   =================================================================== */

function startActiveSubtitleScanner() {
  // Fast 250ms polling loop
  setInterval(() => {
    if (!isSentinelActive) return;
    scanVisibleCaptions();
  }, 250);

  // Secondary MutationObserver for dynamic subtitle insertions
  const observer = new MutationObserver(() => {
    if (!isSentinelActive) return;
    scanVisibleCaptions();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function scanVisibleCaptions() {
  const selectors = [
    // YouTube live & CC
    '.ytp-caption-segment',
    '.caption-visual-line',
    '.caption-window span',
    // Google Meet
    'div[jsname="YSxPC"] span',
    '.a4bIc__N1Tdt span',
    '.VbkSUe',
    // Microsoft Teams
    '.ui-chat__item__message',
    '.closed-captions',
    // Generic HTML5 Video / VideoJS / Coursera
    '.vjs-text-track-cue',
    '[aria-live="polite"] span'
  ];

  const elements = document.querySelectorAll(selectors.join(', '));
  let currentText = '';

  if (elements && elements.length > 0) {
    const textPieces = [];
    elements.forEach(el => {
      const txt = el.textContent ? el.textContent.trim() : '';
      if (txt) textPieces.push(txt);
    });
    currentText = textPieces.join(' ');
  }

  // Also check HTML5 video text tracks
  const videos = document.querySelectorAll('video');
  videos.forEach(v => {
    if (v.textTracks && v.textTracks.length > 0) {
      for (let i = 0; i < v.textTracks.length; i++) {
        const track = v.textTracks[i];
        if (track.activeCues && track.activeCues.length > 0) {
          for (let j = 0; j < track.activeCues.length; j++) {
            const cue = track.activeCues[j];
            if (cue && cue.text) currentText += ' ' + cue.text;
          }
        }
      }
    }
  });

  if (!currentText || currentText === lastProcessedBuffer) return;

  lastProcessedBuffer = currentText;
  updateLiveTicker(currentText);
  checkTextForKeywords(currentText);
}

function initMeetWatcher() {
  setTimeout(() => {
    const ccBtn = document.querySelector('button[aria-label*="legenda" i], button[aria-label*="caption" i], button[jsname="r8qRAd"]');
    const isCcOn = ccBtn && (ccBtn.getAttribute('aria-pressed') === 'true' || ccBtn.classList.contains('V4870e'));
    
    if (!isCcOn) {
      showSiteHint("💡 Anti-Distraction: Ative as Legendas (botão CC) no Google Meet para a sentinela escutar a reunião!");
    }
  }, 4000);
}

function showSiteHint(message) {
  if (document.getElementById('anti-distraction-hint')) return;
  const hint = document.createElement('div');
  hint.id = 'anti-distraction-hint';
  hint.textContent = message;
  document.body.appendChild(hint);
  setTimeout(() => { hint.remove(); }, 6000);
}

/* ===================================================================
   Keyword Matching Logic
   =================================================================== */

function normalize(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkTextForKeywords(rawText) {
  if (!isSentinelActive) return;
  const norm = normalize(rawText);
  if (!norm) return;

  const now = Date.now();
  if (now - lastAlertTime < COOLDOWN_MS) return;

  for (const kw of sentinelKeywords) {
    const rawKw = typeof kw === 'string' ? kw : (kw.text || '');
    const normKw = normalize(rawKw);
    if (!normKw) continue;

    const regex = new RegExp(`\\b${normKw}\\b`, 'i');
    if (regex.test(norm) || norm.includes(normKw)) {
      lastAlertTime = now;
      triggerInTabAlert(rawKw, rawText);
      break;
    }
  }
}

/* ===================================================================
   Alert Triggering (In-Tab Sound, Flash & Floating Card)
   =================================================================== */

function triggerInTabAlert(keyword, snippet) {
  console.log(`[Anti-Distraction] 🚨 DISPARADO: Palavra "${keyword}" detectada!`);

  // Update ticker in red
  updateLiveTicker(snippet || keyword, true);

  // 1. Play synthesized audio directly in the tab
  playInTabAlarm();

  // 2. Flash screen border
  const flashEl = document.getElementById('anti-distraction-screen-flash');
  if (flashEl) {
    flashEl.style.display = 'block';
    setTimeout(() => { flashEl.style.display = 'none'; }, 3500);
  }

  // 3. Show floating HUD Card
  const hudEl = document.getElementById('anti-distraction-floating-hud');
  const hudWord = document.getElementById('fwHudWord');
  const hudSnippet = document.getElementById('fwHudSnippet');

  if (hudWord) hudWord.textContent = `"${keyword.toUpperCase()}"`;
  if (hudSnippet) hudSnippet.textContent = snippet ? `"${snippet.trim()}"` : 'Palavra-chave detectada!';

  if (hudEl) {
    hudEl.style.display = 'block';
    clearTimeout(hudEl._timer);
    hudEl._timer = setTimeout(() => { hudEl.style.display = 'none'; }, 7000);
  }

  // 4. Notify Web App if open
  notifyWebPageOfAlert(keyword, snippet);

  // 5. Send message to background worker for Chrome desktop notification & badge
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      action: 'KEYWORD_DETECTED',
      keyword: keyword,
      snippet: snippet
    }).catch(() => {});
  }
}

function playInTabAlarm() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic crystalline double chime alert
    [880, 1320, 1760].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.5, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.9);
    });
  } catch (e) {
    console.warn("[Anti-Distraction] Could not play in-tab alarm sound:", e);
  }
}

function injectOverlayElements() {
  if (document.getElementById('anti-distraction-floating-hud')) return;

  // Flash border
  const flashEl = document.createElement('div');
  flashEl.id = 'anti-distraction-screen-flash';
  document.body.appendChild(flashEl);

  // Floating HUD Card
  const hudEl = document.createElement('div');
  hudEl.id = 'anti-distraction-floating-hud';
  hudEl.innerHTML = `
    <div class="fw-hud-header">
      <span class="fw-hud-badge">🚨 Anti-Distraction Alerta</span>
      <button class="fw-hud-close" id="fwHudCloseBtn">&times;</button>
    </div>
    <div class="fw-hud-title">Palavra detectada: <span id="fwHudWord">...</span></div>
    <div class="fw-hud-snippet" id="fwHudSnippet">...</div>
  `;
  document.body.appendChild(hudEl);

  document.getElementById('fwHudCloseBtn').addEventListener('click', () => {
    hudEl.style.display = 'none';
  });
}
