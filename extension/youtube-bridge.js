/**
 * Anti-Distraction Extension - YouTube Main World Bridge
 * Runs in the page's MAIN JavaScript world to directly access YouTube's player and state.
 */

(function() {
  function getCaptionTracks() {
    try {
      // 1. Check window.ytInitialPlayerResponse
      if (window.ytInitialPlayerResponse && 
          window.ytInitialPlayerResponse.captions && 
          window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer &&
          window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks) {
        return window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      }
      
      // 2. Check movie_player captions module
      const player = document.getElementById('movie_player');
      if (player && typeof player.getOption === 'function') {
        const list = player.getOption('captions', 'tracklist');
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      }

      // 3. Check ytplayer config args
      if (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args) {
        const raw = window.ytplayer.config.args.raw_player_response;
        if (raw && raw.captions && raw.captions.playerCaptionsTracklistRenderer) {
          return raw.captions.playerCaptionsTracklistRenderer.captionTracks;
        }
      }
    } catch (e) {
      console.warn('[Anti-Distraction Bridge] Error accessing player captions:', e);
    }
    return null;
  }

  function broadcastTracks(trigger) {
    const tracks = getCaptionTracks();
    const videoId = new URLSearchParams(window.location.search).get('v') || '';
    window.postMessage({
      type: 'ANTI_DISTRACTION_YT_TRACKS_FOUND',
      tracks: tracks,
      videoId: videoId,
      trigger: trigger || 'manual'
    }, '*');
  }

  // Listen to requests from content.js
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ANTI_DISTRACTION_REQ_YT_TRACKS') {
      broadcastTracks('request');
    }
  });

  // Automatically broadcast on YouTube SPA navigation
  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(() => broadcastTracks('yt-navigate-finish'), 600);
    setTimeout(() => broadcastTracks('yt-navigate-finish-retry'), 1500);
  });

  // Initial attempt
  setTimeout(() => broadcastTracks('init'), 800);
})();
