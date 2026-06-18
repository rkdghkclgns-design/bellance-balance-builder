/* ============================================================
   doctrine.js — 전투 밸런스 기조 계산 엔진
   · 기준(Baseline) = SR 등급 역할별 평균 × 계수 + 유물 보정치
   · 캡(Cap)        = SSR 등급 역할별 최고 유닛의 최대레벨·최대성급 스탯 + 유물 보정치
   · 스테이지/웨이브 기조 검증 (2분·보스 50%·3~5웨이브)
   데이터는 Builder.rows('UnitMaster' 등)에서 직접 읽어 즉시 반영.
   ============================================================ */
(function () {
  "use strict";

  function enumName(defTable, id) {
    const row = Builder.rows(defTable).find((r) => +r.Id === +id);
    return row ? row.EnumName : null;
  }
  function units() { return Builder.rows("UnitMaster"); }
  function avg(arr, f) { if (!arr.length) return 0; return arr.reduce((a, u) => a + (+f(u) || 0), 0) / arr.length; }

  // UnitMaster 컬럼 유연 해석(BaseMaxHp/BaseAttack 등 변형 대응)
  function uf(aliases) {
    const cols = (Builder.columns ? Builder.columns("UnitMaster") : []).map((c) => String(c.field));
    for (const a of aliases) { const h = cols.find((c) => c.toLowerCase() === a.toLowerCase()); if (h) return h; }
    for (const a of aliases) { if (a.length < 3) continue; const h = cols.find((c) => c.toLowerCase().includes(a.toLowerCase())); if (h) return h; }
    return null;
  }
  function ug(u, aliases) { const f = uf(aliases); return f != null ? u[f] : undefined; }
  const A_HP = ["BaseHp", "BaseMaxHp", "MaxHp", "Health"];
  const A_ATK = ["BaseAtk", "BaseAttack", "Attack", "Atk"];
  const A_DEF = ["BaseDef", "BaseDefence", "BaseDefense", "Defence", "Defense"];
  const isNum = (v) => v != null && v !== "" && /^-?\d+(\.\d+)?$/.test(String(v).trim());

  // 역할: Role 컬럼 우선, 없으면 Class로 추론
  function roleOf(u) {
    const raw = ug(u, ["Role"]);
    if (raw != null && raw !== "") {
      if (!isNum(raw)) return String(raw);
      const r = enumName("RoleDefine", raw); if (r) return r;
    }
    const cls = +ug(u, ["Class"]);
    const cname = (enumName("ClassDefine", cls) || "").toLowerCase();
    if (cls === 0 || /tank/.test(cname)) return "Defender";
    if (cls === 4 || /support|heal/.test(cname)) return "Support";
    return "Attacker";
  }
  // 등급: 임포트된 RarityDefine 우선, 없으면 3티어(0=R,1=SR,2=SSR) 보정
  function gradeOf(u) {
    const raw = ug(u, ["Rarity", "Grade"]);
    if (raw == null || raw === "") return null;
    if (!isNum(raw)) return String(raw).toUpperCase();
    if (Builder.isImported && Builder.isImported("RarityDefine")) {
      const g = enumName("RarityDefine", raw); if (g) return g;
    }
    return ({ 0: "R", 1: "SR", 2: "SSR", 3: "UR" })[+raw] || enumName("RarityDefine", raw);
  }
  function gradeCap(u, key) {
    const g = gradeOf(u); const gr = ((Data.state.doctrine.growth || {}).grades || {})[g];
    return gr ? gr[key] : null;
  }

  // 클래스별 레벨업 증가량
  function classDelta(classId) {
    const r = Builder.rows("LevelUPDeltaStatMaster").find((x) => +x.Class === +classId);
    return r ? { hp: +r.DeltaHp || 0, atk: +r.DeltaAtk || 0, def: +r.DeltaDef || 0 } : { hp: 0, atk: 0, def: 0 };
  }
  // 성급 배율(누적 복리) — Star <= maxStar 인 단계 모두 적용
  function starMults(maxStar) {
    let h = 1, a = 1, d = 1;
    Builder.rows("StarUpDeltaStatMaster").forEach((r) => {
      if (+r.Star <= +maxStar) {
        h *= 1 + (+r.HpPermille || 0) / 1000;
        a *= 1 + (+r.AtkPermille || 0) / 1000;
        d *= 1 + (+r.DefPermille || 0) / 1000;
      }
    });
    return { hp: h, atk: a, def: d };
  }
  // 유닛의 최대레벨·최대성급 스탯
  function statAtMax(u) {
    const d = classDelta(ug(u, ["Class"]));
    const maxLv = +ug(u, ["MaxLevel", "MaxLv"]) || gradeCap(u, "maxLevel") || 1;
    const maxStar = +ug(u, ["MaxStar"]) || gradeCap(u, "maxStar") || 0;
    const lv = Math.max(0, maxLv - 1);
    const sm = starMults(maxStar);
    return {
      hp: (+ug(u, A_HP) + d.hp * lv) * sm.hp,
      atk: (+ug(u, A_ATK) + d.atk * lv) * sm.atk,
      def: (+ug(u, A_DEF) + d.def * lv) * sm.def,
    };
  }
  // 유닛의 스킬 데미지 가중치(기본+스페셜 액티브 BaseDamageRatio 평균)
  function skillWeight(u) {
    const ratios = [];
    const pick = (tbl, id) => {
      const rs = Builder.rows(tbl); if (!rs.length || !+id) return;
      const s = rs.find((x) => +x.Id === +id); if (!s) return;
      const cols = Builder.columns(tbl).map((c) => c.field);
      const rf = cols.find((c) => /damageratio|ratio|damage|power/i.test(c));
      if (rf) ratios.push(+s[rf] || 0);
    };
    pick("BaseActiveSkillMaster", ug(u, ["BaseActiveSkillId"]));
    pick("SpecialActiveSkillMaster", ug(u, ["SpecialActiveSkillId"]));
    return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  }

  function byRoleGrade(role, grade) {
    return units().filter((u) => roleOf(u) === role && gradeOf(u) === grade);
  }
  function pickMax(list, statKey) {
    let best = null, val = -1;
    list.forEach((u) => { const s = statAtMax(u)[statKey]; if (s > val) { val = s; best = u; } });
    return best ? { unit: best, val: val } : null;
  }

  // ---- 기준(Baseline) -----------------------------------------
  function baselines() {
    const cfg = Data.state.doctrine;
    const ab = cfg.artifactBonus, f = cfg.baselineFactor, ref = cfg.refGrade;
    const att = byRoleGrade("Attacker", ref);
    const def = byRoleGrade("Defender", ref);
    const avgAtk = avg(att, (u) => ug(u, A_ATK));
    const avgDef = avg(def, (u) => ug(u, A_DEF));
    const avgHp = avg(def, (u) => ug(u, A_HP));
    const avgSkill = avg(att, (u) => skillWeight(u));
    return {
      ref: ref,
      atk: { avg: avgAtk, factor: f, bonus: +ab.atk || 0, value: avgAtk * f + (+ab.atk || 0), n: att.length },
      def: { avg: avgDef, factor: f, bonus: +ab.def || 0, value: avgDef * f + (+ab.def || 0), n: def.length },
      hp:  { avg: avgHp,  factor: f, bonus: +ab.hp || 0,  value: avgHp * f + (+ab.hp || 0),  n: def.length },
      skill: { avg: avgSkill, factor: cfg.skillFactor, value: avgSkill * cfg.skillFactor, n: att.length },
    };
  }

  // ---- 캡(Cap) ------------------------------------------------
  function caps() {
    const cfg = Data.state.doctrine, ab = cfg.artifactBonus, cap = cfg.capGrade;
    const att = byRoleGrade("Attacker", cap);
    const def = byRoleGrade("Defender", cap);
    const atkPick = pickMax(att, "atk");
    const defPick = pickMax(def, "def");
    const hpPick = pickMax(def, "hp");
    return {
      cap: cap,
      atk: atkPick ? { unit: atkPick.unit, value: atkPick.val + (+ab.atk || 0), bonus: +ab.atk || 0 } : null,
      def: defPick ? { unit: defPick.unit, value: defPick.val + (+ab.def || 0), bonus: +ab.def || 0 } : null,
      hp:  hpPick  ? { unit: hpPick.unit,  value: hpPick.val + (+ab.hp || 0),  bonus: +ab.hp || 0 }  : null,
      attCount: att.length, defCount: def.length,
    };
  }

  // ---- 스테이지/웨이브 기조 검증 ------------------------------
  function stageChecks() {
    const cfg = Data.state.doctrine;
    const sims = Combat.simAll();
    return sims.map((r, i) => {
      const stage = Data.state.stages[i];
      const waveCount = stage.waves.length;
      const total = r.sec;
      const last = r.waveTimes.length ? r.waveTimes[r.waveTimes.length - 1] : { sec: 0 };
      const bossSec = last.sec;
      const lastWave = stage.waves[stage.waves.length - 1];
      const lastIsBoss = !!(lastWave && lastWave.units.some((u) => u.boss));
      const bossShare = total > 0 ? (bossSec / total) * 100 : 0;

      const ck = (cond) => cond ? "ok" : "bad";
      const playCls = !r.cleared ? "bad" : (total >= cfg.play.min && total <= cfg.play.max ? (Math.abs(total - cfg.play.target) <= 20 ? "ok" : "warn") : "bad");
      const waveCls = ck(waveCount >= cfg.waves.min && waveCount <= cfg.waves.max);
      const bossExistCls = ck(lastIsBoss);
      const bossTimeCls = !lastIsBoss ? "bad" : ck(bossSec >= cfg.boss.min && bossSec <= cfg.boss.max);
      const bossShareCls = !lastIsBoss ? "bad" : (Math.abs(bossShare - cfg.boss.sharePct) <= 15 ? "ok" : (Math.abs(bossShare - cfg.boss.sharePct) <= 25 ? "warn" : "bad"));

      const flags = [playCls, waveCls, bossExistCls, bossTimeCls, bossShareCls];
      const pass = flags.every((c) => c === "ok");
      return {
        id: r.id, name: r.name, cleared: r.cleared, total: total, waveCount: waveCount,
        bossSec: bossSec, bossShare: bossShare, lastIsBoss: lastIsBoss,
        playCls, waveCls, bossExistCls, bossTimeCls, bossShareCls, pass,
      };
    });
  }

  window.Doctrine = { enumName, statAtMax, skillWeight, baselines, caps, stageChecks, byRoleGrade, roleOf, gradeOf,
    unitLabel: function (u) {
      if (!u) return "";
      const nm = ug(u, ["NameId", "Name", "KorName"]);
      const desc = ug(u, ["Desc", "Description"]);
      if (nm && !isNum(nm)) return nm;
      if (desc && !/\uFFFD|�/.test(String(desc)) && !isNum(desc)) return desc;
      return "Unit " + (u.Id != null ? u.Id : "");
    } };
})();
