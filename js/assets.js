/* Asset loader. Every image is optional: if a file is missing the game falls
   back to procedurally drawn stand-ins so it always stays playable. */
'use strict';

WL.assets = (function () {
  const images = {};
  const manifest = {
    // Opening cutscene panels (in story order)
    cut1: 'assets/cutscenes/cutscene-01-ac-out.png',
    cut2: 'assets/cutscenes/cutscene-02-captain-calls.png',
    cut3: 'assets/cutscenes/cutscene-03-lance-arrives.png',
    cut4: 'assets/cutscenes/cutscene-04-monsters-attack.png',
    // Lance likeness
    lancePortrait: 'assets/lance/lance-portrait.png', // bust, transparent bg
    lanceHead: 'assets/lance/lance-head.png',         // head crop for the sprite
    lanceHud: 'assets/lance/lance-hud.png'            // small HUD portrait
  };

  let loaded = 0, total = 0, done = false;

  function load(onProgress) {
    const keys = Object.keys(manifest);
    total = keys.length;
    return Promise.all(keys.map(k => new Promise(resolve => {
      const img = new Image();
      img.onload = () => { images[k] = img; loaded++; onProgress && onProgress(loaded / total); resolve(); };
      img.onerror = () => { images[k] = null; loaded++; onProgress && onProgress(loaded / total); resolve(); };
      img.src = manifest[k];
    }))).then(() => { done = true; });
  }

  function get(key) { return images[key] || null; }
  function has(key) { return !!images[key]; }

  return { load, get, has, get progress() { return total ? loaded / total : 0; }, get done() { return done; } };
})();
