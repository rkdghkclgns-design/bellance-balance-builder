/* ============================================================
   combat.js — 정밀 전투 시뮬: 틱/기본공격/스킬 쿨타임/버프·CC/원소상성
   결정적(무작위 없음) 시뮬레이션. dt=0.1s, 최대 240s 캡.
   ============================================================ */
(function () {
  "use strict";

  const DT = 0.1;
  // 안전 캡(초): 기조의 최대 플레이타임 + 60초 여유로 산출
  // (기본 180+60=240으로 기존 동작 유지, 기조 max를 바꾸면 시뮬 천장도 함께 추종)
  function simCap() {
    const pm = (window.Data && Data.state.doctrine && Data.state.doctrine.play && +Data.state.doctrine.play.max) || 180;
    return Math.max(60, pm) + 60;
  }

  // 방어 완화 계수
  function defFactor(def) { return 1000 / (1000 + Math.max(0, def)); }

  function effAtk(e) {
    let m = 1;
    e.buffs.forEach((b) => { if (b.stat === "atk") m *= b.mult; });
    return e.atk * m;
  }
  function effDef(e) {
    let m = 1;
    e.buffs.forEach((b) => { if (b.stat === "def") m *= b.mult; });
    return e.def * m;
  }

  function makeEntity(src, side) {
    return {
      name: src.name, side, element: src.element, line: src.line,
      maxHp: src.hp, hp: src.hp,
      atk: src.atk, def: src.def, atkInterval: src.atkInterval,
      atkTimer: src.atkInterval * 0.5, // 첫 타 살짝 빠르게
      skills: (src.skills || []).map((s) => {
        // 입력 보장: cd/ratio/dur/mult/stun이 누락·NaN이면 합리적 기본값으로 보정
        // (특히 cd가 NaN이면 cdTim-=DT가 영원히 0 이하로 안 떨어져 스킬이 조용히 미발동됨)
        const cd = (Number.isFinite(+s.cd) && +s.cd > 0) ? +s.cd : 8;
        const ratio = Number.isFinite(+s.ratio) ? +s.ratio : 0;
        const dur = Number.isFinite(+s.dur) ? +s.dur : 5;
        const mult = Number.isFinite(+s.mult) ? +s.mult : (s.type === "debuff" ? 0.8 : 1.3);
        const stun = Number.isFinite(+s.stun) ? +s.stun : (s.type === "cc" ? 1.2 : 0);
        return { ...s, cd, ratio, dur, mult, stun, cdTimer: Math.min(cd, 2.0) };
      }),
      buffs: [], stun: 0, alive: src.hp > 0 ? true : false,
      dmgDealt: 0,
    };
  }

  // 라인 우선순위: F → M → B
  const LINE_ORDER = { F: 0, M: 1, B: 2 };
  function pickTarget(enemies) {
    const alive = enemies.filter((e) => e.alive);
    if (!alive.length) return null;
    alive.sort((a, b) => (LINE_ORDER[a.line] ?? 1) - (LINE_ORDER[b.line] ?? 1));
    return alive[0];
  }

  function applyDamage(attacker, target, ratio) {
    const mult = Data.elementMult(attacker.element, target.element);
    const dmg = effAtk(attacker) * ratio * mult * defFactor(effDef(target));
    target.hp -= dmg;
    attacker.dmgDealt += dmg;
    if (target.hp <= 0) { target.hp = 0; target.alive = false; }
    return { dmg, mult };
  }

  function castSkill(caster, sk, allies, enemies) {
    const ev = { t: 0, name: sk.name, caster: caster.name, type: sk.type, targets: [] };
    if (sk.type === "damage") {
      let tgts = [];
      if (sk.scope === "all") tgts = enemies.filter((e) => e.alive);
      else if (sk.scope === "line") {
        const tt = pickTarget(enemies);
        if (tt) tgts = enemies.filter((e) => e.alive && e.line === tt.line);
      } else { const tt = pickTarget(enemies); if (tt) tgts = [tt]; }
      tgts.forEach((tt) => { const r = applyDamage(caster, tt, sk.ratio); ev.targets.push({ name: tt.name, dmg: r.dmg, mult: r.mult }); });
    } else if (sk.type === "buff") {
      let tgts = sk.scope === "self" ? [caster] : allies.filter((e) => e.alive);
      tgts.forEach((tt) => { tt.buffs.push({ stat: sk.stat, mult: sk.mult, dur: sk.dur }); ev.targets.push({ name: tt.name, stat: sk.stat, mult: sk.mult }); });
    } else if (sk.type === "debuff") {
      let tgts = sk.scope === "all" ? enemies.filter((e) => e.alive) : [pickTarget(enemies)].filter(Boolean);
      tgts.forEach((tt) => { tt.buffs.push({ stat: sk.stat, mult: sk.mult, dur: sk.dur }); ev.targets.push({ name: tt.name, stat: sk.stat, mult: sk.mult }); });
    } else if (sk.type === "cc") {
      let tgts = sk.scope === "all" ? enemies.filter((e) => e.alive) : [pickTarget(enemies)].filter(Boolean);
      tgts.forEach((tt) => { tt.stun = Math.max(tt.stun, sk.stun || 0); ev.targets.push({ name: tt.name, stun: sk.stun }); });
    }
    return ev;
  }

  function stepEntity(e, t, allies, enemies, events) {
    if (!e.alive) return;
    // 버프 만료
    e.buffs = e.buffs.filter((b) => (b.dur -= DT) > 0);
    if (e.stun > 0) { e.stun -= DT; if (e.stun < 0) e.stun = 0; return; }
    // 스킬(쿨타임)
    for (const sk of e.skills) {
      sk.cdTimer -= DT;
      if (sk.cdTimer <= 0) {
        const enemyAlive = enemies.some((x) => x.alive);
        if (!enemyAlive && (sk.type === "damage" || sk.type === "cc" || sk.type === "debuff")) { sk.cdTimer = 0; continue; }
        const ev = castSkill(e, sk, allies, enemies); ev.t = +t.toFixed(1);
        if (ev.targets.length) events.push(ev);
        sk.cdTimer = sk.cd;
      }
    }
    // 기본 공격
    e.atkTimer -= DT;
    if (e.atkTimer <= 0) {
      const tt = pickTarget(enemies);
      if (tt) { applyDamage(e, tt, 1.0); }
      e.atkTimer = e.atkInterval;
    }
  }

  // ---- 단일 스테이지 시뮬 ----
  function simStage(stage, teamSrc) {
    const CAP = simCap();
    const allies = teamSrc.map((u) => makeEntity(u, "ally"));
    const waveTimes = [];
    const events = [];
    let t = 0, cleared = true, wipedAt = null;

    for (let w = 0; w < stage.waves.length; w++) {
      const enemies = stage.waves[w].units.map((m) => makeEntity(m, "enemy"));
      const waveStart = t;
      let guard = 0;
      while (enemies.some((e) => e.alive) && allies.some((a) => a.alive)) {
        for (const a of allies) stepEntity(a, t, allies, enemies, events);
        for (const e of enemies) stepEntity(e, t, enemies, allies, events);
        t += DT; guard += DT;
        if (t > CAP || guard > CAP) break;
      }
      waveTimes.push({ wave: w + 1, sec: +(t - waveStart).toFixed(1), enemies: stage.waves[w].units.length });
      if (!allies.some((a) => a.alive)) { cleared = false; wipedAt = w + 1; break; }
      if (t > CAP) { cleared = false; break; }
    }

    const allyHpPct = allies.map((a) => ({ name: a.name, pct: Math.max(0, a.hp / a.maxHp) }));
    return {
      id: stage.id, name: stage.name,
      sec: +t.toFixed(1), waveTimes, cleared, wipedAt,
      allyHp: allyHpPct,
      topDamage: allies.map((a) => ({ name: a.name, dmg: Math.round(a.dmgDealt) })).sort((x, y) => y.dmg - x.dmg),
      events: events.slice(0, 60),
    };
  }

  function simAll() {
    const s = Data.state;
    return s.stages.map((st) => simStage(st, s.team));
  }

  window.Combat = { simStage, simAll, DT, simCap, get CAP() { return simCap(); } };
})();
