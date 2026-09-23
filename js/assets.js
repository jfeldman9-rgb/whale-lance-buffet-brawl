/* Asset loader. Every image is optional: if a file is missing the game falls
   back to procedurally drawn stand-ins so it always stays playable. */
'use strict';

WL.assets = (function () {
  const images = {};
  // Image URLs carry the same ?v= stamp as the scripts, so a cached 404 or stale
  // file from an older deploy can't pin the procedural fallback.
  const cs = typeof document !== 'undefined' && document.currentScript;
  const VER = WL.ASSET_VER = (cs && (cs.src.match(/[?&]v=([^&#]+)/) || [])[1]) || '20260923-cut1';
  const manifest = {
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
  const painted = k => k.startsWith('art:') || k.startsWith('plate:') || k.startsWith('story:');

  // Painted story plates (tools/bake_story.py). They are fetched in the background
  // after the title is up, opening first, so they never delay the first frame.
  const STORY = ['op1-ac-out', 'op2-captain-calls', 'op3-lance-arrives', 'op4-salad-strikes', 'captain-portrait',
    'st1-lido-intro', 'st1-lido-outro', 'st2-plant-intro', 'st2-plant-outro', 'st3-spa-intro', 'st3-spa-outro',
    'st4-freezer-intro', 'end1-last-valve', 'end2-svelte', 'end3-carving-station'];
  const lazy = {};
  for (const n of STORY) lazy['story:' + n] = 'assets/cutscenes/' + n + '.webp';

  let loaded = 0, total = 0, done = false;
  const failed = [];
  const pending = {};

  function fetchImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  async function fetchKey(k, src) {
    const url = src + '?v=' + VER;
    let img = await fetchImage(url);
    if (!img && painted(k)) img = await fetchImage(url + '&r=' + Date.now());
    images[k] = img;
    if (!img && painted(k)) failed.push(k);
    return img;
  }

  function load(onProgress) {
    const keys = Object.keys(manifest);
    total = keys.length;
    return Promise.all(keys.map(async k => {
      await fetchKey(k, manifest[k]);
      loaded++; onProgress && onProgress(loaded / total);
    })).then(() => {
      done = true;
      if (failed.length && typeof console !== 'undefined') console.warn('[WL] painted art failed to load (after retry):', failed.join(', '));
      loadLazy();
    });
  }
  /* Two at a time, in story order, so opening card 1 lands first. */
  function loadLazy() {
    const keys = Object.keys(lazy).filter(k => !(k in pending));
    let i = 0;
    const next = () => {
      if (i >= keys.length) return Promise.resolve();
      const k = keys[i++];
      pending[k] = fetchKey(k, lazy[k]).then(img => {
        if (!img && typeof console !== 'undefined') console.warn('[WL] story plate failed to load (after retry):', k);
        return img;
      });
      return pending[k].then(next);
    };
    return Promise.all([next(), next()]);
  }
  /** Resolves when the given keys (or every key with one of the given prefixes) have settled. */
  function ready(keys) {
    const want = [];
    for (const k of keys || []) {
      if (k === 'story') want.push(...Object.keys(lazy));
      else want.push(k);
    }
    if (!done || want.some(k => k in lazy && !(k in pending))) loadLazy();
    return Promise.all(want.map(k => pending[k] || Promise.resolve(images[k] || null)));
  }

  function get(key) { return images[key] || null; }
  function has(key) { return !!images[key]; }
  /** Settled (loaded or failed) — the cutscene stops waiting either way. */
  function settled(key) { return key in images; }
  /** Critical painted-art keys that are still missing after load (empty when all is well). */
  function criticalMissing() { return done ? CRITICAL.filter(k => manifest[k] && !images[k]) : []; }

  return { load, ready, get, has, settled, VER, STORY, criticalMissing, failed: () => failed.slice(), _img: k => images[k] || null, get progress() { return total ? loaded / total : 0; }, get done() { return done; } };
})();
