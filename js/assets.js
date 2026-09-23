/* Asset loader. Every image is optional: if a file is missing the game falls
   back to procedurally drawn stand-ins so it always stays playable. */
'use strict';

WL.assets = (function () {
  const images = {};
  // Image URLs carry the same ?v= stamp as the scripts, so a cached 404 or stale
  // file from an older deploy can't pin the procedural fallback.
  const cs = typeof document !== 'undefined' && document.currentScript;
  const VER = WL.ASSET_VER = (cs && (cs.src.match(/[?&]v=([^&#]+)/) || [])[1]) || '20260923-gfx2b';
  const manifest = {
    // Opening cutscene panels (in story order)
    cut1: 'assets/cutscenes/cutscene-01-ac-out.png',
    cut2: 'assets/cutscenes/cutscene-02-captain-calls.png',
    cut3: 'assets/cutscenes/cutscene-03-lance-arrives.png',
    cut4: 'assets/cutscenes/cutscene-04-monsters-attack.png',
    // Optional real-photo likeness (see tools/make_lance_portraits.py). When these
    // files are absent Lance is drawn procedurally from the photo spec.
    lancePortrait: 'assets/lance/lance-portrait.png', // bust, transparent bg (title/ending)
    lanceHead: 'assets/lance/lance-head.png',         // face crop for the in-game sprite
    lanceHud: 'assets/lance/lance-hud.png'            // small HUD portrait
  };

  // Painted sprite atlases and background plates (tools/bake_art.py -> js/artdata.js).
  const art = WL.ARTDATA || {};
  for (const k of Object.keys(art)) if (k !== 'plates') manifest['art:' + k] = art[k].src;
  for (const k of Object.keys(art.plates || {})) manifest['plate:' + k] = art.plates[k].src;
  // Without these the Lido and Lance silently turn procedural, so a miss is reported.
  const CRITICAL = ['art:lance', 'plate:lido-far', 'plate:lido-mid-ship', 'plate:lido-mid-pool', 'plate:lido-mid-deck', 'plate:lido-floor'];
  const painted = k => k.startsWith('art:') || k.startsWith('plate:');

  let loaded = 0, total = 0, done = false;
  const failed = [];

  function fetchImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function load(onProgress) {
    const keys = Object.keys(manifest);
    total = keys.length;
    return Promise.all(keys.map(async k => {
      const url = manifest[k] + '?v=' + VER;
      let img = await fetchImage(url);
      if (!img && painted(k)) img = await fetchImage(url + '&r=' + Date.now());
      images[k] = img;
      if (!img && painted(k)) failed.push(k);
      loaded++; onProgress && onProgress(loaded / total);
    })).then(() => {
      done = true;
      if (failed.length && typeof console !== 'undefined') console.warn('[WL] painted art failed to load (after retry):', failed.join(', '));
    });
  }

  function get(key) { return images[key] || null; }
  function has(key) { return !!images[key]; }
  /** Critical painted-art keys that are still missing after load (empty when all is well). */
  function criticalMissing() { return done ? CRITICAL.filter(k => manifest[k] && !images[k]) : []; }

  return { load, get, has, VER, criticalMissing, failed: () => failed.slice(), _img: k => images[k] || null, get progress() { return total ? loaded / total : 0; }, get done() { return done; } };
})();
