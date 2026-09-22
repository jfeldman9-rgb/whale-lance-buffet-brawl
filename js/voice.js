/* Cruise-buffet copy. Short on purpose: Press Start 2P is wide,
   and these lines get re-read every run. */
'use strict';

WL.voice = (function () {
  const U = WL.util;

  const FARTS = [
    'COURTESY OF THE BEAN STATION.',
    'THE HVAC SPECIAL.',
    'DECK 11 HAS WEATHER NOW.',
    'THAT ONE WAS THE COMPRESSOR.',
    'NOT ON THE INVOICE.',
    'CAPTAIN, THAT WAS ME.'
  ];
  let fartI = -1;

  const BARKS = {
    grab: ['DUCT TAPE. HOLD STILL.', 'THIS IS A REPAIR.'],
    throw: ['RETURN TO SENDER.', 'YOU ARE THE SIDE.'],
    sweep: ['PIPE WRENCH.', 'THAT ONE HAD RANGE.'],
    spray: ['R-410A. CHILL.', 'REFRIGERANT. YOU\'RE WELCOME.'],
    box: ['CATCH.', 'TOOLBOX HAS NOTES.'],
    low: ['SHOULD\'VE HAD THE TURKEY.', 'HP\'S IN THE RED. SO AM I.'],
    froyo: ['DOUBLE POINTS. STILL GROSS.', 'I HATE THAT CUP.'],
    elite: ['ELITE GREENS. ORDINARY DEAD.'],
    respawn: ['STILL ON THE CLOCK.', 'BACK FOR SECONDS.', 'THE DUCT CAN WAIT. I CAN\'T.']
  };

  const INTROS = {
    broccoli: { name: 'BROCCOLI GOON', line: '"EAT YOUR GREENS," HE SAID.' },
    sprout: { name: 'BRUSSELS SPROUT', line: 'SMALL, ROUND, UNASKED-FOR.' },
    celery: { name: 'CELERY STALKER', line: 'ALL STALK. ZERO CHARM.' },
    carrot: { name: 'CARROT NINJA', line: 'ORANGE BELT. ACTUAL BELT.' },
    spinach: { name: 'SPINACH THUG', line: 'POPEYE\'S COUSIN. ANGRIER.' },
    kale: { name: 'KALE BRUISER', line: 'SUPERFOOD. SUPER PROBLEM.' },
    froyo: { name: 'FROZEN YOGURT', line: 'LANCE\'S LEAST FAVORITE CUP.' }
  };

  const RANKS = [
    [3, 'APPETIZER'],
    [5, 'THAT\'S A SIDE'],
    [8, 'BUFFET NOTICED'],
    [12, 'ALL YOU CAN HIT'],
    [16, 'CAPTAIN\'S TABLE'],
    [20, 'COMP THE ROOM']
  ];

  const TOOLS = { jab: 'SCREWDRIVER', smash: 'WRENCH', sweep: 'PIPE WRENCH' };

  function bark(id) {
    const list = BARKS[id];
    return list ? U.pick(list) : '';
  }

  function comboRank(n) {
    let label = '';
    for (const [k, v] of RANKS) if (n >= k) label = v;
    return label;
  }

  function comboCross(before, after) {
    let label = '';
    for (const [k, v] of RANKS) if (before < k && after >= k) label = v;
    return label;
  }

  return {
    bark,
    comboRank,
    comboCross,
    enemyIntro(type) { return INTROS[type] || null; },
    toolName(pose) { return TOOLS[pose] || ''; },
    fartLine() { fartI = (fartI + 1) % FARTS.length; return FARTS[fartI]; },
    fartTitle: 'VOLCANO FART'
  };
})();
