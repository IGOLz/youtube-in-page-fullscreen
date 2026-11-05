(() => {
  'use strict';

  const root = document.documentElement;
  const buttonId = 'yss-toggle';
  let player = null;
  let active = false;
  let ancestors = [];
  let previousFocus = null;
  let scrollPosition = null;
  let scheduled = false;

  const isWatchPage = () => location.pathname === '/watch' && new URLSearchParams(location.search).has('v');
  const isEditable = (event) => event.composedPath().some(node => node instanceof Element &&
    (node.matches('input, textarea, select, [role="textbox"]') || node.isContentEditable));

  function updateButton() {
    const button = document.getElementById(buttonId);
    if (!button) return;
    const label = active ? 'Torna alla pagina (Esc)' : 'Espandi nella scheda (F)';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
  }

  function exit() {
    if (!active) return;
    active = false;
    root.classList.remove('yss-active');
    player?.classList.remove('yss-player');
    for (const ancestor of ancestors) ancestor.classList.remove('yss-ancestor');
    ancestors = [];
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    if (scrollPosition) window.scrollTo(...scrollPosition);
    previousFocus = null;
    scrollPosition = null;
    updateButton();
    window.dispatchEvent(new Event('resize'));
  }

  function toggle() {
    if (active) { exit(); return; }
    if (!isWatchPage() || !player?.isConnected || document.fullscreenElement) return;
    previousFocus = document.activeElement;
    scrollPosition = [window.scrollX, window.scrollY];
    // Keep the player in its original DOM so YouTube's event handlers survive.
    for (let parent = player.parentElement; parent && parent !== root; parent = parent.parentElement) {
      parent.classList.add('yss-ancestor');
      ancestors.push(parent);
    }
    active = true;
    player.classList.add('yss-player');
    root.classList.add('yss-active');
    player.focus({ preventScroll: true });
    updateButton();
    window.dispatchEvent(new Event('resize'));
  }

  function syncPlayer() {
    scheduled = false;
    const next = isWatchPage() ? document.querySelector('#movie_player') : null;
    if (next !== player) {
      exit();
      document.getElementById(buttonId)?.remove();
      player = next;
    }
    if (!player) return;
    const controls = player.querySelector('.ytp-right-controls');
    if (!controls || controls.querySelector(`#${buttonId}`)) return;
    const button = document.createElement('button');
    button.id = buttonId;
    button.type = 'button';
    button.className = 'ytp-button';
    button.innerHTML = '<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="8" y="10" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 14h18M14 19h8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    button.addEventListener('click', event => { event.stopPropagation(); toggle(); });
    controls.insertBefore(button, controls.querySelector('.ytp-fullscreen-button'));
    updateButton();
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncPlayer);
  }

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        event.shiftKey || isEditable(event)) return;
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exit();
    } else if (event.key.toLowerCase() === 'f' && isWatchPage() && player && !document.fullscreenElement) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) toggle();
    }
  }, true);

  document.addEventListener('dblclick', event => {
    if (!player || !isWatchPage() || document.fullscreenElement || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey || isEditable(event) || !(event.target instanceof Element) ||
        !player.contains(event.target) || !event.target.matches('video, .ytp-cued-thumbnail-overlay, .ytp-cued-thumbnail-overlay-image')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggle();
  }, true);

  document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) exit(); });
  document.addEventListener('yt-navigate-start', exit);
  document.addEventListener('yt-navigate-finish', scheduleSync);
  window.addEventListener('popstate', () => { exit(); scheduleSync(); });
  window.addEventListener('pagehide', exit);
  new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
  syncPlayer();
})();
