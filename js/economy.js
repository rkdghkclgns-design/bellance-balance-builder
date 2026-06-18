/* ============================================================
   economy.js — 육성 경제 시뮬: 비용 합산 · 일일 수급 · 6개월 역산
   ============================================================ */
(function () {
  "use strict";

  const RES = ["gold", "exp", "skillBook", "traitBook", "shard"];
  const RES_KOR = { gold: "골드", exp: "경험치", skillBook: "스킬북", traitBook: "특성북", shard: "성급재료" };

  // 스킬 레벨별 스킬북 요구치(구간 차등). 구버전 bookPerLv 데이터 호환.
  function bookAt(sk, lv) {
    if (sk.bookBase != null) return Math.round(sk.bookBase * Math.pow(lv - 1, sk.bookExp != null ? sk.bookExp : 1));
    return sk.bookPerLv || 0;
  }

  // 스킬 비용 합산(불러온 테이블 우선, 없으면 파라메트릭)
  function skillCostSum(k) {
    const c = Data.state.costs;
    const sc = c.skillCost && c.skillCost[k];
    const label = (c.skills[k] || {}).label || k;
    if (sc && sc.table && sc.table.length) {
      const max = sc.maxLevel || sc.table[sc.table.length - 1].lv;
      let g = 0, b = 0;
      sc.table.forEach((r) => { if (r.lv <= max) { g += r.gold; b += r.book; } });
      return { gold: g, book: b, maxLevel: max, label: label };
    }
    const sk = c.skills[k]; let g = 0, b = 0;
    for (let lv = 2; lv <= sk.maxLevel; lv++) { g += Math.round(sk.goldBase * Math.pow(lv, sk.goldExp)); b += bookAt(sk, lv); }
    return { gold: g, book: b, maxLevel: sk.maxLevel, label: label };
  }
  // 특성 비용 합산
  function traitCostSum() {
    const c = Data.state.costs;
    const tc = c.traitCost;
    if (tc && tc.table && tc.table.length) {
      const max = tc.maxLevel || tc.table[tc.table.length - 1].lv;
      let g = 0, b = 0; tc.table.forEach((r) => { if (r.lv <= max) { g += r.gold; b += r.book; } });
      return { gold: g, book: b, maxLevel: max };
    }
    let g = 0, b = 0; (c.trait || []).forEach((r) => { g += r.gold || 0; b += r.book || 0; });
    return { gold: g, book: b, maxLevel: (c.trait[c.trait.length - 1] || {}).lv || 0 };
  }

  // ---- 비용 합산 ------------------------------------------------
  function totalCost() {
    const s = Data.state;
    const c = s.costs;
    const out = { gold: 0, exp: 0, skillBook: 0, traitBook: 0, shard: 0 };
    const breakdown = [];

    // 1) 레벨업 (테이블 우선, 없으면 곡선)
    let lvGold = 0, lvExp = 0;
    if (c.levelTable && c.levelTable.length) {
      c.levelTable.forEach((r) => { if (r.lv >= 2 && r.lv <= s.unit.maxLevel) { lvGold += r.gold || 0; lvExp += r.exp || 0; } });
    } else {
      for (let lv = 2; lv <= s.unit.maxLevel; lv++) {
        lvGold += Math.round(c.level.goldBase * Math.pow(lv, c.level.goldExp));
        lvExp += Math.round(c.level.expBase * Math.pow(lv, c.level.expExp));
      }
    }
    out.gold += lvGold; out.exp += lvExp;
    breakdown.push({ phase: "레벨업", detail: `Lv.1→${s.unit.maxLevel}`, gold: lvGold, exp: lvExp, skillBook: 0, traitBook: 0, shard: 0 });

    // 2) 성급업 — 캐릭터 조각만 사용(골드 없음), 무의미 행(to<=from) 제외
    let stShard = 0;
    c.star.forEach((r) => { if (r.to > r.from) stShard += r.shard || 0; });
    out.shard += stShard;
    breakdown.push({ phase: "성급업", detail: `${s.unit.baseStar}★→${s.unit.maxStar}★`, gold: 0, exp: 0, skillBook: 0, traitBook: 0, shard: stShard });

    // 3) 스킬 3종 — 불러온 레벨업 비용 테이블(차등) 우선
    ["base", "special", "passive"].forEach((k) => {
      const r = skillCostSum(k);
      out.gold += r.gold; out.skillBook += r.book;
      breakdown.push({ phase: `스킬·${r.label}`, detail: `Lv.1→${r.maxLevel}`, gold: r.gold, exp: 0, skillBook: r.book, traitBook: 0, shard: 0 });
    });

    // 4) 특성
    const tr = traitCostSum();
    out.gold += tr.gold; out.traitBook += tr.book;
    breakdown.push({ phase: "특성(Trait)", detail: `Lv.1→${tr.maxLevel}`, gold: tr.gold, exp: 0, skillBook: 0, traitBook: tr.book, shard: 0 });

    return { totals: out, breakdown };
  }

  // ---- 구간별 차등 요구치 + 구간 최대까지 누적치 ----
  function stepDetail() {
    const s = Data.state, c = s.costs;
    // 레벨업: 레벨별 골드(차등) + 누적 (조각·경험치는 레벨업에 미사용/부가)
    const level = []; let cumG = 0, cumE = 0;
    for (let lv = 2; lv <= s.unit.maxLevel; lv++) {
      let g, e;
      if (c.levelTable && c.levelTable.length) { const r = c.levelTable.find((x) => x.lv === lv) || {}; g = r.gold || 0; e = r.exp || 0; }
      else { g = Math.round(c.level.goldBase * Math.pow(lv, c.level.goldExp)); e = Math.round(c.level.expBase * Math.pow(lv, c.level.expExp)); }
      cumG += g; cumE += e;
      level.push({ lv: lv, gold: g, cumGold: cumG, exp: e, cumExp: cumE });
    }
    // 성급업: 조각만(차등) + 누적 — 무의미한 행(to<=from) 제외
    const star = []; let cumS = 0;
    (c.star || []).forEach((r) => {
      if (!(r.to > r.from)) return;
      cumS += r.shard || 0; star.push({ from: r.from, to: r.to, shard: r.shard || 0, cumShard: cumS });
    });
    // 스킬북: 스킬별 레벨별 차등 + 누적 (불러온 비용 테이블 우선)
    const skills = ["base", "special", "passive"].map((k) => {
      const sc = c.skillCost && c.skillCost[k];
      const label = (c.skills[k] || {}).label || k;
      if (sc && sc.table && sc.table.length) {
        const max = sc.maxLevel || sc.table[sc.table.length - 1].lv;
        const rows = []; let cb = 0, cg = 0;
        sc.table.forEach((r) => { if (r.lv <= max) { cb += r.book; cg += r.gold; rows.push({ lv: r.lv, book: r.book, cumBook: cb, gold: r.gold, cumGold: cg }); } });
        return { key: k, label: label, rows: rows, totalBook: cb, totalGold: cg };
      }
      const sk = c.skills[k]; const rows = []; let cb = 0, cg = 0;
      for (let lv = 2; lv <= sk.maxLevel; lv++) {
        const b = bookAt(sk, lv); const g = Math.round(sk.goldBase * Math.pow(lv, sk.goldExp));
        cb += b; cg += g;
        rows.push({ lv: lv, book: b, cumBook: cb, gold: g, cumGold: cg });
      }
      return { key: k, label: label, rows: rows, totalBook: cb, totalGold: cg };
    });
    return { level: level, star: star, skills: skills,
      cum: { gold: cumG, shard: cumS, skillBook: skills.reduce((a, x) => a + x.totalBook, 0) } };
  }

  // ---- 일일 수급 ------------------------------------------------
  function dailyIncome() {
    const s = Data.state;
    const inc = s.income;
    if (inc.mode === "manual") {
      return { gold: +inc.manual.gold || 0, exp: +inc.manual.exp || 0, skillBook: +inc.manual.skillBook || 0, traitBook: +inc.manual.traitBook || 0, shard: +inc.manual.shard || 0 };
    }
    // auto: 던전 회차 × 드랍 + 스테이지 고정
    const a = inc.auto;
    const sum = { gold: 0, exp: 0, skillBook: 0, traitBook: 0, shard: 0 };
    a.dungeons.forEach((d) => {
      const runs = +a.runs[d.key] || 0;
      RES.forEach((r) => { sum[r] += (d[r] || 0) * runs; });
    });
    RES.forEach((r) => { sum[r] += (a.stageDaily[r] || 0); });
    return sum;
  }

  function staminaUsed() {
    const a = Data.state.income.auto;
    return a.dungeons.reduce((t, d) => t + (d.cost || 0) * (+a.runs[d.key] || 0), 0);
  }

  // ---- 6개월 역산 ----------------------------------------------
  function daysToMax() {
    const { totals, breakdown } = totalCost();
    const income = dailyIncome();
    const perRes = {};
    let bottleneck = null, maxDays = 0;
    RES.forEach((r) => {
      const need = totals[r];
      const rate = income[r];
      const d = need <= 0 ? 0 : rate <= 0 ? Infinity : need / rate;
      perRes[r] = { need, rate, days: d };
      if (d > maxDays && need > 0) { maxDays = d; bottleneck = r; }
    });
    return { totals, breakdown, income, perRes, days: maxDays, bottleneck };
  }

  // ---- 목표 판정(양방향 밴드: 육성 소요일용) -------------------
  function status(value, target, tol) {
    const lo = target - tol, hi = target + tol;
    if (value >= lo && value <= hi) return "ok";
    // 근접(±2배 tol 이내) → warn, 그 외 bad
    if (value >= target - tol * 2 && value <= target + tol * 2) return "warn";
    return "bad";
  }

  // ---- 전투 판정(방향성: '2분 이내'면 통과, 초과만 실패) -------
  function combatStatus(sec, target, tol, cleared) {
    if (cleared === false) return { cls: "bad", label: "전멸" };
    if (sec > target + tol) return { cls: "bad", label: "초과" };
    if (sec > target) return { cls: "warn", label: "근접" };
    if (sec < target * 0.30) return { cls: "warn", label: "너무빠름" };
    return { cls: "ok", label: "충족" };
  }

  // ---- 유저 체감 성장곡선 (전투력 vs 육성일) -------------------
  // 레벨업은 완만한 성장, 성급업은 계단형 점프 → '벽'이 보이는 곡선
  function growthCurve() {
    const s = Data.state, c = s.costs;
    const base = s.unit.base, per = s.unit.perLevel;
    const maxLv = s.unit.maxLevel;
    const income = dailyIncome();
    const POW = (st) => st.atk * 1 + st.def * 1.5 + st.hp * 0.08; // 전투력 환산
    const starFactor = (k) => Math.pow(1 + (s.unit.starMult || 250) / 1000, k);
    const totalStarSteps = Math.max(0, s.unit.maxStar - s.unit.baseStar);

    function levelCost(lv) {
      if (c.levelTable && c.levelTable.length) {
        const row = c.levelTable.find((r) => r.lv === lv);
        return row ? { gold: row.gold || 0, exp: row.exp || 0 } : { gold: 0, exp: 0 };
      }
      return { gold: Math.round(c.level.goldBase * Math.pow(lv, c.level.goldExp)),
               exp: Math.round(c.level.expBase * Math.pow(lv, c.level.expExp)) };
    }
    const starCosts = (c.star || []).slice();
    // 성급업을 레벨 구간에 균등 배치
    const starAtLevel = {};
    if (totalStarSteps > 0) {
      const steps = Math.min(totalStarSteps, starCosts.length || totalStarSteps);
      for (let i = 0; i < steps; i++) starAtLevel[Math.round(maxLv * ((i + 1) / (steps + 1)))] = i;
    }
    function statAt(lv, stars) {
      const f = starFactor(stars);
      return { atk: (base.atk + per.atk * (lv - 1)) * f, def: (base.def + per.def * (lv - 1)) * f, hp: (base.hp + per.hp * (lv - 1)) * f };
    }

    let cumGold = 0, cumExp = 0, cumShard = 0, starsApplied = 0;
    const dayOf = () => Math.max(
      income.gold > 0 ? cumGold / income.gold : 0,
      income.exp > 0 ? cumExp / income.exp : 0,
      income.shard > 0 ? cumShard / income.shard : 0
    );
    const samples = [{ day: 0, power: POW(statAt(1, 0)), level: 1, star: s.unit.baseStar, jump: false }];
    for (let lv = 2; lv <= maxLv; lv++) {
      const lc = levelCost(lv); cumGold += lc.gold; cumExp += lc.exp;
      let jump = false;
      if (starAtLevel[lv] != null && starsApplied < totalStarSteps) {
        const sc = starCosts[starsApplied] || {}; cumGold += sc.gold || 0; cumShard += sc.shard || 0; starsApplied++; jump = true;
      }
      samples.push({ day: dayOf(), power: POW(statAt(lv, starsApplied)), level: lv, star: s.unit.baseStar + starsApplied, jump });
    }
    while (starsApplied < totalStarSteps) {
      const sc = starCosts[starsApplied] || {}; cumGold += sc.gold || 0; cumShard += sc.shard || 0; starsApplied++;
      samples.push({ day: dayOf(), power: POW(statAt(maxLv, starsApplied)), level: maxLv, star: s.unit.baseStar + starsApplied, jump: true });
    }
    const p0 = samples[0].power, pN = samples[samples.length - 1].power;
    return { samples, minPower: p0, maxPower: pN, days: dayOf() };
  }

  window.Economy = {
    RES, RES_KOR, totalCost, dailyIncome, staminaUsed, daysToMax, status, combatStatus, growthCurve, stepDetail, bookAt,
  };
})();
