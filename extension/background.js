/**
 * Anti-Distraction Extension - Background Service Worker (Manifest V3)
 */

const DEFAULT_KEYWORDS = [
  { text: 'meu nome', category: 'urgent' },
  { text: 'prova', category: 'academic' },
  { text: 'trabalho', category: 'academic' },
  { text: 'urgente', category: 'urgent' },
  { text: 'atenção', category: 'urgent' },
  { text: 'deadline', category: 'urgent' },
  { text: 'apresentar', category: 'meeting' }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['anti_distraction_active', 'focuswake_active', 'anti_distraction_keywords', 'focuswake_keywords'], (res) => {
    if (typeof res.anti_distraction_active === 'undefined' && typeof res.focuswake_active === 'undefined') {
      chrome.storage.local.set({
        anti_distraction_active: true,
        focuswake_active: true
      });
    }
    if (!res.anti_distraction_keywords && !res.focuswake_keywords) {
      chrome.storage.local.set({
        anti_distraction_keywords: DEFAULT_KEYWORDS,
        focuswake_keywords: DEFAULT_KEYWORDS
      });
    }
  });

  updateBadge(true);
});

function updateBadge(isActive) {
  if (isActive) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#00f2fe' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
  }
}

// Handle runtime messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'KEYWORD_DETECTED') {
    handleKeywordAlert(message.keyword, message.snippet);
    sendResponse({ status: 'ok' });
  } else if (message.action === 'TOGGLE_STATE') {
    updateBadge(message.isActive);
    sendResponse({ status: 'ok' });
  }
  return true;
});

function handleKeywordAlert(keyword, snippet) {
  // Flash extension badge
  chrome.action.setBadgeText({ text: '🚨' });
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

  setTimeout(() => {
    chrome.storage.local.get(['anti_distraction_active', 'focuswake_active'], (res) => {
      const active = (typeof res.anti_distraction_active === 'boolean') ? res.anti_distraction_active :
                     (typeof res.focuswake_active === 'boolean') ? res.focuswake_active : true;
      updateBadge(active);
    });
  }, 5000);

  // Send Chrome Desktop Notification
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `🚨 Anti-Distraction: Palavra "${keyword.toUpperCase()}"!`,
      message: snippet ? `Detectada no vídeo: "${snippet}"` : 'Sua atenção foi solicitada na transmissão!',
      priority: 2
    });
  }
}
