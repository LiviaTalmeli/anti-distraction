/**
 * Anti-Distraction Extension - Popup Logic V2.0
 * Master Power Switch, Keyword Management, Presets, Audio Test & Direct Dashboard Access
 */

let keywords = [];
let isActive = true;

const PRESETS = {
  academic: [
    { text: 'prova', category: 'academic' },
    { text: 'trabalho', category: 'academic' },
    { text: 'chamada', category: 'academic' },
    { text: 'exercício', category: 'academic' },
    { text: 'vai cair', category: 'academic' },
    { text: 'anotem', category: 'academic' }
  ],
  meeting: [
    { text: 'meu nome', category: 'urgent' },
    { text: 'você pode falar', category: 'urgent' },
    { text: 'urgente', category: 'urgent' },
    { text: 'deadline', category: 'urgent' },
    { text: 'faturamento', category: 'meeting' },
    { text: 'apresentar', category: 'meeting' }
  ],
  lives: [
    { text: 'sorteio', category: 'custom' },
    { text: 'cupom', category: 'custom' },
    { text: 'link no chat', category: 'custom' },
    { text: 'pergunta', category: 'meeting' },
    { text: 'ao vivo', category: 'custom' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindEvents();
});

function loadData() {
  chrome.storage.local.get(['anti_distraction_active', 'focuswake_active', 'anti_distraction_keywords', 'focuswake_keywords'], (res) => {
    if (typeof res.anti_distraction_active === 'boolean') {
      isActive = res.anti_distraction_active;
    } else if (typeof res.focuswake_active === 'boolean') {
      isActive = res.focuswake_active;
    } else {
      isActive = true;
    }

    const saved = res.anti_distraction_keywords || res.focuswake_keywords;
    if (Array.isArray(saved) && saved.length > 0) {
      keywords = saved.map(k => typeof k === 'string' ? { text: k, category: 'custom' } : k);
    } else {
      keywords = [
        { text: 'meu nome', category: 'urgent' },
        { text: 'prova', category: 'academic' },
        { text: 'trabalho', category: 'academic' },
        { text: 'urgente', category: 'urgent' }
      ];
    }
    updateUI();
  });
}

function updateUI() {
  const card = document.getElementById('masterPowerCard');
  const title = document.getElementById('powerTitle');
  const sub = document.getElementById('powerSubtitle');
  const btnIcon = document.getElementById('btnToggleIcon');
  const btnText = document.getElementById('btnToggleText');
  const countEl = document.getElementById('kwCount');

  if (countEl) countEl.textContent = keywords.length;

  if (isActive) {
    card.className = 'master-power-card active';
    title.textContent = 'SENTINELA ATIVA';
    sub.textContent = 'Vigiando YouTube, Meet e Vídeos';
    btnIcon.textContent = '⏸️';
    btnText.textContent = 'DESATIVAR SENTINELA';
  } else {
    card.className = 'master-power-card paused';
    title.textContent = 'SENTINELA DESATIVADA';
    sub.textContent = 'Pausada. Clique abaixo para ativar';
    btnIcon.textContent = '▶️';
    btnText.textContent = 'ATIVAR SENTINELA AGORA';
  }

  renderTags();
}

function toggleSentinelState() {
  isActive = !isActive;
  chrome.storage.local.set({
    anti_distraction_active: isActive,
    focuswake_active: isActive
  }, () => {
    updateUI();
    // Notify background script
    chrome.runtime.sendMessage({ action: 'TOGGLE_STATE', isActive }).catch(() => {});
    // Notify all active tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'SET_STATE', isActive }).catch(() => {});
      });
    });
  });
}

function renderTags() {
  const container = document.getElementById('kwList');
  if (!container) return;
  container.innerHTML = '';

  keywords.forEach((kw, index) => {
    const text = typeof kw === 'string' ? kw : kw.text;
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `
      <span>${escapeHtml(text)}</span>
      <span class="tag-del" data-index="${index}" title="Remover">&times;</span>
    `;
    container.appendChild(tag);
  });

  // Bind delete events
  document.querySelectorAll('.tag-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      keywords.splice(idx, 1);
      saveData();
    });
  });
}

function bindEvents() {
  // Master Big Toggle Button
  document.getElementById('btnTogglePower').addEventListener('click', toggleSentinelState);

  // Add Keyword
  const input = document.getElementById('inputKw');
  const btnAdd = document.getElementById('btnAdd');

  function add() {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    const exists = keywords.some(k => (typeof k === 'string' ? k : k.text).toLowerCase() === val);
    if (!exists) {
      keywords.push({ text: val, category: 'custom' });
      input.value = '';
      saveData();
    }
  }

  btnAdd.addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  // Preset Buttons
  document.querySelectorAll('.btn-preset-mini').forEach(btn => {
    btn.addEventListener('click', () => {
      const pName = btn.dataset.preset;
      const list = PRESETS[pName];
      if (list) {
        list.forEach(item => {
          const itemText = typeof item === 'string' ? item : item.text;
          const exists = keywords.some(k => (typeof k === 'string' ? k : k.text).toLowerCase() === itemText.toLowerCase());
          if (!exists) {
            keywords.push(typeof item === 'string' ? { text: item, category: pName } : item);
          }
        });
        saveData();
      }
    });
  });

  // Quick Test Alert Sound & Notification
  document.getElementById('btnQuickTest').addEventListener('click', () => {
    playPopupChime();
    chrome.runtime.sendMessage({
      action: 'KEYWORD_DETECTED',
      keyword: 'Teste',
      snippet: 'Verificação do sinal sonoro e visual do Anti-Distraction!'
    });
  });

  // Open Full Web App Dashboard inside Extension
  document.getElementById('btnOpenDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
}

function saveData() {
  chrome.storage.local.set({
    anti_distraction_keywords: keywords,
    focuswake_keywords: keywords
  }, () => {
    updateUI();
  });
}

function playPopupChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 1320, 1760].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.4, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  } catch (e) {}
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
