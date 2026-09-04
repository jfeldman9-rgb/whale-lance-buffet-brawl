/* Game entities: Player (Lance), Enemy (healthy food), Boss (Giant Froyo Cone),
   Pickup, Breakable, Projectile, Particle. The Play scene (WL.scenes.Play)
   owns them and is passed in as `g` for spawning FX/sounds/score. */
'use strict';

(function () {
  const U = WL.util;
  const S = WL.sprites;
  const GRAV = 900;

  /* ------------------------------------------------------------------ */
  /* Player                                                              */
  /* ------------------------------------------------------------------ */
  const ATTACKS = {
    jab: { pose: 'jab', dur: 0.24, hitAt: 0.06, reach: 42, dmg: 5, kb: 40, next: 'smash', chainUntil: 0.5, sfx: 'hit' },
    smash: { pose: 'smash', windPose: 'smashWind', windUntil: 0.1, dur: 0.32, hitAt: 0.12, reach: 46, dmg: 7, kb: 60, next: 'sweep', chainUntil: 0.6, sfx: 'clank' },
    sweep: { pose: 'sweep', windPose: 'sweepWind', windUntil: 0.14, dur: 0.46, hitAt: 0.17, reach: 54, back: 34, dmg: 11, kb: 150, knockdown: true, next: null, chainUntil: 0, sfx: 'hitHeavy' }
  };

  class Player {
    constructor(g, x, y) {
      this.g = g;
      this.x = x; this.y = y; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.facing = 1;
      this.maxHp = 100; this.hp = 100;
      this.lives = 3; this.score = 0;
      this.fart = 0; this.fartMax = 100;
      this.hasToolbox = true;
      this.state = 'idle'; this.stateT = 0; this.t = 0;
      this.invuln = 0; this.flash = 0;
      this.attack = null; this.hitDone = false; this.comboTimer = 0; this.nextCombo = 'jab';
      this.grab = null; this.grabHits = 0; this.grabT = 0;
      this.specialCd = 0; this.grabCd = 0;
      this.hits = 0; this.comboCount = 0; this.comboDisplayT = 0;
      this.speed = 135;
      this.dead = false;
      this.won = false;
    }

    get busy() { return !['idle', 'walk'].includes(this.state); }
    get canBeHit() { return this.invuln <= 0 && !['down', 'dead', 'fart', 'fartCharge', 'victory'].includes(this.state) && !this.won; }

    setState(s) { this.state = s; this.stateT = 0; }

    update(dt, inp) {
      this.t += dt; this.stateT += dt;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.specialCd > 0) this.specialCd -= dt;
      if (this.grabCd > 0) this.grabCd -= dt;
      if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.nextCombo = 'jab'; }
      if (this.comboDisplayT > 0) { this.comboDisplayT -= dt; if (this.comboDisplayT <= 0) this.comboCount = 0; }
      const ax = inp.axis();
      const pressed = inp.pressed;

      // gravity / jump physics
      if (this.z > 0 || this.vz !== 0) {
        this.vz -= GRAV * dt;
        this.z += this.vz * dt;
        if (this.z <= 0) {
          this.z = 0; this.vz = 0;
          if (this.state === 'jump' || this.state === 'jumpkick') { this.setState('idle'); this.g.fx.dust(this.x, this.y); }
          else if (this.state === 'down') { this.g.fx.dust(this.x, this.y, 10); WL.audio.sfx.thud(); this.vx = 0; }
          else if (this.state === 'dead') { this.vx = 0; }
        }
      }

      switch (this.state) {
        case 'idle': case 'walk': {
          // movement
          this.vx = ax.x * this.speed; this.vy = ax.y * this.speed * 0.62;
          if (ax.x !== 0) this.facing = ax.x > 0 ? 1 : -1;
          this.setState(ax.x || ax.y ? 'walk' : 'idle');
          if (this.state === 'walk' && this.stateT === 0) { /* keep t continuous */ }
          if (pressed.fart && this.fart >= this.fartMax) { this.startFart(); break; }
          if (pressed.attack) { this.startAttack(this.comboTimer > 0 ? this.nextCombo : 'jab'); break; }
          // SoR-style: walking into an enemy grabs it
          if (ax.x !== 0 && this.grabCd <= 0) {
            const target = this.findGrabTarget(22);
            if (target) { this.startGrab(target); break; }
          }
          if (pressed.jump) { this.vz = 330; this.z = 0.01; this.setState('jump'); WL.audio.sfx.jump(); break; }
          if (pressed.special && this.specialCd <= 0) { this.startSpray(); break; }
          if (pressed.tool && this.hasToolbox) { this.startThrow(); break; }
          break;
        }
        case 'attack': {
          const a = this.attack;
          this.vx *= 0.7; this.vy = 0;
          // small forward step on attack
          if (this.stateT < 0.1) this.vx = this.facing * 40;
          if (!this.hitDone && this.stateT >= a.hitAt) { this.hitDone = true; this.doAttackHit(a); }
          if (this.stateT >= a.dur) {
            this.setState('idle');
            this.comboTimer = a.next ? 0.5 : 0; this.nextCombo = a.next || 'jab';
          } else if (a.next && this.stateT >= a.hitAt + 0.08 && pressed.attack) {
            // early chain (buffer) — start next attack right after the hit lands
            this.startAttack(a.next);
          }
          break;
        }
        case 'jump': case 'jumpkick': {
          this.vx = ax.x !== 0 ? ax.x * this.speed * 0.9 : this.vx * 0.99;
          this.vy = ax.y * this.speed * 0.5;
          if (this.state === 'jump' && pressed.attack) { this.setState('jumpkick'); this.hitDone = false; WL.audio.sfx.swing(); }
          if (this.state === 'jumpkick' && !this.hitDone) {
            const hit = this.hitEnemies({ reach: 46, back: 0, dmg: 9, kb: 120, knockdown: true, zTol: 60 });
            if (hit) { this.hitDone = true; WL.audio.sfx.hit(true); }
          }
          break;
        }
        case 'spray': {
          this.vx = 0; this.vy = 0;
          if (!this.hitDone && this.stateT >= 0.1) {
            this.hitDone = true;
            let n = 0;
            for (const e of this.g.enemies) {
              if (!e.hittable) continue;
              const dx = (e.x - this.x) * this.facing, dy = Math.abs(e.y - this.y);
              if (dx > 0 && dx < 110 && dy < 44) { e.hurt(e.isBoss ? 8 : 4, this.x, { stun: e.isBoss ? 0 : 2.6, kb: 20 }); n++; }
            }
            for (const o of this.g.objects) { const dx = (o.x - this.x) * this.facing; if (dx > 0 && dx < 110 && Math.abs(o.y - this.y) < 40) o.hit(this.g, 1); }
            if (n) { this.registerHits(n); this.hp = Math.max(1, this.hp - 5); }
          }
          if (this.stateT >= 0.6) { this.setState('idle'); this.specialCd = 0.7; }
          break;
        }
        case 'throw': {
          this.vx = 0; this.vy = 0;
          if (!this.hitDone && this.stateT >= 0.1) {
            this.hitDone = true; this.hasToolbox = false;
            this.g.projectiles.push(new Projectile(this.g, { kind: 'toolbox', owner: 'player', x: this.x + this.facing * 20, y: this.y, z: 44, vx: this.facing * 430, vz: 40, dmg: 15, knockdown: true, pierce: 3, life: 0.9, dropAsPickup: true }));
            WL.audio.sfx.throwSfx();
          }
          if (this.stateT >= 0.32) this.setState('idle');
          break;
        }
        case 'grab': {
          const e = this.grab;
          this.vx = 0; this.vy = 0;
          this.grabT += dt;
          if (!e || e.dead || e.state !== 'grabbed') { this.grab = null; this.setState('idle'); break; }
          e.x = this.x + this.facing * 30; e.y = this.y; e.facing = -this.facing;
          if (this.grabT > 3.2) { this.releaseGrab(true); break; }
          if (pressed.attack && this.stateT > 0.15) {
            const back = ax.x !== 0 && Math.sign(ax.x) === -this.facing;
            if (back || this.grabHits >= 2) this.throwGrabbed();
            else {
              this.grabHits++; this.setState('grabHit');
              e.hurt(6, this.x, { noInterrupt: true, kb: 0 }); this.registerHits(1);
              this.g.fx.spark(e.x, e.y - 30); WL.audio.sfx.hit(false); this.g.hitstop = 0.04;
              this.g.shake(2, 0.08);
            }
          } else if (pressed.jump || pressed.tool) this.throwGrabbed();
          break;
        }
        case 'grabHit': {
          if (this.stateT >= 0.22) this.setState('grab');
          if (this.grab) { this.grab.x = this.x + this.facing * 30; this.grab.y = this.y; }
          break;
        }
        case 'hurt': {
          this.vx *= 0.85; this.vy = 0;
          if (this.stateT >= 0.32) { this.setState('idle'); this.invuln = Math.max(this.invuln, 0.25); }
          break;
        }
        case 'down': {
          if (this.z <= 0) { this.vx *= 0.8; if (this.stateT > 0.9 && this.z <= 0) { this.setState('idle'); this.invuln = 0.9; } }
          break;
        }
        case 'dead': {
          this.vx *= 0.9;
          if (this.stateT >= 1.6) { this.setState('gone'); this.g.playerDied(); /* may respawn -> idle */ }
          break;
        }
        case 'gone': this.vx = 0; break;
        case 'fartCharge': {
          this.vx = 0; this.vy = 0;
          if (this.stateT >= 0.4) { this.setState('fart'); this.g.triggerFart(); }
          break;
        }
        case 'fart': {
          this.vx = 0; this.vy = 0;
          if (this.stateT >= 1.1) this.setState('idle');
          break;
        }
        case 'victory': this.vx = 0; this.vy = 0; break;
      }

      // integrate
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.y = U.clamp(this.y, WL.FLOOR_TOP, WL.FLOOR_BOTTOM);
      const b = this.g.playerBounds();
      this.x = U.clamp(this.x, b.min, b.max);
      // pickups
      if (this.z < 12 && !['down', 'dead', 'gone', 'fart', 'fartCharge'].includes(this.state)) {
        for (const p of this.g.pickups) {
          if (p.dead || p.z > 20) continue;
          if (Math.abs(p.x - this.x) < 20 && Math.abs(p.y - this.y) < 16) this.collect(p);
        }
      }
    }

    startAttack(name) {
      const a = ATTACKS[name];
      this.attack = a; this.hitDone = false; this.comboTimer = 0;
      this.setState('attack');
      WL.audio.sfx.swing();
    }
    doAttackHit(a) {
      const n = this.hitEnemies({ reach: a.reach, back: a.back || 0, dmg: a.dmg, kb: a.kb, knockdown: a.knockdown, zTol: 40 });
      // breakables
      for (const o of this.g.objects) {
        if (o.dead) continue;
        const dx = (o.x - this.x) * this.facing;
        if (dx > -(a.back || 0) - 10 && dx < a.reach + 10 && Math.abs(o.y - this.y) < 34) { o.hit(this.g, 1); this.g.fx.spark(o.x, o.y - 20); }
      }
      if (n) {
        if (a.sfx === 'hitHeavy') WL.audio.sfx.hit(true); else if (a.sfx === 'clank') WL.audio.sfx.clank(); else WL.audio.sfx.hit(false);
        this.g.hitstop = a.knockdown ? 0.07 : 0.045;
        this.g.shake(a.knockdown ? 4 : 1.5, 0.1);
      }
    }
    /** Apply damage to enemies in the melee box in front. Returns hit count. */
    hitEnemies(box) {
      let n = 0;
      for (const e of this.g.enemies) {
        if (!e.hittable) continue;
        const dx = (e.x - this.x) * this.facing, dy = Math.abs(e.y - this.y);
        const hw = e.isBoss ? 40 : 12;
        if (dx > -(box.back || 0) - hw && dx < box.reach + hw && dy < 26 && Math.abs(e.z - this.z) < (box.zTol || 40)) {
          e.hurt(box.dmg, this.x, { knockdown: box.knockdown, kb: box.kb });
          this.g.fx.spark(e.x - this.facing * 6, e.y - e.height * 0.6 - e.z, box.knockdown);
          n++;
        }
      }
      if (n) this.registerHits(n);
      return n;
    }
    registerHits(n) {
      this.hits += n; this.comboCount += n; this.comboDisplayT = 1.6;
    }
    findGrabTarget(range) {
      let best = null, bd = 1e9;
      for (const e of this.g.enemies) {
        if (!e.grabbable || e.state === 'windup') continue;
        const dx = (e.x - this.x) * this.facing, dy = Math.abs(e.y - this.y);
        if (dx > 0 && dx < (range || 34) && dy < 14 && dx < bd) { best = e; bd = dx; }
      }
      return best;
    }
    startGrab(e) {
      this.grab = e; this.grabHits = 0; this.grabT = 0;
      e.getGrabbed(this);
      this.setState('grab');
      WL.audio.sfx.tape();
      this.g.fx.text(this.x, this.y - 90, 'DUCT-TAPED!', '#ddd');
    }
    releaseGrab(broken) {
      const e = this.grab; this.grab = null; this.grabCd = 0.8;
      if (e && e.state === 'grabbed') { e.release(); if (broken) { e.setState('approach'); this.hurt(4, e.x, false); } }
      this.setState('idle');
    }
    throwGrabbed() {
      const e = this.grab; this.grab = null; this.grabCd = 0.5;
      if (e) { e.thrown(this.facing, this); this.registerHits(1); }
      this.setState('throw'); this.hitDone = true;
      WL.audio.sfx.throwSfx(); this.g.shake(2, 0.1);
    }
    startSpray() { this.setState('spray'); this.hitDone = false; WL.audio.sfx.spray(); }
    startThrow() { this.setState('throw'); this.hitDone = false; }
    startFart() {
      if (this.grab) this.releaseGrab(false);
      this.setState('fartCharge'); this.invuln = 2;
      WL.audio.sfx.blip();
    }
    collect(p) {
      p.dead = true;
      switch (p.kind) {
        case 'beans': this.addFart(35, 'BEANS! +35'); break;
        case 'chili': this.addFart(50, 'CHILI! +50'); break;
        case 'leftovers': this.addFart(25, 'LEFTOVERS +25'); break;
        case 'coffee': this.addFart(15, 'COFFEE +15'); break;
        case 'burger': this.heal(30, 'BURGER +30'); break;
        case 'turkey': this.heal(60, 'TURKEY LEG +60'); break;
        case 'chip': this.addScore(500); this.g.fx.text(this.x, this.y - 90, '+500', '#ffe14a'); WL.audio.sfx.pickup(); break;
        case 'toolbox': this.hasToolbox = true; this.g.fx.text(this.x, this.y - 90, 'TOOLBOX!', '#f66'); WL.audio.sfx.pickup(); break;
      }
    }
    addFart(n, label) {
      const was = this.fart;
      this.fart = Math.min(this.fartMax, this.fart + n);
      this.g.fx.text(this.x, this.y - 90, label, '#9f3');
      WL.audio.sfx.chomp();
      if (this.fart >= this.fartMax && was < this.fartMax) { this.g.fx.text(this.x, this.y - 106, 'VOLCANO FART READY!', '#5f5', 2.2); WL.audio.sfx.oneUp(); }
    }
    heal(n, label) { this.hp = Math.min(this.maxHp, this.hp + n); this.g.fx.text(this.x, this.y - 90, label, '#6f6'); WL.audio.sfx.heal(); }
    addScore(n) { this.score += n; }

    hurt(dmg, fromX, knockdown) {
      if (!this.canBeHit) return false;
      if (this.g.cheatInvuln) return false;
      if (this.grab) this.releaseGrab(false);
      this.hp -= dmg; this.flash = 0.12;
      const dir = this.x < fromX ? -1 : 1; // pushed away from attacker
      this.comboCount = 0;
      if (this.hp <= 0) {
        this.hp = 0; this.setState('dead'); this.vx = dir * 120; this.vz = 200; this.z = 0.01;
        WL.audio.sfx.hurt(); WL.audio.sfx.thud(); this.g.shake(6, 0.3);
        return true;
      }
      if (knockdown) { this.setState('down'); this.vx = dir * 140; this.vz = 190; this.z = 0.01; WL.audio.sfx.hurt(); this.g.shake(4, 0.2); }
      else { this.setState('hurt'); this.vx = dir * 90; this.invuln = 0.15; WL.audio.sfx.hurt(); this.g.shake(2, 0.1); }
      return true;
    }

    respawn(x, y) {
      this.hp = this.maxHp; this.x = x; this.y = y; this.z = 0; this.vx = this.vy = this.vz = 0;
      this.setState('idle'); this.invuln = 2.5; this.grab = null; this.hasToolbox = true;
    }

    get height() { return 78; }

    /** Pose name for the sprite renderer */
    pose() {
      switch (this.state) {
        case 'idle': return this.hasToolbox ? 'idle' : 'idle';
        case 'walk': return 'walk';
        case 'attack': { const a = this.attack; return (a.windPose && this.stateT < a.windUntil) ? a.windPose : a.pose; }
        case 'jump': return 'jump';
        case 'jumpkick': return 'jumpkick';
        case 'spray': return 'spray';
        case 'throw': return 'throw';
        case 'grab': return 'grab';
        case 'grabHit': return 'grabHit';
        case 'hurt': return 'hurt';
        case 'down': return this.z > 0 ? 'hurt' : 'down';
        case 'dead': case 'gone': return 'dead';
        case 'fartCharge': return 'fartCharge';
        case 'fart': return 'fart';
        case 'victory': return 'victory';
      }
      return 'idle';
    }

    draw(ctx, camX) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y);
      if (this.state === 'gone') return;
      WL.draw.shadow(ctx, sx, sy, 20, 6);
      const blink = this.invuln > 0 && !['down', 'dead', 'fart', 'fartCharge'].includes(this.state) && Math.floor(this.t * 20) % 2 === 0;
      S.drawLance(ctx, sx, sy - this.z, { pose: this.pose(), t: this.t, facing: this.facing, flash: this.flash > 0, alpha: blink ? 0.45 : 1 });
      if (this.state === 'spray' && this.stateT > 0.08) S.drawSprayCone(ctx, sx + this.facing * 30, sy - 56, this.facing, this.t, 100);
      if (this.state === 'fartCharge') {
        // rumble lines
        ctx.save(); ctx.strokeStyle = '#9f3'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { const a = this.t * 12 + i; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 30, sy - 30 + Math.sin(a) * 10); ctx.lineTo(sx + Math.cos(a) * 40, sy - 30 + Math.sin(a) * 14); ctx.stroke(); }
        ctx.restore();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Enemy                                                               */
  /* ------------------------------------------------------------------ */
  const ENEMY_DEFS = {
    broccoli: { hp: 26, speed: 58, dmg: 7, reach: 36, score: 100, height: 66, windup: 0.42, attackDur: 0.3, ranged: false, name: 'BROCCOLI GOON' },
    sprout: { hp: 12, speed: 95, dmg: 5, reach: 26, score: 50, height: 40, windup: 0.3, attackDur: 0.25, roll: true, name: 'BRUSSELS SPROUT' },
    celery: { hp: 22, speed: 62, dmg: 8, reach: 56, score: 120, height: 84, windup: 0.45, attackDur: 0.32, name: 'CELERY STALKER' },
    carrot: { hp: 24, speed: 125, dmg: 8, reach: 34, score: 150, height: 62, windup: 0.28, attackDur: 0.26, dash: true, ranged: 'shuriken', name: 'CARROT NINJA' },
    spinach: { hp: 48, speed: 46, dmg: 12, reach: 40, score: 200, height: 70, windup: 0.6, attackDur: 0.35, knockdown: true, armor: true, name: 'SPINACH THUG' },
    kale: { hp: 75, speed: 52, dmg: 14, reach: 44, score: 300, height: 84, windup: 0.55, attackDur: 0.35, knockdown: true, armor: true, charge: true, name: 'KALE BRUISER' },
    froyo: { hp: 32, speed: 72, dmg: 6, reach: 32, score: 400, height: 60, windup: 0.35, attackDur: 0.3, ranged: 'sprinkle', keepAway: true, name: 'FROZEN YOGURT' }
  };

  class Enemy {
    constructor(g, type, x, y, opts = {}) {
      this.g = g; this.type = type;
      const d = ENEMY_DEFS[type]; this.def = d;
      const mult = opts.hpMult || 1;
      this.maxHp = Math.round(d.hp * mult); this.hp = this.maxHp;
      this.speed = d.speed * (opts.speedMult || 1) * U.rand(0.92, 1.08);
      this.x = x; this.y = y; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0;
      this.facing = -1;
      this.state = 'approach'; this.stateT = 0; this.t = U.rand(0, 10);
      this.flash = 0; this.stun = 0;
      this.attackCd = U.rand(0.6, 1.6);
      this.laneOff = U.rand(-14, 14);
      this.side = opts.side || (U.chance(0.5) ? 1 : -1); // preferred side of player
      this.sideTimer = U.rand(2, 5);
      this.waitT = 0;
      this.dead = false; this.remove = false;
      this.isBoss = false;
      this.height = d.height;
      this.hitDone = false;
      this.rangedCd = U.rand(1.5, 3);
      this.dropChance = opts.dropChance !== undefined ? opts.dropChance : 0.22;
      this.elite = !!opts.elite;
      if (this.elite) { this.maxHp = Math.round(this.maxHp * 1.5); this.hp = this.maxHp; }
    }

    get hittable() { return !this.dead && !['down', 'dead', 'thrown', 'spawn'].includes(this.state) && this.z < 80; }
    get grabbable() { return !this.dead && !this.isBoss && ['approach', 'wait', 'stunned', 'hurt', 'windup', 'idle'].includes(this.state) && this.z <= 0; }
    setState(s) { this.state = s; this.stateT = 0; }

    update(dt) {
      this.t += dt; this.stateT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.rangedCd > 0) this.rangedCd -= dt;
      const p = this.g.player;

      // vertical physics
      if (this.z > 0 || this.vz !== 0) {
        this.vz -= GRAV * dt; this.z += this.vz * dt;
        if (this.z <= 0) {
          this.z = 0; this.vz = 0;
          if (this.state === 'thrown') { this.landThrown(); }
          else if (this.state === 'down') { this.vx = 0; this.g.fx.dust(this.x, this.y, 8); WL.audio.sfx.thud(); }
        }
      }

      if (this.dead) { this.vx *= 0.9; if (this.stateT > 0.9) this.remove = true; this.x += this.vx * dt; return; }

      switch (this.state) {
        case 'approach': case 'wait': this.think(dt, p); break;
        case 'windup':
          this.vx = 0; this.vy = 0;
          if (this.stateT >= this.def.windup) { this.setState('attack'); this.hitDone = false; }
          break;
        case 'attack': {
          this.vx = this.facing * 30; this.vy = 0;
          if (!this.hitDone && this.stateT >= 0.08) {
            this.hitDone = true;
            const dx = (p.x - this.x) * this.facing, dy = Math.abs(p.y - this.y);
            if (dx > -6 && dx < this.def.reach + 14 && dy < 26 && p.z < 40) {
              if (p.hurt(this.def.dmg, this.x, !!this.def.knockdown)) this.g.fx.spark(p.x, p.y - 50, !!this.def.knockdown);
            }
          }
          if (this.stateT >= this.def.attackDur) { this.setState('recover'); this.attackCd = U.rand(0.9, 1.9); }
          break;
        }
        case 'recover': this.vx *= 0.8; this.vy = 0; if (this.stateT >= 0.45) this.setState('approach'); break;
        case 'dash': case 'roll': {
          this.vx = this.facing * this.speed * 2.6; this.vy = 0;
          if (!this.hitDone) {
            const dx = (p.x - this.x) * this.facing, dy = Math.abs(p.y - this.y);
            if (dx > -10 && dx < 30 && dy < 22 && p.z < 30) { this.hitDone = true; if (p.hurt(this.def.dmg, this.x, this.state === 'roll')) this.g.fx.spark(p.x, p.y - 40); }
          }
          if (this.stateT >= 0.42) { this.setState('recover'); this.attackCd = U.rand(1.2, 2.2); }
          break;
        }
        case 'charge': {
          this.vx = this.facing * this.speed * 2.2; this.vy = 0;
          if (!this.hitDone) {
            const dx = (p.x - this.x) * this.facing, dy = Math.abs(p.y - this.y);
            if (dx > -10 && dx < 36 && dy < 26 && p.z < 30) { this.hitDone = true; if (p.hurt(this.def.dmg, this.x, true)) { this.g.fx.spark(p.x, p.y - 50, true); this.g.shake(4, 0.15); } }
          }
          if (this.stateT >= 0.7) { this.setState('recover'); this.attackCd = U.rand(1.5, 2.5); }
          break;
        }
        case 'spit': {
          this.vx = 0; this.vy = 0;
          if (!this.hitDone && this.stateT >= 0.3) {
            this.hitDone = true;
            if (this.def.ranged === 'shuriken') { this.g.projectiles.push(new Projectile(this.g, { kind: 'shuriken', owner: 'enemy', x: this.x + this.facing * 14, y: this.y, z: 40, vx: this.facing * 300, vz: 0, dmg: 6, life: 1.6 })); WL.audio.sfx.shuriken(); }
            else { this.g.projectiles.push(new Projectile(this.g, { kind: 'sprinkle', owner: 'enemy', x: this.x + this.facing * 14, y: this.y, z: 48, vx: this.facing * 240, vz: 60, dmg: 5, life: 1.8, color: U.pick(['#ff4a4a', '#4ad0ff', '#ffe14a', '#4aff88']) })); WL.audio.sfx.splat(); }
          }
          if (this.stateT >= 0.6) { this.setState('approach'); this.rangedCd = U.rand(2.5, 4.5); }
          break;
        }
        case 'hurt': this.vx *= 0.82; this.vy = 0; if (this.stateT >= 0.3) this.setState('approach'); break;
        case 'down':
          if (this.z <= 0) { this.vx *= 0.8; if (this.stateT >= 1.1) { this.setState('getup'); } }
          break;
        case 'getup': this.vx = 0; if (this.stateT >= 0.35) { this.setState('approach'); this.attackCd = U.rand(0.3, 0.9); } break;
        case 'stunned':
          this.vx = 0; this.vy = 0; this.stun -= dt;
          if (this.stun <= 0) this.setState('approach');
          break;
        case 'grabbed': this.vx = 0; this.vy = 0; break;
        case 'thrown': {
          // fly, hit other enemies
          for (const o of this.g.enemies) {
            if (o === this || !o.hittable || o.state === 'grabbed') continue;
            if (Math.abs(o.x - this.x) < (o.isBoss ? 40 : 22) && Math.abs(o.y - this.y) < 28 && !this.hitList.has(o)) {
              this.hitList.add(o);
              o.hurt(o.isBoss ? 18 : 14, this.x, { knockdown: true, kb: 120 });
              this.g.fx.spark(o.x, o.y - 30, true); WL.audio.sfx.hit(true); this.g.player.registerHits(1);
            }
          }
          for (const ob of this.g.objects) if (!ob.dead && Math.abs(ob.x - this.x) < 26 && Math.abs(ob.y - this.y) < 30) ob.hit(this.g, 3);
          break;
        }
        case 'spawn': this.vx = 0; this.vy = 0; if (this.stateT > 0.5) this.setState('approach'); break;
      }

      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.state !== 'thrown') this.y = U.clamp(this.y, WL.FLOOR_TOP, WL.FLOOR_BOTTOM);
      // keep within a generous margin of the camera so they don't wander off forever
      const cam = this.g.camX;
      if (this.state !== 'thrown') this.x = U.clamp(this.x, cam - 60, cam + WL.W + 60);
    }

    think(dt, p) {
      const dx = p.x - this.x, dy = (p.y + this.laneOff) - this.y;
      const adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      this.sideTimer -= dt;
      if (this.sideTimer <= 0) { this.sideTimer = U.rand(2, 5); if (U.chance(0.4)) this.side *= -1; this.laneOff = U.rand(-14, 14); }
      const pDown = ['down', 'dead', 'gone'].includes(p.state);

      // Ranged behavior
      if (this.def.ranged && this.rangedCd <= 0 && adx > 120 && adx < 300 && Math.abs(dy) < 30 && !pDown) {
        this.setState('spit'); this.hitDone = false; return;
      }
      // Dash / roll / charge openers
      if (!pDown && this.attackCd <= 0 && Math.abs(dy) < 14 && adx > 70 && adx < 190 && this.g.attackers() < 2) {
        if (this.def.dash && U.chance(0.7)) { this.setState('dash'); this.hitDone = false; WL.audio.sfx.swing(); return; }
        if (this.def.roll && U.chance(0.6)) { this.setState('roll'); this.hitDone = false; return; }
        if (this.def.charge && U.chance(0.5)) { this.setState('charge'); this.hitDone = false; WL.audio.sfx.bossRoar(); return; }
      }

      // desired standoff position
      let standoff = this.def.reach - 8;
      if (this.def.keepAway && this.rangedCd > 0.6) standoff = 150; // froyo hangs back while reloading
      const targetX = p.x - this.side * 0; // we approach from whichever side we're on
      // If we're on the wrong side and far, walk around
      const onSide = Math.sign(this.x - p.x) || 1;
      const wantX = p.x + onSide * standoff;
      const ex = wantX - this.x, ey = dy;
      const dist = Math.hypot(ex, ey);

      if (this.state === 'wait') {
        this.vx = 0; this.vy = 0;
        if (this.stateT >= this.waitT) this.setState('approach');
        // still attack if in range
      }

      const inRange = adx <= this.def.reach && Math.abs(dy - this.laneOff) < 16 && Math.abs(p.y - this.y) < 16;
      if (inRange && !pDown) {
        this.vx = 0; this.vy = 0;
        if (this.attackCd <= 0 && this.g.attackers() < 2 && p.z < 40) { this.setState('windup'); return; }
        if (this.attackCd <= 0 && this.g.attackers() >= 2) this.attackCd = U.rand(0.2, 0.5);
        return;
      }
      if (this.state === 'approach') {
        if (dist > 4) {
          const spd = pDown ? this.speed * 0.5 : this.speed;
          this.vx = (ex / dist) * spd; this.vy = (ey / dist) * spd * 0.7;
        } else { this.vx = 0; this.vy = 0; }
        // Occasionally pause (SoR hover)
        if (adx > 60 && U.chance(dt * 0.35)) { this.setState('wait'); this.waitT = U.rand(0.4, 1.1); }
      }
      // separation from other enemies
      for (const o of this.g.enemies) {
        if (o === this || o.dead || o.isBoss) continue;
        const sx = this.x - o.x, sy = this.y - o.y;
        const d = Math.hypot(sx, sy);
        if (d < 26 && d > 0.01) { this.vx += (sx / d) * 40; this.vy += (sy / d) * 30; }
      }
    }

    hurt(dmg, fromX, opts = {}) {
      if (this.dead) return;
      if (this.state === 'thrown') return;
      this.hp -= dmg; this.flash = 0.1;
      this.g.player.addScore(Math.round(dmg * (this.type === 'froyo' ? 4 : 2)));
      const dir = this.x < fromX ? -1 : 1;
      if (this.hp <= 0) { this.die(dir); return; }
      if (opts.stun) { this.stun = opts.stun; this.setState('stunned'); this.vx = dir * 20; WL.audio.sfx.blip(); this.g.fx.text(this.x, this.y - this.height - 10, 'FROZEN!', '#8ff'); return; }
      if (opts.noInterrupt || this.state === 'grabbed') return;
      const armored = this.def.armor && ['windup', 'attack', 'charge'].includes(this.state) && !opts.knockdown;
      if (armored) { this.g.fx.text(this.x, this.y - this.height - 6, 'ARMOR', '#aaa', 0.6); return; }
      if (opts.knockdown) { this.setState('down'); this.vx = dir * (opts.kb || 120); this.vz = 200; this.z = 0.01; }
      else { this.setState('hurt'); this.vx = dir * (opts.kb || 50); }
    }
    die(dir) {
      this.dead = true; this.setState('dead'); this.vx = (dir || 1) * 120; this.vz = 220; this.z = Math.max(this.z, 0.01);
      const pts = this.def.score * (this.elite ? 2 : 1);
      this.g.player.addScore(pts);
      this.g.fx.text(this.x, this.y - this.height, this.type === 'froyo' ? `+${pts} FROYO HATE x2` : `+${pts}`, this.type === 'froyo' ? '#f9c' : '#ffe14a');
      if (this.type === 'froyo') this.g.player.addScore(pts);
      WL.audio.sfx.enemyDie();
      this.g.fx.burst(this.x, this.y - this.height / 2, this.type);
      // drops
      if (U.chance(this.dropChance) || this.forceDrop) {
        const kind = this.forceDrop || U.pick(['beans', 'beans', 'chili', 'leftovers', 'leftovers', 'burger', 'chip', 'coffee']);
        this.g.spawnPickup(kind, this.x, this.y, true);
      }
      this.g.onEnemyKilled(this);
    }
    getGrabbed(p) { this.setState('grabbed'); this.vx = 0; this.vy = 0; this.z = 0; this.vz = 0; }
    release() { this.setState('recover'); }
    thrown(dir, p) {
      this.setState('thrown'); this.facing = -dir; this.vx = dir * 400; this.vz = 210; this.z = 0.01; this.hitList = new Set();
      this.hp -= 10;
    }
    landThrown() {
      this.vx = 0; this.g.fx.dust(this.x, this.y, 12); WL.audio.sfx.thud(); this.g.shake(3, 0.12);
      this.hitList = null;
      if (this.hp <= 0) this.die(this.facing); else { this.setState('down'); this.stateT = 0.3; }
    }

    pose() {
      switch (this.state) {
        case 'approach': return (Math.abs(this.vx) + Math.abs(this.vy) > 8) ? 'walk' : 'idle';
        case 'wait': case 'recover': case 'getup': case 'spawn': return 'idle';
        case 'windup': return 'windup';
        case 'attack': return this.def.reach > 50 ? 'kick' : 'attack';
        case 'dash': case 'charge': return 'dash';
        case 'roll': return 'roll';
        case 'spit': return 'spit';
        case 'hurt': return 'hurt';
        case 'down': return this.z > 0 ? 'hurt' : 'down';
        case 'dead': return 'dead';
        case 'stunned': return 'stunned';
        case 'grabbed': return 'grabbed';
        case 'thrown': return 'thrown';
      }
      return 'idle';
    }
    draw(ctx, camX) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y);
      WL.draw.shadow(ctx, sx, sy, this.height * 0.28, this.height * 0.09);
      const alpha = this.dead ? Math.max(0, 1 - (this.stateT - 0.4) * 2) : (this.state === 'spawn' ? this.stateT * 2 : 1);
      S.drawEnemy(ctx, sx, sy - this.z, { type: this.type, pose: this.pose(), t: this.t, facing: this.facing, flash: this.flash > 0 || (this.dead && Math.floor(this.t * 30) % 2 === 0), alpha, taped: this.state === 'grabbed', stunTint: this.state === 'stunned' });
      if (this.elite) WL.text.draw(ctx, 'ELITE', sx, sy - this.z - this.height - 14, { size: 6, align: 'center', color: '#fc6' });
      // windup telegraph
      if (this.state === 'windup' && Math.floor(this.stateT * 16) % 2 === 0) WL.text.draw(ctx, '!', sx, sy - this.z - this.height - 16, { size: 12, align: 'center', color: '#f44' });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boss: Giant Frozen Yogurt Cone                                      */
  /* ------------------------------------------------------------------ */
  class Boss extends Enemy {
    constructor(g, x, y) {
      super(g, 'froyo', x, y);
      this.isBoss = true; this.def = { ...ENEMY_DEFS.froyo, name: 'GIANT FROYO CONE', reach: 96, dmg: 12, score: 5000, height: 150, knockdown: true };
      this.maxHp = 620; this.hp = this.maxHp; this.height = 150; this.speed = 48;
      this.armorMax = 70; this.armorHp = this.armorMax; this.armorRegen = 0;
      this.phase = 1; this.summoned = false; this.puddleT = 0;
      this.melt = 0; this.dropChance = 0;
      this.intro = 2.2; this.state = 'intro';
      this.attackCd = 1.2;
    }
    get grabbable() { return false; }
    get hittable() { return !this.dead && this.state !== 'intro' && this.z < 120; }
    get armor() { return this.phase === 1 && this.armorHp > 0 ? this.armorHp / this.armorMax : 0; }

    update(dt) {
      this.t += dt; this.stateT += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.attackCd > 0) this.attackCd -= dt;
      const p = this.g.player;
      // phase
      const r = this.hp / this.maxHp;
      const np = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
      if (np !== this.phase && !this.dead) {
        this.phase = np; this.g.onBossPhase(np);
        this.setState('stagger'); this.staggerT = 1.4;
      }
      if (this.phase === 1 && this.armorHp <= 0 && this.state !== 'stagger') { this.armorRegen += dt; if (this.armorRegen > 7) { this.armorHp = this.armorMax; this.armorRegen = 0; this.g.fx.text(this.x, this.y - 170, 'SWIRL ARMOR RESTORED', '#bff'); } }

      if (this.z > 0 || this.vz !== 0) {
        this.vz -= GRAV * dt; this.z += this.vz * dt;
        if (this.z <= 0) {
          this.z = 0; this.vz = 0;
          if (this.state === 'jump') { this.setState('land'); this.landHit(); }
        }
      }
      if (this.dead) {
        this.melt = Math.min(1, this.stateT / 3);
        if (Math.random() < 0.3) this.g.fx.burst(this.x + U.rand(-50, 50), this.y - U.rand(20, 140), 'froyo');
        if (this.stateT > 3.2) { this.remove = true; this.g.bossDefeated(); }
        return;
      }
      const dx = p.x - this.x, adx = Math.abs(dx), dy = p.y - this.y;
      switch (this.state) {
        case 'intro': this.vx = 0; this.vy = 0; if (this.stateT >= this.intro) this.setState('approach'); break;
        case 'approach': {
          this.facing = dx > 0 ? 1 : -1;
          const standoff = 80;
          const wantX = p.x - Math.sign(dx || 1) * standoff;
          const ex = wantX - this.x, ey = dy;
          const dist = Math.hypot(ex, ey);
          if (dist > 4) { this.vx = ex / dist * this.speed * (this.phase === 3 ? 1.5 : 1); this.vy = ey / dist * this.speed * 0.7; } else { this.vx = 0; this.vy = 0; }
          if (this.phase >= 3) { this.puddleT += dt; if (this.puddleT > 2.2) { this.puddleT = 0; this.g.puddles.push({ x: this.x, y: this.y + 4, r: 34, t: 0, life: 9 }); } }
          if (this.attackCd <= 0) {
            const pDown = ['down', 'dead', 'gone'].includes(p.state);
            if (pDown) { this.attackCd = 0.6; break; }
            if (adx < 110 && Math.abs(dy) < 30) { this.setState('slamWind'); this.hitDone = false; break; }
            const roll = Math.random();
            if (this.phase >= 2 && roll < 0.4) { this.setState('rainWind'); this.hitDone = false; WL.audio.sfx.bossRoar(); break; }
            if (this.phase >= 2 && roll < 0.75 && adx > 90) { this.setState('jump'); this.vz = 420; this.z = 0.01; this.jumpTargetX = p.x; this.jumpTargetY = p.y; WL.audio.sfx.jump(); break; }
            if (this.phase >= 2 && !this.summoned && roll >= 0.75) { this.summoned = true; this.setState('rainWind'); this.hitDone = false; this.summonNext = true; break; }
            this.attackCd = 0.4;
          }
          break;
        }
        case 'slamWind': this.vx = 0; this.vy = 0; if (this.stateT >= 0.75) { this.setState('slam'); this.hitDone = false; } break;
        case 'slam': {
          this.vx = 0; this.vy = 0;
          if (!this.hitDone && this.stateT >= 0.1) {
            this.hitDone = true; WL.audio.sfx.slam(); this.g.shake(7, 0.3);
            this.g.fx.dust(this.x + this.facing * 70, this.y, 22);
            const ddx = (p.x - this.x) * this.facing;
            if (ddx > -10 && ddx < 130 && Math.abs(p.y - this.y) < 40 && p.z < 50) { if (p.hurt(this.def.dmg, this.x, true)) this.g.fx.spark(p.x, p.y - 50, true); }
            if (this.phase >= 3) this.g.puddles.push({ x: this.x + this.facing * 70, y: this.y + 4, r: 30, t: 0, life: 8 });
          }
          if (this.stateT >= 0.5) { this.setState('recover'); this.attackCd = this.phase === 3 ? 0.7 : 1.3; }
          break;
        }
        case 'jump': {
          // steer toward target
          const tx = this.jumpTargetX, ty = this.jumpTargetY;
          this.vx = U.clamp((tx - this.x) * 2.2, -260, 260); this.vy = U.clamp((ty - this.y) * 2, -120, 120);
          this.facing = p.x > this.x ? 1 : -1;
          break;
        }
        case 'land': this.vx = 0; this.vy = 0; if (this.stateT >= 0.7) { this.setState('recover'); this.attackCd = 1.0; } break;
        case 'rainWind': {
          this.vx = 0; this.vy = 0;
          if (!this.hitDone && this.stateT >= 0.7) {
            this.hitDone = true;
            if (this.summonNext) {
              this.summonNext = false;
              this.g.spawnEnemy('froyo', this.g.camX + 40, U.rand(WL.FLOOR_TOP + 20, WL.FLOOR_BOTTOM - 20), { hpMult: 0.8 });
              this.g.spawnEnemy('froyo', this.g.camX + WL.W - 40, U.rand(WL.FLOOR_TOP + 20, WL.FLOOR_BOTTOM - 20), { hpMult: 0.8 });
              this.g.fx.text(this.x, this.y - 170, 'FROYO BACKUP!', '#f9c');
            } else {
              const n = this.phase === 3 ? 12 : 8;
              for (let i = 0; i < n; i++) {
                const tx = U.clamp(p.x + U.rand(-140, 140), this.g.camX + 20, this.g.camX + WL.W - 20);
                const ty = U.rand(WL.FLOOR_TOP, WL.FLOOR_BOTTOM);
                this.g.projectiles.push(new Projectile(this.g, { kind: 'bigsprinkle', owner: 'enemy', x: tx, y: ty, z: 340 + i * 30, vx: 0, vz: -20, dmg: 7, knockdown: true, falling: true, color: U.pick(['#ff4a4a', '#4ad0ff', '#ffe14a', '#4aff88', '#ff8ae0']), rot: U.rand(0, 3) }));
              }
              WL.audio.sfx.throwSfx();
              this.g.fx.text(this.x, this.y - 170, 'SPRINKLE RAIN!', '#fc6');
            }
          }
          if (this.stateT >= 1.3) { this.setState('recover'); this.attackCd = 1.4; }
          break;
        }
        case 'recover': this.vx = 0; this.vy = 0; if (this.stateT >= 0.6) this.setState('approach'); break;
        case 'hurt': this.vx = 0; this.vy = 0; if (this.stateT >= 0.18) this.setState('approach'); break;
        case 'stagger': this.vx = 0; this.vy = 0; if (this.stateT >= (this.staggerT || 3)) { this.setState('approach'); this.attackCd = 0.5; } break;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.y = U.clamp(this.y, WL.FLOOR_TOP, WL.FLOOR_BOTTOM);
      this.x = U.clamp(this.x, this.g.camX + 40, this.g.camX + WL.W - 40);
    }
    landHit() {
      WL.audio.sfx.slam(); this.g.shake(9, 0.35); this.g.fx.dust(this.x, this.y, 30);
      const p = this.g.player;
      if (Math.hypot(p.x - this.x, (p.y - this.y) * 1.6) < 95 && p.z < 60) { if (p.hurt(12, this.x, true)) this.g.fx.spark(p.x, p.y - 50, true); }
      for (const e of this.g.enemies) if (e !== this && e.hittable && Math.hypot(e.x - this.x, (e.y - this.y) * 1.6) < 95) e.hurt(10, this.x, { knockdown: true });
      if (this.phase >= 3) this.g.puddles.push({ x: this.x, y: this.y + 4, r: 44, t: 0, life: 9 });
    }
    hurt(dmg, fromX, opts = {}) {
      if (this.dead || this.state === 'intro') return;
      let real = dmg;
      if (this.armor > 0) {
        real = Math.round(dmg * 0.35);
        this.armorHp -= dmg;
        if (this.armorHp <= 0) { this.armorHp = 0; this.armorRegen = 0; this.setState('stagger'); this.staggerT = 3.2; this.g.fx.text(this.x, this.y - 170, 'SWIRL ARMOR BROKEN!', '#fff', 1.5); WL.audio.sfx.break(); this.g.shake(5, 0.3); }
        else this.g.fx.text(this.x + U.rand(-20, 20), this.y - 150, 'CLINK', '#bff', 0.5);
      }
      if (opts.fart) real = dmg;
      this.hp -= real; this.flash = 0.1;
      this.g.player.addScore(real * 3);
      if (this.hp <= 0) { this.hp = 0; this.die(); return; }
      if (opts.fart) { this.armorHp = 0; this.armorRegen = 0; this.setState('stagger'); this.staggerT = 3; return; }
      if (['approach', 'recover'].includes(this.state) && !opts.noInterrupt) this.setState('hurt');
    }
    die() {
      this.dead = true; this.setState('dead'); this.vx = 0; this.vy = 0;
      this.g.player.addScore(5000);
      this.g.fx.text(this.x, this.y - 160, '+5000', '#ffe14a', 3);
      WL.audio.sfx.bossRoar(); WL.audio.sfx.enemyDie(); this.g.shake(10, 0.8);
    }
    pose() {
      switch (this.state) {
        case 'approach': return Math.abs(this.vx) + Math.abs(this.vy) > 5 ? 'walk' : 'idle';
        case 'slamWind': return 'slamWind'; case 'slam': return 'slam';
        case 'jump': return 'jump'; case 'land': return 'land';
        case 'rainWind': return 'rainWind';
        case 'hurt': return 'hurt'; case 'stagger': return 'stagger';
        case 'dead': return 'dead';
      }
      return 'idle';
    }
    draw(ctx, camX) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y);
      WL.draw.shadow(ctx, sx, sy, 50, 14);
      ctx.save();
      if (this.dead) { ctx.globalAlpha = Math.max(0, 1 - Math.max(0, this.stateT - 2) * 0.9); }
      S.drawBoss(ctx, sx, sy - this.z, { pose: this.pose(), t: this.t, facing: this.facing, flash: this.flash > 0, armor: this.armor, phase: this.phase, melt: this.melt });
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pickup                                                              */
  /* ------------------------------------------------------------------ */
  class Pickup {
    constructor(g, kind, x, y, pop) {
      this.g = g; this.kind = kind; this.x = x; this.y = U.clamp(y, WL.FLOOR_TOP, WL.FLOOR_BOTTOM); this.z = pop ? 1 : 0; this.vz = pop ? 230 : 0; this.vx = pop ? U.rand(-60, 60) : 0;
      this.t = U.rand(0, 5); this.dead = false; this.remove = false;
    }
    update(dt) {
      this.t += dt;
      if (this.z > 0 || this.vz) { this.vz -= GRAV * dt; this.z += this.vz * dt; this.x += this.vx * dt; if (this.z <= 0) { this.z = 0; if (Math.abs(this.vz) > 60) this.vz = -this.vz * 0.4; else { this.vz = 0; this.vx = 0; } } }
      if (this.dead) this.remove = true;
    }
    draw(ctx, camX) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y);
      WL.draw.shadow(ctx, sx, sy, 10, 3);
      S.drawPickup(ctx, sx, sy - this.z, this.kind, this.t);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Breakable object                                                    */
  /* ------------------------------------------------------------------ */
  class Breakable {
    constructor(g, kind, x, y, contents) {
      this.g = g; this.kind = kind; this.x = x; this.y = y; this.z = 0;
      this.hp = kind === 'vending' ? 4 : kind === 'crate' ? 3 : 2;
      this.contents = contents || [U.pick(['beans', 'chili', 'leftovers', 'burger'])];
      this.dead = false; this.remove = false; this.t = 0; this.shakeT = 0;
      this.height = kind === 'vending' ? 70 : 36;
    }
    hit(g, n) {
      if (this.dead) return;
      this.hp -= n; this.shakeT = 0.15; WL.audio.sfx.clank();
      if (this.hp <= 0) {
        this.dead = true; this.remove = true; WL.audio.sfx.break(); g.shake(2, 0.1);
        g.fx.debris(this.x, this.y - 20, this.kind);
        this.contents.forEach((c, i) => setTimeout(() => g.spawnPickup(c, this.x + (i - (this.contents.length - 1) / 2) * 24, this.y, true), i * 60));
        g.player.addScore(50);
      }
    }
    update(dt) { this.t += dt; if (this.shakeT > 0) this.shakeT -= dt; }
    draw(ctx, camX) {
      const sx = Math.round(this.x - camX) + (this.shakeT > 0 ? Math.round(Math.sin(this.t * 80) * 2) : 0), sy = Math.round(this.y);
      WL.draw.shadow(ctx, sx, sy, 24, 6);
      S.drawObject(ctx, sx, sy, this.kind, this.hp, this.t);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Projectile                                                          */
  /* ------------------------------------------------------------------ */
  class Projectile {
    constructor(g, o) {
      this.g = g; Object.assign(this, { t: 0, life: 2, z: 30, vz: 0, dmg: 5, pierce: 0, hits: 0, dead: false, remove: false }, o);
      this.hitList = new Set();
    }
    update(dt) {
      this.t += dt;
      if (this.falling) {
        this.vz -= GRAV * 0.9 * dt; this.z += this.vz * dt;
        if (this.z <= 0) { this.land(); }
        return;
      }
      this.x += this.vx * dt;
      if (this.kind === 'sprinkle' || this.kind === 'toolbox') { this.vz -= 300 * dt; this.z += this.vz * dt; }
      if (this.z < 0) { this.z = 0; this.expire(); return; }
      if (this.t >= this.life) { this.expire(); return; }
      const p = this.g.player;
      if (this.owner === 'enemy') {
        if (Math.abs(p.x - this.x) < 16 && Math.abs(p.y - this.y) < 18 && Math.abs(p.z - this.z + 30) < 50) {
          if (p.hurt(this.dmg, this.x - Math.sign(this.vx) * 10, !!this.knockdown)) { this.g.fx.spark(p.x, p.y - 45); }
          this.remove = true;
        }
      } else {
        for (const e of this.g.enemies) {
          if (!e.hittable || this.hitList.has(e)) continue;
          if (Math.abs(e.x - this.x) < (e.isBoss ? 44 : 20) && Math.abs(e.y - this.y) < 24) {
            this.hitList.add(e); this.hits++;
            e.hurt(this.dmg, this.x - Math.sign(this.vx) * 10, { knockdown: this.knockdown, kb: 110 });
            this.g.fx.spark(e.x, e.y - 40, true); WL.audio.sfx.hit(true); p.registerHits(1);
            this.g.hitstop = 0.04;
            if (this.hits >= this.pierce) { this.expire(); return; }
          }
        }
        for (const ob of this.g.objects) if (!ob.dead && Math.abs(ob.x - this.x) < 26 && Math.abs(ob.y - this.y) < 30) { ob.hit(this.g, 3); }
      }
      // walls (camera bounds)
      if (this.x < this.g.camX - 20 || this.x > this.g.camX + WL.W + 20) this.expire();
    }
    expire() {
      this.remove = true;
      if (this.dropAsPickup) this.g.spawnPickup('toolbox', U.clamp(this.x, this.g.camX + 20, this.g.camX + WL.W - 20), this.y, true);
    }
    land() {
      this.remove = true;
      const p = this.g.player;
      this.g.fx.dust(this.x, this.y, 10); WL.audio.sfx.splat(); this.g.shake(1.5, 0.05);
      if (Math.abs(p.x - this.x) < 26 && Math.abs(p.y - this.y) < 20 && p.z < 30) { if (p.hurt(this.dmg, this.x, true)) this.g.fx.spark(p.x, p.y - 45, true); }
      for (const e of this.g.enemies) if (!e.isBoss && e.hittable && Math.abs(e.x - this.x) < 26 && Math.abs(e.y - this.y) < 20) e.hurt(8, this.x, { knockdown: true });
    }
    draw(ctx, camX) {
      const sx = Math.round(this.x - camX), sy = Math.round(this.y);
      if (this.falling) {
        // target marker + shadow grows as it approaches
        const k = U.clamp(1 - this.z / 400, 0.2, 1);
        ctx.save(); ctx.globalAlpha = 0.6; WL.draw.ellipse(ctx, sx, sy, 14 * k + 4, 5 * k + 1.5, 'rgba(0,0,0,0.45)'); ctx.restore();
        if (this.z > 330) return; // still off the top of the screen
      } else WL.draw.shadow(ctx, sx, sy, 8, 3);
      S.drawProjectile(ctx, sx, sy - this.z, this);
    }
  }

  WL.entities = { Player, Enemy, Boss, Pickup, Breakable, Projectile, ENEMY_DEFS, ATTACKS };
})();
