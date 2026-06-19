/* ============================================================
   data.js — 상태 모델 / 기본값 / 4-Row 헤더 CSV 파서
   ProjectA 밸런스 교정 빌더
   ============================================================ */
(function () {
  "use strict";

  // ---- 원소 상성표 (ElementalDefine 기반) ----------------------
  // 공격자 → 방어자 배수. 1.0 기본, 우세 1.30, 열세 0.77
  const ELEMENTS = ["Fire", "Water", "Wood", "Light", "Dark"];
  const EL_KOR = { Fire: "화", Water: "수", Wood: "목", Light: "광", Dark: "암" };
  // 화>목>수>화 순환, 광<>암 상호 우세
  const ELEMENT_CHART = {
    Fire:  { Wood: 1.30, Water: 0.77 },
    Water: { Fire: 1.30, Wood: 0.77 },
    Wood:  { Water: 1.30, Fire: 0.77 },
    Light: { Dark: 1.30 },
    Dark:  { Light: 1.30 },
  };

  function elementMult(atk, def) {
    if (!atk || !def) return 1.0;
    const row = ELEMENT_CHART[atk];
    if (row && row[def] != null) return row[def];
    return 1.0;
  }

  // ---- 성급(★) 조각 비용: 등급별 단계 수 (R 10 / SR 20 / SSR 30) · 인덱스 0 = ★0→★1 ----
  const STAR_SHARD_R  = [5, 8, 12, 18, 25, 35, 45, 60, 75, 95];
  const STAR_SHARD_SR = [10, 15, 20, 30, 40, 55, 70, 90, 115, 145, 180, 220, 270, 330, 400, 480, 575, 685, 815, 965];
  const STAR_SHARD_SSR = [20, 30, 45, 60, 80, 105, 135, 170, 210, 260, 320, 390, 470, 560, 670, 800, 950, 1120, 1320, 1550, 1820, 2130, 2490, 2900, 3370, 3910, 4530, 5240, 6050, 6980];

  // ---- 기본 상태 ------------------------------------------------
  const defaultState = {
    meta: {
      project: "ProjectA",
      note: "최고 레어도(SSR) 1기 기준 · 육성 6개월 / 전투 2분 교정",
    },

    targets: {
      maxDays: 180,    // 6개월
      daysTol: 25,     // ± 허용오차(일)
      clearSec: 120,   // 2분
      clearTol: 15,    // ± 허용오차(초)
    },

    // ---- 대상 유닛(최고 레어도 1기) ----
    unit: {
      name: "SSR_프로토",
      element: "Fire",
      rarity: "SSR",
      maxLevel: 60,
      baseStar: 0,     // 0성 시작
      maxStar: 30,     // 최대 성급 (SSR 기준 · 등급별 R10/SR20/SSR30)
      base: { hp: 9000, atk: 950, def: 380, atkInterval: 1.4 }, // 1레벨 기준
      perLevel: { hp: 220, atk: 26, def: 9 }, // LevelUPDeltaStat (ClassType 평균)
      starMult: 100,   // 성급당 스탯 배수(Permille) → +10%/성급 (30단계 기준)
    },

    // ---- 비용 곡선(파라미터형, CSV로 덮어쓰기 가능) ----
    costs: {
      // gold(lv)=round(goldBase * lv^goldExp), exp 동일 패턴
      level: { goldBase: 40, goldExp: 2.0, expBase: 70, expExp: 2.0 },
      // 성급업: 캐릭터 조각만 사용(골드 0) · 0★→30★ 성급별 차등(조각 점증, SSR 기준)
      star: STAR_SHARD_SSR.map(function (sh, i) { return { from: i, to: i + 1, gold: 0, shard: sh }; }),
      // 스킬 3종: 1→max, gold=goldBase*lv^exp, 스킬북=bookBase*(lv-1)^bookExp (구간별 차등)
      skills: {
        base:    { label: "기본 액티브", maxLevel: 10, goldBase: 4000, goldExp: 2.0, bookBase: 4, bookExp: 1.35 },
        special: { label: "스페셜 액티브", maxLevel: 10, goldBase: 5000, goldExp: 2.0, bookBase: 6, bookExp: 1.35 },
        passive: { label: "패시브", maxLevel: 10, goldBase: 2500, goldExp: 2.0, bookBase: 3, bookExp: 1.35 },
      },
      // 특성: 명시 테이블 (1→5)
      trait: [
        { lv: 2, gold: 120000, book: 8 },
        { lv: 3, gold: 240000, book: 14 },
        { lv: 4, gold: 420000, book: 22 },
        { lv: 5, gold: 720000, book: 34 },
      ],
    },

    // ---- 일일 수급 ----
    income: {
      mode: "auto", // 'auto' | 'manual'
      adMultiplier: 2, // 자동사냥·스테이지 클리어 보상 광고 시청 시 배수
      manual: { gold: 53000, exp: 30000, skillBook: 4.3, traitBook: 0.78, shard: 1.0 },
      // auto: 스태미나 → 던전 회차 → 드랍
      auto: {
        staminaPerDay: 260,   // 일일 회복+자연
        dungeons: [
          { key: "gold",  label: "골드 던전",   cost: 12, gold: 7000, exp: 0,    skillBook: 0, traitBook: 0, shard: 0 },
          { key: "exp",   label: "경험치 던전", cost: 12, gold: 0,    exp: 4800, skillBook: 0, traitBook: 0, shard: 0 },
          { key: "mat",   label: "재료 던전",   cost: 16, gold: 800,  exp: 0,    skillBook: 1.0, traitBook: 0.18, shard: 0 },
          { key: "star",  label: "성급 던전",   cost: 20, gold: 0,    exp: 0,    skillBook: 0, traitBook: 0, shard: 0.45 },
        ],
        // 스태미나 배분(회차/일) — 합이 stamina 한도 내
        runs: { gold: 6, exp: 6, mat: 4, star: 2 },
        // 스테이지 클리어 일일 보상(고정)
        stageDaily: { gold: 8000, exp: 1400, skillBook: 0.3, traitBook: 0.06, shard: 0.1 },
      },
    },

    // ---- 전투: 아군 팀 (탱커만 전열 → 어그로 소화, 딜러는 풀DPS 유지) ----
    team: [
      mkUnit("아군_탱커",  "Wood",  "F", 700,  80000, 900, 1.6, [sk("도발", 9, 0.0, "all", "cc", { stun: 1.4 }), sk("철벽", 14, 0, "self", "buff", { stat: "def", mult: 1.4, dur: 6 })]),
      mkUnit("아군_딜러A", "Fire",  "M", 4250, 40000, 300, 1.2, [sk("강타", 6, 3.4, "single", "damage"), sk("화염난무", 12, 2.2, "all", "damage")]),
      mkUnit("아군_딜러B", "Water", "M", 3900, 38000, 280, 1.3, [sk("관통사격", 7, 3.0, "single", "damage")]),
      mkUnit("아군_버퍼",  "Light", "B", 2600, 32000, 240, 1.4, [sk("공명", 10, 0, "ally", "buff", { stat: "atk", mult: 1.25, dur: 8 })]),
      mkUnit("아군_서브",  "Dark",  "B", 3400, 34000, 260, 1.25, [sk("암격", 8, 2.8, "single", "damage")]),
    ],

    // ---- 전투: 스테이지(웨이브×라인) ----
    stages: [
      mkStage("1-5", "초반 검증", [
        wave([mon("잡몹F", "Wood", "F", 120000, 520, 360, 1.5), mon("잡몹M", "Wood", "M", 100000, 480, 340, 1.6)]),
        wave([mon("정예", "Wood", "F", 320000, 760, 520, 1.7)]),
      ]),
      mkStage("3-10", "중반 검증", [
        wave([mon("전열A", "Water", "F", 180000, 700, 480, 1.5), mon("전열B", "Water", "F", 180000, 700, 480, 1.5)]),
        wave([mon("중열", "Water", "M", 170000, 820, 420, 1.4), mon("후열", "Water", "B", 150000, 900, 360, 1.3)]),
        wave([mon("정예수호", "Water", "F", 330000, 980, 560, 1.6)]),
      ]),
      mkStage("6-20", "보스 검증", [
        wave([mon("호위A", "Fire", "F", 240000, 900, 520, 1.4), mon("호위B", "Fire", "F", 240000, 900, 520, 1.4)]),
        wave([mon("BOSS·화룡", "Fire", "M", 900000, 1250, 540, 1.5,
          [sk("브레스", 10, 2.0, "all", "damage"), sk("위압", 13, 0, "all", "debuff", { stat: "atk", mult: 0.85, dur: 5 })], true)]),
      ]),
      mkStage("9-15", "고난도 검증", [
        wave([mon("정예전위", "Dark", "F", 360000, 1100, 600, 1.4)]),
        wave([mon("BOSS·암군주", "Dark", "M", 1150000, 1480, 660, 1.5,
          [sk("심연", 9, 2.2, "all", "damage"), sk("공포", 12, 0, "all", "cc", { stun: 1.0 })], true)]),
      ]),
    ],

    // ---- 유닛 설계 시스템 ----------------------------------------
    unitDesign: {
      // 등급별 최대 레벨 & 기준 스탯 배율
      grades: {
        R:   { maxLevel: 50,  baseMult: 1.000, maxStar: 10 },
        SR:  { maxLevel: 70,  baseMult: 1.100, maxStar: 20 }, // R × 1.10
        SSR: { maxLevel: 100, baseMult: 1.265, maxStar: 30 }, // SR × 1.15 = R × 1.265
      },
      // 성급강화 시스템 (HP·ATK·DEF 복리 증가)
      starSystem: {
        maxSteps: 30,       // 최대 강화 단계(최댓값 · 실제 상한은 등급별 grades[*].maxStar)
        multPerStep: 0.10,  // 단계당 +10% 복리
        // 등급별 단계별 조각 필요량 (인덱스 0 = ★0→★1) · R10 / SR20 / SSR30
        shardCosts: { R: STAR_SHARD_R, SR: STAR_SHARD_SR, SSR: STAR_SHARD_SSR },
      },
      // Lv1 · R등급 · 역할보정 전 기준값
      baseRef:     { hp: 5000, atk: 500, def: 200 },
      // 레벨당 성장 (등급 무관 동일)
      perLevelRef: { hp: 150,  atk: 15,  def: 6   },
      // 역할 4종 (1 방어형 · 2 공격형 · 3 지원형 · 4 회복형) · 사용자 직접 설정 가능
      roles: {
        defender: { label: "방어형", hpMult: 1.35, atkMult: 0.65, defMult: 1.30 },
        attacker: { label: "공격형", hpMult: 0.85, atkMult: 1.40, defMult: 0.80 },
        support:  { label: "지원형", hpMult: 1.05, atkMult: 0.85, defMult: 1.05 },
        healer:   { label: "회복형", hpMult: 1.10, atkMult: 0.75, defMult: 1.00 },
      },
      // 유닛 명부 (offset=개인 보정, spd=개별 SPD 성장, fixed=고정 스탯)
      units: [
        { id:"u001", name:"철벽수호자", grade:"SSR", role:"defender",
          offset:{hp:200,  atk:-50,  def:100 }, spd:{base:85,  perLevel:0.10},
          fixed:{critRate:5,  critDmg:150, defPen:0,  critRes:25} },
        { id:"u002", name:"폭풍검사",   grade:"SSR", role:"attacker",
          offset:{hp:150,  atk:80,   def:-30 }, spd:{base:112, perLevel:0.20},
          fixed:{critRate:20, critDmg:200, defPen:10, critRes:5 } },
        { id:"u003", name:"섬광마법사", grade:"SSR", role:"support",
          offset:{hp:100,  atk:100,  def:-50 }, spd:{base:105, perLevel:0.18},
          fixed:{critRate:25, critDmg:220, defPen:20, critRes:5 } },
        { id:"u004", name:"달빛치유사", grade:"SSR", role:"healer",
          offset:{hp:250,  atk:-100, def:80  }, spd:{base:98,  perLevel:0.15},
          fixed:{critRate:10, critDmg:150, defPen:0,  critRes:15} },
        { id:"u005", name:"어둠암살자", grade:"SSR", role:"attacker",
          offset:{hp:50,   atk:120,  def:-80 }, spd:{base:130, perLevel:0.25},
          fixed:{critRate:35, critDmg:250, defPen:30, critRes:0 } },
        { id:"u006", name:"대지방패",   grade:"SR",  role:"defender",
          offset:{hp:180,  atk:-40,  def:90  }, spd:{base:82,  perLevel:0.08},
          fixed:{critRate:5,  critDmg:150, defPen:0,  critRes:20} },
        { id:"u007", name:"화염전사",   grade:"SR",  role:"attacker",
          offset:{hp:120,  atk:60,   def:-20 }, spd:{base:108, perLevel:0.17},
          fixed:{critRate:18, critDmg:190, defPen:8,  critRes:5 } },
        { id:"u008", name:"바람궁수",   grade:"SR",  role:"attacker",
          offset:{hp:80,   atk:90,   def:-60 }, spd:{base:125, perLevel:0.22},
          fixed:{critRate:30, critDmg:230, defPen:25, critRes:0 } },
        { id:"u009", name:"견습기사",   grade:"R",   role:"defender",
          offset:{hp:160,  atk:-30,  def:70  }, spd:{base:80,  perLevel:0.06},
          fixed:{critRate:5,  critDmg:150, defPen:0,  critRes:15} },
        { id:"u010", name:"신참궁수",   grade:"R",   role:"attacker",
          offset:{hp:100,  atk:50,   def:-15 }, spd:{base:102, perLevel:0.15},
          fixed:{critRate:15, critDmg:180, defPen:5,  critRes:5 } },
      ],
      simUnit:  "u001",
      simLevel: 1,
      simStar:  0,
    },

    // ---- 전투 밸런스 기조(도트린) ----------------------------
    doctrine: {
      baselineFactor: 0.7,   // SR 등급 평균 × 0.7 = 기준
      skillFactor: 0.5,      // SR 공격형 평균 스킬 가중치 × 0.5 = 스킬 기준
      play: { min: 60, target: 120, max: 180 },   // 스테이지 플레이타임(초)
      boss: { sharePct: 50, min: 30, max: 90 },    // 보스전 비중(%)·최소/최대(초)
      waves: { min: 3, max: 5 },                   // 웨이브 수
      stagesPerChapter: 10,                        // 1챕터 = 10스테이지
      artifactBonus: { atk: 0, def: 0, hp: 0 },    // 유물 최대강화/성급 보정치(평탄)
      // ---- 성장 밸런스 기조 ----
      growth: {
        grades: {
          R:   { maxLevel: 50,  maxStar: 10, mileagePerShard: 10 },
          SR:  { maxLevel: 70,  maxStar: 20, mileagePerShard: 20 },
          SSR: { maxLevel: 100, maxStar: 30, mileagePerShard: 35 },
        },
        ssrMonths: 6,        // SSR 1기 최대레벨·최대성급 = 6개월
        partySize: 5,        // 파티 5인 → 30개월
        goldPerMin: 100,     // 1분에 골드 100
        minutesPerDay: 120,  // 일일 플레이(가정) — 시간↔일 환산용
      },
      refGrade: "SR", capGrade: "SSR",
    },

    // 원시 마스터 데이터(CSV 임포트 보관용)
    rawTables: {},
  };

  // ---- 헬퍼 ----
  function sk(name, cd, ratio, scope, type, extra) {
    return Object.assign({ name, cd, ratio, scope, type }, extra || {});
  }
  function mkUnit(name, element, line, atk, hp, def, atkInterval, skills) {
    return { name, element, line, atk, hp: hp || atkToHp(atk), def, atkInterval, skills: skills || [] };
  }
  function atkToHp(atk) { return Math.round(atk * 4.2 + 6000); }
  function mon(name, element, line, hp, atk, def, atkInterval, skills, boss) {
    return { name, element, line, hp, atk, def, atkInterval, skills: skills || [], boss: !!boss };
  }
  function wave(units) { return { units }; }
  function mkStage(id, name, waves) { return { id, name, waves }; }

  // ============================================================
  // 4-Row 헤더 CSV 파서
  // Row1=타입, Row2=스코프, Row3=필드명(PascalCase), Row4+=데이터
  // ============================================================
  function parseCSV(text, opts) {
    const rows = splitCSV(text);
    if (rows.length < 4) return { error: "행이 4개 미만입니다 (4-Row 헤더 필요)" };
    const types = rows[0];
    const scopes = rows[1];
    const fields = rows[2];
    const raw = !!(opts && opts.raw);
    const dataRows = rows.slice(3).filter((r) => r.some((c) => String(c).trim() !== ""));
    const records = dataRows.map((r) => {
      const o = {};
      fields.forEach((f, i) => {
        o[f] = raw ? (r[i] == null ? "" : String(r[i])) : castValue(r[i], types[i]);
      });
      return o;
    });
    return { fields, types, scopes, records };
  }

  function castValue(v, type) {
    if (v == null) return null;
    const s = String(v).trim();
    const t = (type || "").toLowerCase();
    if (t.startsWith("int")) return s === "" ? 0 : parseInt(s, 10);
    if (t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal"))
      return s === "" ? 0 : parseFloat(s);
    if (t.startsWith("bool")) return s === "1" || s.toLowerCase() === "true";
    if (t.startsWith("list")) return s === "" ? [] : s.split(/[|;]/).map((x) => x.trim());
    return s;
  }

  // RFC-ish CSV → rows of cells (quotes, commas, CRLF 지원)
  function splitCSV(text) {
    const rows = [];
    let row = [], cur = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { row.push(cur); cur = ""; }
        else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (c === "\r") { /* skip */ }
        else cur += c;
      }
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  // ============================================================
  // CSV 원본 보관 — 시뮬/상태 매핑은 Builder.importCSV → syncAll 단일 경로가 담당
  // (과거 이 함수가 별도로 컬럼을 매핑하던 분기는 syncAll과 규칙이 갈라져
  //  실제 CSV의 Cost/BaseMaxHp 등 컬럼에서 빗나갔으므로 제거하고 일원화함)
  // ============================================================
  function ingestCSV(filename, parsed) {
    const name = filename.replace(/\.csv$/i, "");
    Data.state.rawTables[name] = parsed;   // [마스터 데이터] 탭의 원본 표시용으로만 보관
    return null;
  }

  function exportCSV(parsed) {
    if (!parsed) return "";
    const esc = (v) => {
      const s = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [];
    lines.push(parsed.types.map(esc).join(","));
    lines.push(parsed.scopes.map(esc).join(","));
    lines.push(parsed.fields.map(esc).join(","));
    parsed.records.forEach((rec) => {
      lines.push(parsed.fields.map((fld) => esc(rec[fld])).join(","));
    });
    return lines.join("\n");
  }

  // 깊은 복제(기본값 리셋용)
  const _pristine = JSON.parse(JSON.stringify(defaultState));

  // ============================================================
  // 영속 계층 — localStorage(동기 1차) + IndexedDB(비동기 백업/오버플로)
  // 엔터프라이즈: 저장 실패 비파괴 감지 + 대용량 백업 + 이벤트 통지
  // ============================================================
  const LS_KEY = "pa_balance_state";
  const IDB_DB = "pa_balance", IDB_STORE = "state";
  function idbOpen() {
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open(IDB_DB, 1);
        r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  async function idbPut(obj) {
    try {
      const db = await idbOpen();
      await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(JSON.stringify(obj), "current");
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      db.close();
    } catch (e) { /* 백업 실패는 무음(1차 저장이 우선) */ }
  }
  async function idbGet() {
    try {
      const db = await idbOpen();
      const v = await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const g = tx.objectStore(IDB_STORE).get("current");
        g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error);
      });
      db.close();
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function migrate(loaded) {
    if (!loaded.unitDesign) loaded.unitDesign = JSON.parse(JSON.stringify(_pristine.unitDesign));
    if (!loaded.doctrine) loaded.doctrine = JSON.parse(JSON.stringify(_pristine.doctrine));
    if (loaded.doctrine && !loaded.doctrine.growth) loaded.doctrine.growth = JSON.parse(JSON.stringify(_pristine.doctrine.growth));
    if (loaded.income && loaded.income.adMultiplier == null) loaded.income.adMultiplier = 2;
    // 역할 4종(방어형/공격형/지원형/회복형)으로 교체 + 구 역할키 매핑
    if (loaded.unitDesign && loaded.unitDesign.roles &&
        (loaded.unitDesign.roles.tank || loaded.unitDesign.roles.mage || loaded.unitDesign.roles.assassin)) {
      loaded.unitDesign.roles = JSON.parse(JSON.stringify(_pristine.unitDesign.roles));
      const RMAP = { tank: "defender", mage: "support", assassin: "attacker", support: "healer", attacker: "attacker", defender: "defender", healer: "healer" };
      (loaded.unitDesign.units || []).forEach(function (u) { u.role = RMAP[u.role] || "attacker"; });
    }
    // 성급 배율: 구버전 +25%/단계(250)는 30단계에서 과도 → +10%/단계(100)
    if (loaded.unit && +loaded.unit.starMult === 250) loaded.unit.starMult = 100;
    // 성급강화 시스템: 구버전 10단계 → 등급별(최대 30) 조각표로 보강
    if (loaded.unitDesign && loaded.unitDesign.starSystem && (+loaded.unitDesign.starSystem.maxSteps || 0) < 30) {
      loaded.unitDesign.starSystem.maxSteps = 30;
      loaded.unitDesign.starSystem.shardCosts = JSON.parse(JSON.stringify(_pristine.unitDesign.starSystem.shardCosts));
    }
    if (loaded.unitDesign && loaded.unitDesign.grades) {
      ["R", "SR", "SSR"].forEach((g) => {
        if (loaded.unitDesign.grades[g] && loaded.unitDesign.grades[g].maxStar == null)
          loaded.unitDesign.grades[g].maxStar = _pristine.unitDesign.grades[g].maxStar;
      });
    }
    if (loaded.costs) {
      if (Array.isArray(loaded.costs.star)) loaded.costs.star.forEach((r) => { r.gold = 0; });
      if (loaded.costs.skills) ["base", "special", "passive"].forEach((k) => {
        const sk = loaded.costs.skills[k], ps = _pristine.costs.skills[k];
        if (sk && ps && sk.bookBase == null) { sk.bookBase = ps.bookBase; sk.bookExp = ps.bookExp; }
      });
    }
    return loaded;
  }

  window.Data = {
    state: JSON.parse(JSON.stringify(defaultState)),
    ELEMENTS, EL_KOR, ELEMENT_CHART, elementMult,
    STAR_SHARD_SSR,
    parseCSV, ingestCSV, exportCSV,
    lastSaveError: null, storageMode: "localStorage",
    reset() { window.Data.state = JSON.parse(JSON.stringify(_pristine)); },
    save() {
      let lsOk = true;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(window.Data.state));
        window.Data.lastSaveError = null;
      } catch (e) {
        lsOk = false; window.Data.lastSaveError = e; window.Data.storageMode = "indexeddb";
        try { window.dispatchEvent(new CustomEvent("pa-save-error", { detail: { message: e && e.message, name: e && e.name } })); } catch (_) {}
      }
      // 항상 IndexedDB에 백업(대용량/유실 대비, 비동기 fire-and-forget)
      idbPut(window.Data.state);
      return lsOk;
    },
    // 비동기 복구: localStorage가 비었을 때 IndexedDB 백업에서 복원
    async restoreFromBackup() {
      const b = await idbGet();
      if (b) { window.Data.state = migrate(b); return true; }
      return false;
    },
    load() {
      try {
        const s = localStorage.getItem(LS_KEY);
        if (s) { window.Data.state = migrate(JSON.parse(s)); return true; }
      } catch (e) { window.Data.lastSaveError = e; }
      return false;
    },
  };
})();
