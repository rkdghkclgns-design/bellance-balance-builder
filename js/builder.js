/* ============================================================
   builder.js — 마스터/Define 데이터 보관 · CRUD · 4-Row CSV/ZIP/JSON 내보내기
                · 시뮬 동기화(즉시 반영)
   데이터는 Data.state.builderData = { TableName: [row,...] } 에 보관(영속).
   ============================================================ */
(function () {
  "use strict";
  const S = window.Schema;
  // 성급 조각 비용(SSR 30단계) — data.js의 배열을 재사용(중복 방지), 미로드 시 폴백
  const SSR_SHARD = (window.Data && Data.STAR_SHARD_SSR) ? Data.STAR_SHARD_SSR
    : [20, 30, 45, 60, 80, 105, 135, 170, 210, 260, 320, 390, 470, 560, 670, 800, 950, 1120, 1320, 1550, 1820, 2130, 2490, 2900, 3370, 3910, 4530, 5240, 6050, 6980];

  // ---- 시드 (Define enum 전체 + 마스터 예시) -------------------
  function r(o) { return o; }
  const seeds = {
    ElementalDefine: [
      {Id:0,EnumName:"Fire",KorName:"화"},{Id:1,EnumName:"Water",KorName:"수"},
      {Id:2,EnumName:"Wood",KorName:"목"},{Id:3,EnumName:"Light",KorName:"광"},{Id:4,EnumName:"Dark",KorName:"암"},
    ],
    RarityDefine: [
      {Id:0,EnumName:"N",KorName:"노멀",StarCount:1},{Id:1,EnumName:"R",KorName:"레어",StarCount:2},
      {Id:2,EnumName:"SR",KorName:"슈퍼레어",StarCount:3},{Id:3,EnumName:"SSR",KorName:"SSR",StarCount:4},
      {Id:4,EnumName:"UR",KorName:"울트라레어",StarCount:5},
    ],
    ClassDefine: [
      {Id:0,EnumName:"Tanker",KorName:"탱커"},{Id:1,EnumName:"Warrior",KorName:"전사"},
      {Id:2,EnumName:"Mage",KorName:"마법사"},{Id:3,EnumName:"Archer",KorName:"궁수"},
      {Id:4,EnumName:"Support",KorName:"서포터"},{Id:5,EnumName:"Assassin",KorName:"암살자"},
    ],
    RoleDefine: [
      {Id:0,EnumName:"Attacker",KorName:"공격형"},{Id:1,EnumName:"Defender",KorName:"방어형"},
      {Id:2,EnumName:"Support",KorName:"지원형"},{Id:3,EnumName:"Healer",KorName:"회복형"},
    ],
    BattleLineDefine: [
      {Id:0,EnumName:"Front",KorName:"전열"},{Id:1,EnumName:"Middle",KorName:"중열"},{Id:2,EnumName:"Back",KorName:"후열"},
    ],
    SizeTypeDefine: [
      {Id:0,EnumName:"Small",KorName:"소형"},{Id:1,EnumName:"Medium",KorName:"중형"},
      {Id:2,EnumName:"Large",KorName:"대형"},{Id:3,EnumName:"Boss",KorName:"보스"},
    ],
    SkillTypeDefine: [
      {Id:0,EnumName:"Damage",KorName:"데미지"},{Id:1,EnumName:"Heal",KorName:"회복"},
      {Id:2,EnumName:"Buff",KorName:"버프"},{Id:3,EnumName:"Debuff",KorName:"디버프"},
      {Id:4,EnumName:"CrowdControl",KorName:"군중제어"},{Id:5,EnumName:"Summon",KorName:"소환"},
    ],
    ExecuteLocationDefine: [
      {Id:0,EnumName:"Melee",KorName:"근접"},{Id:1,EnumName:"Ranged",KorName:"원거리"},
      {Id:2,EnumName:"Self",KorName:"자신"},{Id:3,EnumName:"Global",KorName:"전역"},
    ],
    TargetTypeDefine: [
      {Id:0,EnumName:"Enemy",KorName:"적"},{Id:1,EnumName:"Ally",KorName:"아군"},
      {Id:2,EnumName:"Self",KorName:"자신"},{Id:3,EnumName:"AllEnemy",KorName:"적 전체"},{Id:4,EnumName:"AllAlly",KorName:"아군 전체"},
    ],
    ScopeDefine: [
      {Id:0,EnumName:"Single",KorName:"단일"},{Id:1,EnumName:"Line",KorName:"라인"},
      {Id:2,EnumName:"All",KorName:"전체"},{Id:3,EnumName:"Random",KorName:"랜덤"},{Id:4,EnumName:"Area",KorName:"광역"},
    ],
    BuffDebuffTypeDefine: [
      {Id:0,EnumName:"AtkUp",KorName:"공격 증가",IsPositive:true},{Id:1,EnumName:"DefUp",KorName:"방어 증가",IsPositive:true},
      {Id:2,EnumName:"Shield",KorName:"보호막",IsPositive:true},{Id:3,EnumName:"AtkDown",KorName:"공격 감소",IsPositive:false},
      {Id:4,EnumName:"DefDown",KorName:"방어 감소",IsPositive:false},{Id:5,EnumName:"DamageOverTime",KorName:"지속 피해",IsPositive:false},
    ],
    StatusEffectTypeDefine: [
      {Id:0,EnumName:"Hp",KorName:"HP"},{Id:1,EnumName:"Atk",KorName:"공격력"},{Id:2,EnumName:"Def",KorName:"방어력"},
      {Id:3,EnumName:"Spd",KorName:"속도"},{Id:4,EnumName:"CritRate",KorName:"치명타율"},{Id:5,EnumName:"CritDmg",KorName:"치명타 피해"},
      {Id:6,EnumName:"DefPen",KorName:"방어 관통"},{Id:7,EnumName:"CritRes",KorName:"치명 저항"},
    ],
    AbnormalTypeDefine: [
      {Id:0,EnumName:"Stun",KorName:"기절"},{Id:1,EnumName:"Silence",KorName:"침묵"},{Id:2,EnumName:"Freeze",KorName:"빙결"},
      {Id:3,EnumName:"Taunt",KorName:"도발"},{Id:4,EnumName:"Sleep",KorName:"수면"},{Id:5,EnumName:"Knockback",KorName:"넉백"},
    ],
    PassiveTriggerTypeDefine: [
      {Id:0,EnumName:"OnBattleStart",KorName:"전투 시작"},{Id:1,EnumName:"OnAttack",KorName:"공격 시"},
      {Id:2,EnumName:"OnHit",KorName:"피격 시"},{Id:3,EnumName:"OnKill",KorName:"처치 시"},
      {Id:4,EnumName:"OnHpBelow",KorName:"체력 이하"},{Id:5,EnumName:"EveryTurn",KorName:"매 턴"},
    ],
    ConditionTypeDefine: [
      {Id:0,EnumName:"HpPercent",KorName:"체력 비율"},{Id:1,EnumName:"EnemyCount",KorName:"적군 수"},
      {Id:2,EnumName:"AllyBuffCount",KorName:"아군 버프 수"},{Id:3,EnumName:"Always",KorName:"항상"},
    ],
    ComparisonTypeDefine: [
      {Id:0,EnumName:"GreaterThan",Symbol:">"},{Id:1,EnumName:"LessThan",Symbol:"<"},{Id:2,EnumName:"Equal",Symbol:"="},
      {Id:3,EnumName:"GreaterEqual",Symbol:">="},{Id:4,EnumName:"LessEqual",Symbol:"<="},
    ],
    TraitTypeDefine: [
      {Id:0,EnumName:"StatBoost",KorName:"스탯 강화"},{Id:1,EnumName:"SkillEnhance",KorName:"스킬 강화"},
      {Id:2,EnumName:"ElementalMastery",KorName:"속성 특화"},{Id:3,EnumName:"Survival",KorName:"생존"},
    ],
    ArtifactTargetDefine: [
      {Id:0,EnumName:"Self",KorName:"자신"},{Id:1,EnumName:"Team",KorName:"팀 전체"},
      {Id:2,EnumName:"SameElement",KorName:"동일 속성"},{Id:3,EnumName:"SameClass",KorName:"동일 클래스"},
    ],
    GuideQuestTypeDefine: [
      {Id:0,EnumName:"Tutorial",KorName:"튜토리얼"},{Id:1,EnumName:"Daily",KorName:"일일"},
      {Id:2,EnumName:"Growth",KorName:"성장"},{Id:3,EnumName:"Achievement",KorName:"업적"},
    ],
    MonsterTypeDefine: [
      {Id:0,EnumName:"Normal",KorName:"일반"},{Id:1,EnumName:"Elite",KorName:"정예"},
      {Id:2,EnumName:"Boss",KorName:"보스"},{Id:3,EnumName:"MiniBoss",KorName:"중간보스"},
    ],

    // ---- 마스터 예시(시뮬 연동 + 참고용) --------------------
    UnitMaster: [
      {Id:1001,NameId:"SSR_프로토",Elemental:0,Rarity:3,Class:1,Role:0,BattleLine:1,
       BaseHp:9000,BaseAtk:950,BaseDef:380,AtkSpeed:1.4,MaxLevel:60,BaseStar:4,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:5001,PassiveSkillId:6001,TraitId:7001},
      {Id:1002,NameId:"철벽수호자",Elemental:2,Rarity:3,Class:0,Role:1,BattleLine:0,
       BaseHp:16000,BaseAtk:520,BaseDef:900,AtkSpeed:1.6,MaxLevel:60,BaseStar:4,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:0,PassiveSkillId:6001,TraitId:0},
      {Id:1003,NameId:"폭풍검사",Elemental:0,Rarity:3,Class:1,Role:0,BattleLine:1,
       BaseHp:10000,BaseAtk:1080,BaseDef:360,AtkSpeed:1.2,MaxLevel:60,BaseStar:4,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:7001},
      {Id:1004,NameId:"어둠암살자",Elemental:4,Rarity:3,Class:5,Role:0,BattleLine:2,
       BaseHp:8000,BaseAtk:1180,BaseDef:300,AtkSpeed:1.1,MaxLevel:60,BaseStar:4,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:0},
      {Id:1005,NameId:"달빛치유사",Elemental:3,Rarity:3,Class:4,Role:3,BattleLine:2,
       BaseHp:11000,BaseAtk:600,BaseDef:420,AtkSpeed:1.4,MaxLevel:60,BaseStar:4,MaxStar:6,
       BaseActiveSkillId:0,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:0},
      {Id:1006,NameId:"공명술사",Elemental:1,Rarity:3,Class:2,Role:2,BattleLine:2,
       BaseHp:9500,BaseAtk:760,BaseDef:360,AtkSpeed:1.3,MaxLevel:60,BaseStar:4,MaxStar:6,
       BaseActiveSkillId:0,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:0},
      {Id:1007,NameId:"화염전사",Elemental:0,Rarity:2,Class:1,Role:0,BattleLine:1,
       BaseHp:7000,BaseAtk:820,BaseDef:300,AtkSpeed:1.3,MaxLevel:50,BaseStar:3,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:0},
      {Id:1008,NameId:"대지방패",Elemental:2,Rarity:2,Class:0,Role:1,BattleLine:0,
       BaseHp:12500,BaseAtk:430,BaseDef:720,AtkSpeed:1.6,MaxLevel:50,BaseStar:3,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:0,PassiveSkillId:0,TraitId:0},
      {Id:1009,NameId:"바람궁수",Elemental:1,Rarity:2,Class:3,Role:0,BattleLine:2,
       BaseHp:6500,BaseAtk:880,BaseDef:280,AtkSpeed:1.2,MaxLevel:50,BaseStar:3,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:0},
      {Id:1010,NameId:"빛의기도자",Elemental:3,Rarity:2,Class:4,Role:3,BattleLine:2,
       BaseHp:8500,BaseAtk:500,BaseDef:360,AtkSpeed:1.4,MaxLevel:50,BaseStar:3,MaxStar:6,
       BaseActiveSkillId:0,SpecialActiveSkillId:0,PassiveSkillId:0,TraitId:0},
      {Id:1011,NameId:"물결지원가",Elemental:1,Rarity:2,Class:2,Role:2,BattleLine:2,
       BaseHp:7600,BaseAtk:640,BaseDef:320,AtkSpeed:1.3,MaxLevel:50,BaseStar:3,MaxStar:6,
       BaseActiveSkillId:0,SpecialActiveSkillId:5001,PassiveSkillId:0,TraitId:0},
      {Id:1012,NameId:"견습기사",Elemental:2,Rarity:1,Class:0,Role:1,BattleLine:0,
       BaseHp:9000,BaseAtk:360,BaseDef:520,AtkSpeed:1.6,MaxLevel:40,BaseStar:2,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:0,PassiveSkillId:0,TraitId:0},
      {Id:1013,NameId:"신참검사",Elemental:0,Rarity:1,Class:1,Role:0,BattleLine:1,
       BaseHp:5500,BaseAtk:620,BaseDef:240,AtkSpeed:1.3,MaxLevel:40,BaseStar:2,MaxStar:6,
       BaseActiveSkillId:4001,SpecialActiveSkillId:0,PassiveSkillId:0,TraitId:0},
    ],
    LevelUPDeltaStatMaster: [
      {Id:1,Class:0,DeltaHp:300,DeltaAtk:18,DeltaDef:14},
      {Id:2,Class:1,DeltaHp:220,DeltaAtk:26,DeltaDef:9},
      {Id:3,Class:2,DeltaHp:170,DeltaAtk:30,DeltaDef:7},
      {Id:4,Class:3,DeltaHp:185,DeltaAtk:28,DeltaDef:8},
      {Id:5,Class:4,DeltaHp:240,DeltaAtk:20,DeltaDef:11},
      {Id:6,Class:5,DeltaHp:160,DeltaAtk:32,DeltaDef:6},
    ],
    StarUpCostMaster: SSR_SHARD.map(function (sh, i) { return { Id: i + 1, FromStar: i, ToStar: i + 1, Gold: 0, Shard: sh }; }),
    StarUpDeltaStatMaster: [
      {Id:1,Star:5,HpPermille:250,AtkPermille:250,DefPermille:250},
      {Id:2,Star:6,HpPermille:250,AtkPermille:250,DefPermille:250},
    ],
    BaseActiveSkillMaster: [
      {Id:4001,NameId:"강타",SkillType:0,ExecuteLocation:0,TargetType:0,Scope:0,Cooldown:6,BaseDamageRatio:340,MaxLevel:10},
    ],
    SpecialActiveSkillMaster: [
      {Id:5001,NameId:"화염난무",SkillType:0,ExecuteLocation:1,TargetType:3,Scope:2,Cooldown:12,BaseDamageRatio:220,BuffDebuffGroupId:0,MaxLevel:10},
    ],
    PassiveSkillMaster: [
      {Id:6001,NameId:"화염각인",PassiveTriggerType:1,ConditionType:3,ComparisonType:0,ConditionValue:0,TargetType:2,PermanentBuffDebuffId:0,MaxLevel:10},
    ],
    TraitMaster: [
      {Id:7001,NameId:"화염특화",TraitType:2,BaseDamageRatio:120,BaseSkillId:4001,MaxLevel:5},
    ],
    MonsterMaster: [
      {Id:9001,NameId:"화룡",Elemental:0,Class:1,Role:0,Type:2,SizeType:2,Hp:900000,Atk:1250,Def:540,AtkSpeed:1.5,SkillId:5001,IsBoss:true},
      {Id:9002,NameId:"잡몹",Elemental:2,Class:1,Role:0,Type:0,SizeType:0,Hp:120000,Atk:520,Def:360,AtkSpeed:1.5,SkillId:0,IsBoss:false},
    ],
    ItemMaster: [
      {Id:101,NameId:"골드",IconName:"icon_gold",Rarity:0,ItemType:"Currency",MaxStack:999999999,SellPrice:0},
      {Id:102,NameId:"스킬북",IconName:"icon_skillbook",Rarity:1,ItemType:"Material",MaxStack:9999,SellPrice:100},
      {Id:103,NameId:"성급 조각",IconName:"icon_shard",Rarity:2,ItemType:"Material",MaxStack:9999,SellPrice:200},
    ],
  };

  // ---- 영속 데이터 보장(시드 주입) ----------------------------
  function ensure() {
    const st = Data.state;
    if (!st.builderData) st.builderData = {};
    if (!st.builderCols) st.builderCols = {};   // 불러온 테이블의 원본 컬럼(타입/스코프/필드)
    Object.keys(S.tables).forEach((name) => {
      if (!st.builderData[name]) {
        st.builderData[name] = (seeds[name] ? seeds[name].map((x) => Object.assign(S.blankRow(name), x)) : []);
      }
    });
    // 데모 유닛/몬스터 보강(기존 저장본에 누락된 시드 행만 Id 기준 추가, 사용자 데이터 보존)
    if (!st.builderData.__seedV2) {
      ["UnitMaster", "MonsterMaster"].forEach((name) => {
        const existing = st.builderData[name] || [];
        const ids = new Set(existing.map((r) => +r.Id));
        (seeds[name] || []).forEach((sr) => { if (!ids.has(+sr.Id)) existing.push(Object.assign(S.blankRow(name), sr)); });
        st.builderData[name] = existing;
      });
      st.builderData.__seedV2 = true;
    }
    // 1챕터 = 10스테이지 구조 시드(MonsterGroup + Stage) — 비어있을 때만
    if (!st.builderData.__seedV3) {
      if (!st.builderData.MonsterGroupMaster || st.builderData.MonsterGroupMaster.length === 0) {
        st.builderData.MonsterGroupMaster = [
          Object.assign(S.blankRow("MonsterGroupMaster"), { Id: 1, NameId: "1챕터_일반조", FrontSlot1: 9002, FrontSlot2: 9002, MiddleSlot1: 9002 }),
          Object.assign(S.blankRow("MonsterGroupMaster"), { Id: 2, NameId: "1챕터_보스조", FrontSlot1: 9001 }),
        ];
      }
      if (!st.builderData.StageMaster || st.builderData.StageMaster.length === 0) {
        const stageRows = [];
        for (let n = 1; n <= 10; n++) {
          stageRows.push(Object.assign(S.blankRow("StageMaster"), {
            Id: 1000 + n, NameId: "1-" + n, Chapter: 1, StageNo: n,
            MonsterGroupId1: 1, MonsterGroupId2: 1, MonsterGroupId3: 2,   // 마지막 웨이브=보스조
            ClearRewardId: 0, StaminaCost: 6, RecommendPower: 1000 * n,
          }));
        }
        st.builderData.StageMaster = stageRows;
      }
      st.builderData.__seedV3 = true;
    }
    // StarUpCostMaster: 구버전 기본 2행(4→5,5→6)만 있으면 0★→10★ 10단계 차등 시드로 교체(사용자 수정분은 보존)
    if (!st.builderData.__seedV4) {
      const su = st.builderData.StarUpCostMaster || [];
      const isOldDefault = su.length === 2 && +su[0].FromStar === 4 && +su[1].FromStar === 5;
      if (su.length === 0 || isOldDefault) {
        st.builderData.StarUpCostMaster = seeds.StarUpCostMaster.map((x) => Object.assign(S.blankRow("StarUpCostMaster"), x));
      }
      st.builderData.__seedV4 = true;
    }
    // 성급 상한 등급별 정렬(R10/SR20/SSR30): UnitMaster 성급 컬럼 보정 + StarUpCostMaster 30단계
    if (!st.builderData.__seedV5) {
      const STARMAX = { 0: 10, 1: 10, 2: 20, 3: 30, 4: 30 }; // Rarity → maxStar
      (st.builderData.UnitMaster || []).forEach(function (r) {
        if (+r.MaxStar === 6 || r.MaxStar == null) {          // 구버전 기본값만 보정(사용자 수정분 보존)
          r.MaxStar = STARMAX[+r.Rarity] != null ? STARMAX[+r.Rarity] : 10;
          r.BaseStar = 0;
        }
      });
      const su5 = st.builderData.StarUpCostMaster || [];
      const lastTo = su5.length ? +su5[su5.length - 1].ToStar : 0;
      if (su5.length <= 10 || lastTo <= 10) {                 // 구버전(2/10단계)만 30단계로 교체
        st.builderData.StarUpCostMaster = seeds.StarUpCostMaster.map(function (x) { return Object.assign(S.blankRow("StarUpCostMaster"), x); });
      }
      st.builderData.__seedV5 = true;
    }
    // UnitLevelUpCostMaster: 비어있으면 곡선으로 자동 생성(레벨 2~60)
    if (st.builderData.UnitLevelUpCostMaster.length === 0) {
      const rows = [];
      for (let lv = 2; lv <= 60; lv++) {
        rows.push(Object.assign(S.blankRow("UnitLevelUpCostMaster"),
          { Id: lv, Level: lv, Gold: Math.round(40 * Math.pow(lv, 2)), Exp: Math.round(70 * Math.pow(lv, 2)) }));
      }
      st.builderData.UnitLevelUpCostMaster = rows;
    }
    // 스키마 컬럼 추가분 마이그레이션: 기존 행에 빠진 컬럼을 기본값으로 채움(불러온 테이블은 원본 보존)
    Object.keys(S.tables).forEach((name) => {
      if (st.builderCols[name]) return;
      const cols = S.tables[name].columns;
      (st.builderData[name] || []).forEach((row) => {
        cols.forEach((col) => { if (!(col.field in row)) row[col.field] = S.defOf(col.type); });
      });
    });
    return st.builderData;
  }
  function rows(name) { ensure(); return Data.state.builderData[name] || []; }

  // 테이블의 컬럼 정의 — 불러온 CSV는 원본 헤더, 그 외엔 스키마
  function columns(name) {
    const st = Data.state;
    if (st.builderCols && st.builderCols[name]) return st.builderCols[name];
    return S.tables[name] ? S.tables[name].columns : [];
  }
  function isImported(name) { const st = Data.state; return !!(st.builderCols && st.builderCols[name]); }
  function blankRowFor(name) {
    const o = {}; columns(name).forEach((c) => { o[c.field] = S.defOf(c.type); }); return o;
  }

  // ---- 감사 로그(append-only) — 누가/언제/무엇을 변경했는지 추적 ----
  function audit(action, name, idx, field, oldV, newV) {
    const st = Data.state;
    if (!st._audit) st._audit = [];
    st._audit.push({ ts: Date.now(), action: action, table: name, row: (idx != null ? idx + 1 : null), field: field || null, old: oldV != null ? String(oldV) : "", val: newV != null ? String(newV) : "" });
    if (st._audit.length > 3000) st._audit.splice(0, st._audit.length - 3000); // 상한
  }
  function auditLog() { return (Data.state._audit || []).slice().reverse(); }

  // ---- CRUD ---------------------------------------------------
  function addRow(name) {
    const list = rows(name);
    const row = blankRowFor(name);
    // Id 자동 증가
    if ("Id" in row) {
      const maxId = list.reduce((m, r) => Math.max(m, +r.Id || 0), 0);
      row.Id = maxId + 1;
    }
    list.push(row);
    audit("add", name, list.length - 1, "Id", "", row.Id);
    sync(name); Data.save();
    return list.length - 1;
  }
  function deleteRow(name, idx) {
    const list = rows(name);
    if (idx >= 0 && idx < list.length) { audit("delete", name, idx, "Id", list[idx] && list[idx].Id, ""); list.splice(idx, 1); }
    sync(name); Data.save();
  }
  function dupRow(name, idx) {
    const list = rows(name);
    if (idx < 0 || idx >= list.length) return;
    const copy = Object.assign({}, list[idx]);
    if ("Id" in copy) copy.Id = list.reduce((m, r) => Math.max(m, +r.Id || 0), 0) + 1;
    list.splice(idx + 1, 0, copy);
    audit("duplicate", name, idx + 1, "Id", list[idx].Id, copy.Id);
    sync(name); Data.save();
  }
  // 드래그로 행 순서 이동
  function moveRow(name, from, to) {
    const list = rows(name);
    if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return;
    const it = list.splice(from, 1)[0];
    list.splice(to, 0, it);
    sync(name); Data.save();
  }
  function setCell(name, idx, field, value) {
    const list = rows(name);
    if (idx < 0 || idx >= list.length) return;
    if (isImported(name)) {
      // 불러온 테이블: 입력값을 원본 문자열 그대로 보존(라운드트립 동일)
      audit("edit", name, idx, field, list[idx][field], value);
      list[idx][field] = value;
      sync(name); Data.save();
      return;
    }
    const col = columns(name).find((c) => c.field === field);
    const t = (col ? col.type : "string").toLowerCase();
    if (t.startsWith("int")) value = value === "" ? 0 : parseInt(value, 10) || 0;
    else if (t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal")) value = value === "" ? 0 : parseFloat(value) || 0;
    else if (t.startsWith("bool")) value = (value === true || value === "true" || value === "1");
    audit("edit", name, idx, field, list[idx][field], value);
    list[idx][field] = value;
    sync(name); Data.save();
  }

  // ---- Define 참조 헬퍼(드롭다운) ----------------------------
  // refTable: "ElementalDefine"(define) | "@UnitMaster"(master FK)
  function refOptions(refTable) {
    if (!refTable) return null;
    if (refTable[0] === "@") {
      const name = refTable.slice(1);
      const labelField = (columns(name).find((c) => c.field === "NameId") ? "NameId" : null);
      return rows(name).map((r) => ({ id: +r.Id, label: labelField ? `${r.Id} · ${r[labelField]}` : String(r.Id) }));
    }
    // Define
    return rows(refTable).map((r) => {
      const lbl = r.KorName != null && r.KorName !== "" ? r.KorName : (r.Symbol != null && r.Symbol !== "" ? r.Symbol : r.EnumName);
      return { id: +r.Id, label: `${r.EnumName}${lbl && lbl !== r.EnumName ? " · " + lbl : ""}` };
    });
  }
  // id → 표시 라벨(읽기용)
  function refLabel(refTable, id) {
    const opts = refOptions(refTable);
    if (!opts) return id;
    const f = opts.find((o) => o.id === +id);
    return f ? f.label : id;
  }

  // ============================================================
  // 4-Row CSV 생성
  // ============================================================
  function tableCSV(name) {
    const cols = columns(name);
    const list = rows(name);
    const esc = (v) => {
      const s = v == null ? "" : (v === true ? "1" : v === false ? "0" : String(v));
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [];
    lines.push(cols.map((c) => esc(c.type)).join(","));
    lines.push(cols.map((c) => esc(c.scope)).join(","));
    lines.push(cols.map((c) => esc(c.field)).join(","));
    list.forEach((row) => lines.push(cols.map((c) => esc(row[c.field])).join(",")));
    return lines.join("\r\n");
  }

  function downloadCSV(name) {
    const blob = new Blob(["\ufeff" + tableCSV(name)], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, name + ".csv");
  }
  function copyCSV(name) {
    const text = tableCSV(name);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }
  function exportJSON() {
    ensure();
    const st = Data.state;
    const snap = { project: "ProjectA", exportedAt: new Date().toISOString(), tables: st.builderData, cols: st.builderCols || {} };
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    triggerDownload(blob, "ProjectA_master_snapshot.json");
  }
  function importJSON(obj) {
    if (!obj || !obj.tables) return false;
    ensure();
    const st = Data.state;
    if (obj.cols) { if (!st.builderCols) st.builderCols = {}; Object.assign(st.builderCols, obj.cols); }
    Object.keys(obj.tables).forEach((k) => { if (!k.startsWith("__")) st.builderData[k] = obj.tables[k]; });
    syncAll(); Data.save();
    return true;
  }

  // 폴더/다중 파일 CSV → 빌더 적재 (원본 그대로). 이름.csv 기준으로 테이블 매칭.
  function importCSV(name, text) {
    const p = Data.parseCSV(text, { raw: true });
    if (p.error) return { error: p.error };
    ensure();
    const st = Data.state;
    if (!st.builderCols) st.builderCols = {};
    st.builderCols[name] = p.fields.map((f, i) => ({
      field: f, type: (p.types[i] || "string"), scope: (p.scopes[i] || "Server"), ref: null,
    }));
    st.builderData[name] = p.records;
    sync(name); Data.save();
    return { ok: true, rows: p.records.length, cols: p.fields.length };
  }

  // 전체 ZIP(STORE 방식 — 외부 라이브러리 불필요). 스키마 + 불러온 테이블 모두 포함.
  function downloadAllZip() {
    ensure();
    const st = Data.state;
    const files = [];
    const names = new Set(Object.keys(S.tables));
    Object.keys(st.builderData).forEach((k) => { if (!k.startsWith("__")) names.add(k); });
    names.forEach((name) => {
      let dir = "Imported/";
      if (S.tables[name]) dir = S.tables[name].kind === "define" ? "Define/" : "Master/";
      files.push({ name: dir + name + ".csv", data: "\ufeff" + tableCSV(name) });
    });
    const blob = makeZip(files);
    triggerDownload(blob, "ProjectA_CSV_All.zip");
  }

  function triggerDownload(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // ---- 최소 ZIP(STORE, 압축 없음) -----------------------------
  const crcTable = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = (n) => [n & 255, (n >>> 8) & 255];
    const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

    files.forEach((f) => {
      const nameBytes = enc.encode(f.name);
      const dataBytes = enc.encode(f.data);
      const crc = crc32(dataBytes);
      const local = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dataBytes.length), u32(dataBytes.length),
        u16(nameBytes.length), u16(0)
      );
      chunks.push(new Uint8Array(local), nameBytes, dataBytes);
      const localLen = local.length + nameBytes.length + dataBytes.length;
      central.push({ nameBytes, crc, size: dataBytes.length, offset });
      offset += localLen;
    });

    const centralChunks = [];
    let centralSize = 0;
    central.forEach((c) => {
      const head = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.size), u32(c.size),
        u16(c.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset)
      );
      const arr = new Uint8Array(head);
      centralChunks.push(arr, c.nameBytes);
      centralSize += head.length + c.nameBytes.length;
    });
    const end = [].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(centralSize), u32(offset), u16(0)
    );
    const all = chunks.concat(centralChunks, [new Uint8Array(end)]);
    return new Blob(all, { type: "application/zip" });
  }

  // ============================================================
  // 시뮬 동기화 — 입력값 즉시 반영
  // ============================================================
  function enumName(defineTable, id) {
    const row = rows(defineTable).find((r) => +r.Id === +id);
    return row ? row.EnumName : null;
  }
  function sync(changedTable) {
    // 빌더 데이터 변경 시 항상 시뮬 상태 재동기화
    syncAll();
  }
  // Rarity 인코딩 → 등급 라벨 (임포트 정의 우선, 없으면 3티어 보정)
  function gradeFromRarity(raw) {
    if (raw == null || raw === "") return null;
    if (!/^\d+$/.test(String(raw).trim())) return String(raw).toUpperCase();
    if (isImported("RarityDefine")) { const g = enumName("RarityDefine", raw); if (g) return g; }
    return ({ 0: "R", 1: "SR", 2: "SSR", 3: "UR" })[+raw] || enumName("RarityDefine", raw);
  }
  // 레벨별 비용 테이블 추출 [{lv,gold,book}]
  function costRowsFrom(table) {
    const rs = rows(table); if (!rs.length) return null;
    const fL = rfield(table, ["Level", "Lv", "Lvl"]);
    const fG = rfield(table, ["GoldCost", "Gold", "Cost", "Price"]);
    const fB = rfield(table, ["BookCost", "Book"]);
    if (!fL) return null;
    const out = rs.map((r) => ({ lv: +r[fL], gold: fG ? +r[fG] || 0 : 0, book: fB ? +r[fB] || 0 : 0 }))
      .filter((x) => !isNaN(x.lv)).sort((a, b) => a.lv - b.lv);
    return out.length ? out : null;
  }
  // Delta 테이블의 최대 레벨(스킬 만렙 추정)
  function maxLevelFrom(table) {
    const rs = rows(table); if (!rs.length) return null;
    const fL = rfield(table, ["Level", "Lv"]); if (!fL) return null;
    return rs.reduce((m, r) => Math.max(m, +r[fL] || 0), 0) || null;
  }
  function syncAll() {
    const st = Data.state;
    const u = rows("UnitMaster")[0];
    if (u) {
      const gv = (al) => { const f = rfield("UnitMaster", al); return f ? u[f] : undefined; };
      const isNum = (v) => v != null && v !== "" && /^-?\d+(\.\d+)?$/.test(String(v).trim());
      const elRaw = gv(["Elemental", "Element"]);
      const rarRaw = gv(["Rarity", "Grade"]);
      const el = isNum(elRaw) ? enumName("ElementalDefine", elRaw) : elRaw;
      const rar = isNum(rarRaw) ? enumName("RarityDefine", rarRaw) : rarRaw;
      if (el) st.unit.element = el;
      if (rar) st.unit.rarity = rar;
      // NameId가 숫자/빈값이면 Desc(설명)를 표시 이름으로 사용
      const nm = gv(["NameId", "Name", "KorName"]);
      const desc = gv(["Desc", "Description"]);
      st.unit.name = (nm && !isNum(nm)) ? nm : (desc || st.unit.name);
      const ml = gv(["MaxLevel", "MaxLv"]); 
      const bs = gv(["BaseStar", "StartStar", "MinStar"]);
      const ms = gv(["MaxStar"]);
      // 등급 기반 최대레벨·최대성급 보정(컬럼 부재 시 doctrine.growth 사용)
      const grade = gradeFromRarity(rarRaw);
      const gg = ((Data.state.doctrine.growth || {}).grades || {})[grade] || {};
      st.unit.maxLevel = +ml || gg.maxLevel || st.unit.maxLevel;
      st.unit.baseStar = (bs != null && bs !== "") ? +bs : 0;
      st.unit.maxStar = +ms || gg.maxStar || st.unit.maxStar;
      const hp = gv(["BaseHp", "BaseMaxHp", "MaxHp", "Health"]); if (+hp) st.unit.base.hp = +hp;
      const atk = gv(["BaseAtk", "BaseAttack", "Attack", "Atk"]); if (+atk) st.unit.base.atk = +atk;
      const def = gv(["BaseDef", "BaseDefence", "BaseDefense", "Defence", "Defense"]); if (+def) st.unit.base.def = +def;
      const ai = gv(["AtkInterval", "AttackInterval", "AtkSpeed"]); if (+ai) st.unit.base.atkInterval = +ai;
      // 클래스별 레벨업 증가량 (컬럼명 유연: ClassType/LevelUpHP 등)
      const clsRaw = gv(["Class"]);
      const dl = rows("LevelUPDeltaStatMaster");
      if (dl.length) {
        const fC = rfield("LevelUPDeltaStatMaster", ["ClassType", "Class"]);
        const fH = rfield("LevelUPDeltaStatMaster", ["LevelUpHP", "DeltaHp", "Hp"]);
        const fA = rfield("LevelUPDeltaStatMaster", ["LevelUpATK", "DeltaAtk", "Atk", "Attack"]);
        const fD = rfield("LevelUPDeltaStatMaster", ["LevelUpDEF", "DeltaDef", "Def", "Defence"]);
        const delta = fC ? dl.find((r) => +r[fC] === +clsRaw) : null;
        if (delta) st.unit.perLevel = { hp: fH ? +delta[fH] || 0 : 0, atk: fA ? +delta[fA] || 0 : 0, def: fD ? +delta[fD] || 0 : 0 };
      }
    }
    // 레벨업 비용 테이블 (컬럼명 유연 매칭)
    const lv = rows("UnitLevelUpCostMaster");
    if (lv.length) {
      const fL = rfield("UnitLevelUpCostMaster", ["Level", "Lv", "Lvl"]);
      const fG = rfield("UnitLevelUpCostMaster", ["Gold", "GoldCost", "Cost", "Price"]);
      const fE = rfield("UnitLevelUpCostMaster", ["Exp", "Experience"]);
      if (fL && fG) {
        const m = lv.map((r) => ({ lv: +r[fL], gold: +r[fG] || 0, exp: fE ? +r[fE] || 0 : 0 })).filter((x) => !isNaN(x.lv) && x.lv > 0);
        if (m.length) st.costs.levelTable = m;
      }
    }
    // 성급업 비용 (컬럼명 유연 매칭 + Level/Cost 단일컬럼 설계 지원 + NaN 방지)
    if (st.costs.star && st.costs.star.some((s) => s.from == null || isNaN(s.from))) {
      st.costs.star = [{ from: 4, to: 5, gold: 600000, shard: 60 }, { from: 5, to: 6, gold: 1200000, shard: 120 }];
    }
    const star = rows("StarUpCostMaster");
    if (star.length) {
      const fT = rfield("StarUpCostMaster", ["ToStar", "NextStar", "AfterStar", "TargetStar", "Level", "Star", "To"]);
      const fF = rfield("StarUpCostMaster", ["FromStar", "BeforeStar", "CurrentStar", "From"]);
      // 성급업은 조각만 사용(골드 없음) — Cost/Material/Shard 컬럼을 조각으로 매핑
      const fS = rfield("StarUpCostMaster", ["Shard", "Material", "Piece", "Fragment", "Count", "Cost"]);
      if (fT) {
        const m = star.map((r) => {
          const to = +r[fT];
          return { from: fF ? Math.max(0, +r[fF]) : Math.max(0, to - 1), to: to, gold: 0, shard: fS ? +r[fS] || 0 : 0 };
        }).filter((x) => !isNaN(x.from) && !isNaN(x.to) && x.to > x.from);
        if (m.length) st.costs.star = m;
      }
    }
    // 스킬/특성 레벨업 비용 — 불러온 테이블 기반(차등 GoldCost/BookCost)
    const skillCost = {
      base:    { table: costRowsFrom("BaseActiveSkillLevelUpCostMaster"),    maxLevel: maxLevelFrom("BaseActiveSkillLevelUpDeltaMaster") },
      special: { table: costRowsFrom("SpecialActiveSkillLevelUpCostMaster"), maxLevel: maxLevelFrom("SpecialActiveSkillLevelUpDeltaMaster") },
      passive: { table: costRowsFrom("PassiveSkillLevelUpCostMaster"),       maxLevel: maxLevelFrom("PassiveSkillLevelUpDeltaMaster") },
    };
    if (skillCost.base.table || skillCost.special.table || skillCost.passive.table) st.costs.skillCost = skillCost;
    const traitTable = costRowsFrom("TraitLevelUpCostMaster");
    if (traitTable) st.costs.traitCost = { table: traitTable, maxLevel: maxLevelFrom("TraitSkillLevelUpDeltaMaster") };

    // 전투 시뮬용 팀/스테이지를 불러온 데이터로 구성(시드 대체)
    buildSimFromBuilder(st);
  }

  // 행 단위 유연 읽기
  function rget(table, row, aliases) { const f = rfield(table, aliases); return f != null ? row[f] : undefined; }
  const LINE3 = { 0: "F", 1: "M", 2: "B" };

  // 스킬 id → 전투 스킬 객체. SkillType/Scope는 마스터, DamageRate는 DeltaMaster(퍼밀)에서 해석.
  const SCOPE3 = { 0: "single", 1: "line", 2: "all", 3: "single", 4: "all" };
  function deltaRate(deltaTable, idField, id) {
    const dl = rows(deltaTable); if (!dl.length) return 0;
    const fId = rfield(deltaTable, [idField, "MasterId", "SkillMasterId"]);
    const fLv = rfield(deltaTable, ["Level", "Lv"]);
    const fDr = rfield(deltaTable, ["DamageRate", "Rate", "Damage", "DamageRatio"]);
    if (!fId || !fDr) return 0;
    const ds = dl.filter((r) => +r[fId] === +id);
    if (!ds.length) return 0;
    if (fLv) ds.sort((a, b) => (+a[fLv]) - (+b[fLv]));
    return (+ds[0][fDr] || 0) / 1000;   // 1000퍼밀 = 100% = ratio 1.0
  }
  function buildSkill(masterTable, deltaTable, idField, id) {
    if (!+id) return null;
    const rs = rows(masterTable); const fId = rfield(masterTable, ["Id"]);
    if (!fId) return null;
    const row = rs.find((r) => +r[fId] === +id); if (!row) return null;
    const stype = +rget(masterTable, row, ["SkillType"]);
    const scope = SCOPE3[+rget(masterTable, row, ["Scope"])] || "single";
    const cool = +rget(masterTable, row, ["CoolTurn", "Cooldown", "CoolTime"]) || 0;
    const cd = cool > 0 ? Math.min(40, cool * 2) : 6;   // 턴→초 근사
    const ratio = deltaRate(deltaTable, idField, id);
    if (stype === 4) return { name: "CC", cd: cd, ratio: 0, scope: scope, type: "cc", stun: 1.2 };
    if (stype === 2) return { name: "버프", cd: cd, ratio: 0, scope: "self", type: "buff", stat: "atk", mult: 1.3, dur: 5 };
    if (stype === 3) return { name: "디버프", cd: cd, ratio: 0, scope: scope, type: "debuff", stat: "def", mult: 0.8, dur: 5 };
    if (stype === 1) return null; // 힐: 전투 시뮬 미구현 → 생략
    return ratio > 0 ? { name: "스킬", cd: cd, ratio: ratio, scope: scope, type: "damage" } : null;
  }
  function entitySkills(row, table) {
    const out = [];
    const sp = buildSkill("SpecialActiveSkillMaster", "SpecialActiveSkillLevelUpDeltaMaster", "SpecialSkillMasterId", rget(table, row, ["SpecialActiveSkillId"]));
    if (sp) out.push(sp);
    const ba = buildSkill("BaseActiveSkillMaster", "BaseActiveSkillLevelUpDeltaMaster", "BaseSkillMasterId", rget(table, row, ["BaseActiveSkillId"]));
    if (ba) out.push(ba);
    return out;
  }
  function spd2interval(speed) {
    const s = +speed; if (!s || isNaN(s)) return 1.5;
    return Math.min(5, Math.max(0.5, 180 / s));
  }

  // 불러온 데이터로 전투 팀/스테이지 구성
  function buildSimFromBuilder(st) {
    // 1) 팀 = UnitMaster 상위 5
    const units = rows("UnitMaster");
    if (units.length) {
      const team = units.slice(0, 5).map((u) => {
        const nm = rget("UnitMaster", u, ["NameId", "Name", "KorName"]);
        const desc = rget("UnitMaster", u, ["Desc", "Description"]);
        const isNum = (v) => v != null && v !== "" && /^-?\d+(\.\d+)?$/.test(String(v).trim());
        const elRaw = rget("UnitMaster", u, ["Elemental", "Element"]);
        return {
          name: (nm && !isNum(nm)) ? nm : (desc || ("Unit " + u.Id)),
          element: isNum(elRaw) ? (enumName("ElementalDefine", elRaw) || "Fire") : (elRaw || "Fire"),
          line: LINE3[+rget("UnitMaster", u, ["BattleLine", "Line"]) || 0] || "M",
          hp: +rget("UnitMaster", u, ["BaseHp", "BaseMaxHp", "MaxHp", "Health"]) || 1000,
          atk: +rget("UnitMaster", u, ["BaseAtk", "BaseAttack", "Attack", "Atk"]) || 100,
          def: +rget("UnitMaster", u, ["BaseDef", "BaseDefence", "BaseDefense", "Defence", "Defense"]) || 50,
          atkInterval: spd2interval(rget("UnitMaster", u, ["AtkInterval", "AttackInterval", "AtkSpeed", "Speed"])),
          skills: entitySkills(u, "UnitMaster", false),
        };
      });
      if (team.length) st.team = team;
    }

    // 2) 스테이지 = StageMaster → MonsterGroupMaster → MonsterMaster
    const stageRows = rows("StageMaster");
    const monsters = rows("MonsterMaster");
    const groups = rows("MonsterGroupMaster");
    if (!stageRows.length || !monsters.length || !groups.length) return;

    const mById = {}; const mIdF = rfield("MonsterMaster", ["Id"]);
    monsters.forEach((m) => { mById[+m[mIdF]] = m; });
    const gById = {}; const gIdF = rfield("MonsterGroupMaster", ["Id"]);
    groups.forEach((g) => { gById[+g[gIdF]] = g; });

    const slotDefs = [
      ["FrontMonsterId1", "FrontMonsterId2", "FrontMonsterId3", "F"],
      ["MiddleMonsterId1", "MiddleMonsterId2", "MiddleMonsterId3", "M"],
      ["BackMonsterId1", "BackMonsterId2", "BackMonsterId3", "B"],
    ];
    function monsterEntity(id, line, boss) {
      const m = mById[+id]; if (!m) return null;
      const nm = rget("MonsterMaster", m, ["NameId", "Name", "KorName"]);
      const desc = rget("MonsterMaster", m, ["Desc", "Description"]);
      const isNum = (v) => v != null && v !== "" && /^-?\d+(\.\d+)?$/.test(String(v).trim());
      const elRaw = rget("MonsterMaster", m, ["Elemental", "Element"]);
      const bossFlag = boss || String(rget("MonsterMaster", m, ["Boss", "IsBoss"]) || "").match(/^(1|true)$/i);
      return {
        name: (nm && !isNum(nm)) ? nm : (desc || ("Mob " + id)),
        element: isNum(elRaw) ? (enumName("ElementalDefine", elRaw) || "Fire") : (elRaw || "Fire"),
        line: line,
        hp: +rget("MonsterMaster", m, ["Hp", "BaseMaxHp", "MaxHp", "Health"]) || 500,
        atk: +rget("MonsterMaster", m, ["Atk", "Attack"]) || 50,
        def: +rget("MonsterMaster", m, ["Def", "Defence", "Defense"]) || 30,
        atkInterval: spd2interval(rget("MonsterMaster", m, ["AtkInterval", "AtkSpeed", "Speed"])),
        skills: entitySkills(m, "MonsterMaster", true),
        boss: !!bossFlag,
      };
    }
    function groupUnits(gid, boss) {
      const g = gById[+gid]; if (!g) return [];
      const us = [];
      slotDefs.forEach((sd) => {
        for (let i = 0; i < 3; i++) {
          const id = +g[sd[i]] || 0;
          if (id) { const e = monsterEntity(id, sd[3], boss); if (e) us.push(e); }
        }
      });
      return us;
    }

    const sIdF = rfield("StageMaster", ["StageId", "Id"]);
    const stages = stageRows.slice(0, 12).map((row) => {
      const wc = +rget("StageMaster", row, ["WaveCount"]) || 0;
      const waves = [];
      for (let w = 1; w <= Math.max(wc, 1); w++) {
        const gid = +rget("StageMaster", row, ["Wave" + w + "MonsterGroupId"]) || 0;
        if (gid) { const us = groupUnits(gid, false); if (us.length) waves.push({ units: us }); }
      }
      const bossGid = +rget("StageMaster", row, ["BossMonsterGroupId"]) || 0;
      if (bossGid) { const us = groupUnits(bossGid, true); if (us.length) waves.push({ units: us }); }
      const nm = rget("StageMaster", row, ["NameId", "Name"]);
      const desc = rget("StageMaster", row, ["Desc", "Description"]);
      const isNum = (v) => v != null && v !== "" && /^-?\d+$/.test(String(v).trim());
      const ch = +rget("StageMaster", row, ["ChapterId", "Chapter"]) || null;
      const sno = +rget("StageMaster", row, ["StageId", "StageNo"]) || +row.Id;
      const cleanDesc = desc && !/\uFFFD|�/.test(String(desc)) && !isNum(desc);
      const name = cleanDesc ? desc : (ch ? (ch + "챕터 " + sno + "스테이지") : ("스테이지 " + sno));
      return {
        id: +row[sIdF] || +row.Id,
        name: name,
        waves: waves.length ? waves : [{ units: [] }],
      };
    }).filter((s) => s.waves.some((w) => w.units.length));
    if (stages.length) st.stages = stages;
  }

  // 컬럼명 유연 매칭: 정확일치 우선, 없으면 부분일치(3글자+ 별칭)
  function rfield(table, aliases) {
    const cols = columns(table).map((c) => String(c.field));
    for (let i = 0; i < aliases.length; i++) {
      const a = aliases[i].toLowerCase();
      const hit = cols.find((c) => c.toLowerCase() === a);
      if (hit) return hit;
    }
    for (let i = 0; i < aliases.length; i++) {
      if (aliases[i].length < 3) continue;
      const a = aliases[i].toLowerCase();
      const hit = cols.find((c) => c.toLowerCase().includes(a));
      if (hit) return hit;
    }
    return null;
  }

  // ============================================================
  // AI 교정안 → CSV 패치 적용
  // 패치 대상 카탈로그: 안정적인 key → 실제 빌더 테이블/필드 매핑
  // ============================================================
  function patchCatalog() {
    const cat = {
      level_gold:  { label: "레벨업 골드 비용", table: "UnitLevelUpCostMaster", field: "Gold", aliases: ["Gold", "GoldCost", "Cost", "Price"], scope: "all", area: "growth" },
      level_exp:   { label: "레벨업 경험치 비용", table: "UnitLevelUpCostMaster", field: "Exp", aliases: ["Exp", "Experience"], scope: "all", area: "growth" },
      star_gold:   { label: "성급업 골드 비용", table: "StarUpCostMaster", field: "Gold", aliases: ["Gold", "GoldCost", "Cost", "Price"], scope: "all", area: "growth" },
      star_shard:  { label: "성급업 재료(조각)", table: "StarUpCostMaster", field: "Shard", aliases: ["Shard", "Material", "Count", "Piece", "Fragment"], scope: "all", area: "growth" },
      unit_atk:    { label: "유닛 기본 공격력", table: "UnitMaster", field: "BaseAtk", aliases: ["BaseAtk", "BaseAttack", "Attack", "Atk"], scope: "all", area: "combat" },
      unit_hp:     { label: "유닛 기본 HP", table: "UnitMaster", field: "BaseHp", aliases: ["BaseHp", "BaseMaxHp", "MaxHp", "Health", "Hp"], scope: "all", area: "combat" },
      unit_def:    { label: "유닛 기본 방어력", table: "UnitMaster", field: "BaseDef", aliases: ["BaseDef", "BaseDefence", "BaseDefense", "Defence", "Defense", "Def"], scope: "all", area: "combat" },
      skill_ratio: { label: "기본 스킬 데미지율", table: "BaseActiveSkillMaster", field: "BaseDamageRatio", aliases: ["BaseDamageRatio", "DamageRatio", "Damage", "Ratio", "Coeff"], scope: "all", area: "combat" },
      monster_hp:  { label: "몬스터 HP", table: "MonsterMaster", field: "Hp", aliases: ["BaseMaxHp", "MaxHp", "Health", "Hp"], scope: "all", area: "combat" },
      monster_atk: { label: "몬스터 공격력", table: "MonsterMaster", field: "Atk", aliases: ["BaseAttack", "Attack", "Atk"], scope: "all", area: "combat" },
    };
    Object.keys(cat).forEach((k) => {
      const e = cat[k]; const rs = rows(e.table);
      e.exists = rs.length > 0;
      // 실제 데이터 컬럼명으로 해석(별칭 허용)
      const actual = rfield(e.table, [e.field].concat(e.aliases || []));
      if (actual) e.field = actual;
      e.fieldExists = rs.length > 0 && !!actual;
      if (!e.fieldExists) { e.current = 0; return; }
      if (e.scope === "all") e.current = +rs[rs.length - 1][e.field] || 0;
      else { const r = rs.find((x) => +x.Id === e.scope) || rs[0]; e.current = r ? (+r[e.field] || 0) : 0; }
    });
    return cat;
  }

  // patch = { key, op:"mul"|"add"|"set", value }
  function applyPatch(patch) {
    if (!patch || !patch.key) return { ok: false, msg: "패치 정보 없음" };
    const e = patchCatalog()[patch.key];
    if (!e) return { ok: false, msg: "알 수 없는 대상: " + patch.key };
    const list = rows(e.table);
    if (!list.length) return { ok: false, msg: e.table + " 데이터 없음" };
    let targets;
    if (e.scope === "all") targets = list.map((_, i) => i);
    else { let idx = list.findIndex((r) => +r.Id === e.scope); if (idx < 0) idx = 0; targets = [idx]; }
    const op = patch.op || "mul"; const val = +patch.value;
    let before = 0, after = 0;
    targets.forEach((idx, ti) => {
      const r = list[idx]; const b = +r[e.field] || 0; let v = b;
      if (op === "mul") v = Math.round(b * val);
      else if (op === "add") v = Math.round(b + val);
      else v = Math.round(val);
      if (ti === 0) { before = b; after = v; }
      setCell(e.table, idx, e.field, v);
    });
    return { ok: true, label: e.label, table: e.table, field: e.field, op: op, value: val, before: before, after: after, count: targets.length };
  }

  // 불러온 테이블 포함 전체 테이블명(스키마 ∪ 불러온 기타)
  function importedNames() {
    ensure();
    return Object.keys(Data.state.builderData).filter((k) => !k.startsWith("__") && !S.tables[k]);
  }

  // ---- AI 생성 보조: 스키마 컨텍스트 / 행 추가 ----
  function genContext(target) {
    const t = S.tables[target];
    const list = rows(target);
    const nextId = list.reduce((m, r) => Math.max(m, +r.Id || 0), 1000) + 1;
    if (!t) return "테이블 " + target + " (스키마 미정의), 다음 Id=" + nextId;
    const lines = t.columns.map((col) => {
      let extra = "";
      if (col.ref) {
        const opts = refOptions(col.ref) || [];
        const shown = opts.slice(0, 30).map((o) => `${o.id}=${String(o.label).split(" · ")[0]}`).join(", ");
        extra = ` [참조 허용값: ${shown || "없음"}]`;
      }
      return `${col.field} (${col.type}${col.scope === "Client" ? ",클라" : ""})${extra}`;
    });
    return `테이블 ${target}, 다음 Id=${nextId}\n컬럼:\n- ` + lines.join("\n- ");
  }
  function appendRows(target, newRows) {
    if (!Array.isArray(newRows) || !newRows.length) return 0;
    ensure();
    const list = rows(target);
    const cols = columns(target);
    let nextId = list.reduce((m, r) => Math.max(m, +r.Id || 0), 1000) + 1;
    let added = 0;
    newRows.forEach((nr) => {
      const row = blankRowFor(target);
      cols.forEach((c) => {
        if (nr[c.field] == null || nr[c.field] === "") return;
        let v = nr[c.field]; const tp = String(c.type).toLowerCase();
        if (tp.startsWith("int")) v = parseInt(v, 10) || 0;
        else if (tp.startsWith("float") || tp.startsWith("double") || tp.startsWith("decimal")) v = parseFloat(v) || 0;
        else if (tp.startsWith("bool")) v = (v === true || v === "true" || v === 1 || v === "1");
        row[c.field] = v;
      });
      if (!row.Id || list.some((r) => +r.Id === +row.Id)) row.Id = nextId;
      nextId = Math.max(nextId, +row.Id || 0) + 1;
      list.push(row); added++;
    });
    syncAll(); Data.save();
    return added;
  }

  // ---- 베이스라인(기준) 저장/복원 ----
  function baselines() {
    ensure();
    if (!Data.state.baselines) Data.state.baselines = [];
    return Data.state.baselines;
  }
  const BASELINE_MAX = 5;   // localStorage 용량 보호: 기준 스냅샷 보관 상한(초과 시 가장 오래된 것부터 제거)
  function saveBaseline(label) {
    ensure();
    const list = baselines();
    // 라벨은 단조 증가 seq 사용(FIFO로 오래된 항목이 빠져도 번호가 되돌지 않도록)
    Data.state.baselineSeq = (Data.state.baselineSeq || 0) + 1;
    const seq = Data.state.baselineSeq;
    const rowCount = Object.keys(Data.state.builderData).filter((k) => !k.startsWith("__"))
      .reduce((a, k) => a + (Data.state.builderData[k] || []).length, 0);
    const tableCount = Object.keys(Data.state.builderData).filter((k) => !k.startsWith("__") && (Data.state.builderData[k] || []).length).length;
    list.push({
      label: label || (seq + "차"),
      at: new Date().toISOString(),
      rows: rowCount, tables: tableCount,
      data: JSON.parse(JSON.stringify(Data.state.builderData)),
      cols: JSON.parse(JSON.stringify(Data.state.builderCols || {})),
    });
    if (list.length > BASELINE_MAX) list.splice(0, list.length - BASELINE_MAX); // 오래된 기준 FIFO 제거(용량 보호)
    Data.save();
    return seq;
  }
  function restoreBaseline(idx) {
    const list = baselines(); const b = list[idx]; if (!b) return false;
    Data.state.builderData = JSON.parse(JSON.stringify(b.data));
    Data.state.builderCols = JSON.parse(JSON.stringify(b.cols || {}));
    syncAll(); Data.save();
    return true;
  }
  function deleteBaseline(idx) {
    const list = baselines();
    if (idx >= 0 && idx < list.length) { list.splice(idx, 1); Data.save(); }
  }

  // ---- 데이터 검증 (중복 Id / 빈 Id / 참조 무결성) ----
  function validate(cap) {
    ensure();
    cap = cap || 300;
    const issues = [];
    const names = Object.keys(Data.state.builderData).filter((k) => !k.startsWith("__"));
    let dupes = 0, empties = 0, refErr = 0;
    names.forEach((name) => {
      const list = Data.state.builderData[name] || [];
      const schemaCols = S.tables[name] ? S.tables[name].columns : null;
      const seen = {};
      list.forEach((r, i) => {
        const id = r.Id;
        if (id == null || id === "") { empties++; if (issues.length < cap) issues.push({ table: name, row: i + 1, type: "빈 Id", detail: "Id가 비어있음" }); }
        else if (seen[id] != null) { dupes++; if (issues.length < cap) issues.push({ table: name, row: i + 1, type: "중복 Id", detail: `Id ${id} (행 ${seen[id] + 1}과 중복)` }); }
        else seen[id] = i;
      });
      if (schemaCols) {
        schemaCols.forEach((col) => {
          if (!col.ref) return;
          const refName = col.ref[0] === "@" ? col.ref.slice(1) : col.ref;
          const refRows = Data.state.builderData[refName] || [];
          const validIds = new Set(refRows.map((r) => +r.Id));
          const allowZero = col.ref[0] === "@";
          list.forEach((r, i) => {
            if (!(col.field in r)) return;
            const v = r[col.field];
            if (v == null || v === "") return;
            const nv = +v; if (allowZero && nv === 0) return;
            if (!validIds.has(nv)) { refErr++; if (issues.length < cap) issues.push({ table: name, row: i + 1, type: "참조 오류", detail: `${col.field}=${v} → ${refName}에 없음` }); }
          });
        });
      }
    });
    return { issues: issues, total: dupes + empties + refErr, dupes: dupes, empties: empties, refErr: refErr, capped: (dupes + empties + refErr) > issues.length, tables: names.length };
  }

  // ---- 베이스라인 대비 변경점(diff) ----
  function diff(idx) {
    const list = baselines(); const b = list[idx]; if (!b) return null;
    const cur = Data.state.builderData, base = b.data || {};
    const names = [...new Set([...Object.keys(cur), ...Object.keys(base)].filter((k) => !k.startsWith("__")))].sort();
    const out = [];
    let tAdd = 0, tRem = 0, tChg = 0;
    names.forEach((name) => {
      const c = cur[name] || [], o = base[name] || [];
      const cById = {}, oById = {};
      c.forEach((r) => { cById[r.Id] = r; }); o.forEach((r) => { oById[r.Id] = r; });
      let added = 0, removed = 0, changed = 0; const changes = [];
      Object.keys(cById).forEach((id) => { if (!(id in oById)) added++; });
      Object.keys(oById).forEach((id) => { if (!(id in cById)) removed++; });
      Object.keys(cById).forEach((id) => {
        if (!(id in oById)) return;
        const cr = cById[id], or = oById[id]; const flds = [];
        const keys = new Set([...Object.keys(cr), ...Object.keys(or)]);
        keys.forEach((k) => { if (String(cr[k]) !== String(or[k])) flds.push(`${k}: ${or[k]}→${cr[k]}`); });
        if (flds.length) { changed++; if (changes.length < 10) changes.push({ id: id, flds: flds }); }
      });
      if (added || removed || changed) { out.push({ table: name, added: added, removed: removed, changed: changed, changes: changes }); tAdd += added; tRem += removed; tChg += changed; }
    });
    return { label: b.label, at: b.at, tables: out, tAdd: tAdd, tRem: tRem, tChg: tChg };
  }

  // ============================================================
  // 곡선 생성기 / 일괄 편집 / 열 설정 — 대상 열을 한 번에 채우거나 변환
  // ============================================================
  // 컬럼 타입에 맞춰 값 보정(불러온 테이블은 문자열 보존)
  function coerceCell(table, field, value) {
    if (isImported(table)) return String(value);
    const col = columns(table).find((c) => c.field === field);
    const t = (col ? col.type : "string").toLowerCase();
    if (t.startsWith("int")) return parseInt(value, 10) || 0;
    if (t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal")) return parseFloat(value) || 0;
    return value;
  }
  // 커스텀 수식 안전 평가(i·lvl·prev·base·ratio + 수학 함수)
  function evalFormula(expr, i, lvl, prev, base, ratio) {
    try {
      const fn = new Function("i", "lvl", "prev", "base", "ratio", "floor", "ceil", "round", "pow", "sqrt", "abs", "min", "max", "log", "log2", "log10",
        "return (" + String(expr) + ");");
      const v = fn(i, lvl, prev, base, ratio, Math.floor, Math.ceil, Math.round, Math.pow, Math.sqrt, Math.abs, Math.min, Math.max, Math.log,
        function (x) { return Math.log2(x); }, function (x) { return Math.log10(x); });
      return Number.isFinite(v) ? v : 0;
    } catch (e) { return 0; }
  }
  // 곡선 유형별 표시 수식
  function curveFormula(c) {
    const b = +c.base || 0, r = +c.ratio || 0;
    switch (c.type) {
      case "linear": return "floor(" + b + " + " + Math.round(b * (r - 1)) + " * i)";
      case "poly":   return "floor(" + b + " * pow(lvl, " + r + "))";
      case "log":    return "floor(" + b + " * (1 + " + (r - 1).toFixed(2) + " * log2(lvl)))";
      case "custom": return c.custom || "floor(base * pow(ratio, i))";
      default:       return "floor(" + b + " * pow(" + r + ", i))"; // exp
    }
  }
  // 곡선 값 배열 산출
  function curveValues(c) {
    const out = [], n = Math.max(0, Math.min(2000, +c.count || 0)), b = +c.base || 0, r = +c.ratio || 0;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const lvl = i + 1; let v;
      if (c.type === "custom") v = evalFormula(c.custom, i, lvl, prev, b, r);
      else if (c.type === "linear") v = b + b * (r - 1) * i;
      else if (c.type === "poly")   v = b * Math.pow(lvl, r);
      else if (c.type === "log")    v = b * (1 + (r - 1) * Math.log2(lvl));
      else                          v = b * Math.pow(r, i); // exp
      v = Math.floor(Number.isFinite(v) ? v : 0);
      out.push(v); prev = v;
    }
    return out;
  }
  // 곡선을 대상 열에 적용(행 수까지 행을 만들어 채움)
  function applyCurve(table, field, c) {
    if (!field) return { ok: false, msg: "대상 열이 없습니다." };
    ensure();
    const list = rows(table);
    const vals = curveValues(c);
    for (let i = 0; i < vals.length; i++) {
      if (!list[i]) {
        const row = blankRowFor(table);
        if ("Id" in row) row.Id = list.reduce((m, r) => Math.max(m, +r.Id || 0), 0) + 1;
        list.push(row);
      }
      list[i][field] = coerceCell(table, field, vals[i]);
    }
    audit("edit", table, null, field, "(곡선)", vals.length + "행");
    sync(table); Data.save();
    return { ok: true, count: vals.length, field: field };
  }
  // 일괄 산술 편집(×/＋/＝ + 반올림, 행 범위)
  function bulkEdit(table, field, op, val, round, fromRow, toRow) {
    if (!field) return { ok: false, msg: "대상 열이 없습니다." };
    const list = rows(table);
    const from = Math.max(0, (+fromRow || 1) - 1);
    const to = (+toRow > 0) ? Math.min(list.length, +toRow) : list.length;
    let n = 0;
    for (let i = from; i < to; i++) {
      let v = +list[i][field] || 0;
      if (op === "mul") v = v * (+val); else if (op === "add") v = v + (+val); else if (op === "set") v = +val;
      if (round === "floor") v = Math.floor(v); else if (round === "ceil") v = Math.ceil(v); else if (round === "round") v = Math.round(v);
      list[i][field] = coerceCell(table, field, v); n++;
    }
    audit("edit", table, null, field, "(일괄 " + op + ")", n + "행");
    sync(table); Data.save();
    return { ok: true, count: n };
  }
  // 열 전체(또는 빈 칸만) 같은 값으로 채우기
  function fillColumn(table, field, value, emptyOnly) {
    if (!field) return { ok: false };
    const list = rows(table); let n = 0;
    list.forEach((r) => {
      if (emptyOnly && r[field] != null && String(r[field]) !== "") return;
      r[field] = coerceCell(table, field, value); n++;
    });
    audit("edit", table, null, field, "(채우기)", n + "행");
    sync(table); Data.save();
    return { ok: true, count: n };
  }
  // 열 안에서 값 찾아 바꾸기(정확 일치)
  function replaceInColumn(table, field, find, rep) {
    if (!field) return { ok: false };
    const list = rows(table); let n = 0;
    list.forEach((r) => { if (String(r[field]) === String(find)) { r[field] = coerceCell(table, field, rep); n++; } });
    audit("edit", table, null, field, "(찾아바꾸기)", n + "행");
    sync(table); Data.save();
    return { ok: true, count: n };
  }

  // ============================================================
  // 열(컬럼) 수식 정의 / 이름·타입·삭제 — "열 설정" 컬럼 에디터
  // ============================================================
  // 행 단위 수식 평가 (i·lvl·prev·n + 수학함수 + colsum("열"))
  function evalColFormula(expr, i, lvl, prev, n, colsum) {
    try {
      const fn = new Function("i", "lvl", "prev", "n", "floor", "ceil", "round", "pow", "sqrt", "abs", "min", "max", "log", "log2", "log10", "colsum",
        "return (" + String(expr) + ");");
      const v = fn(i, lvl, prev, n, Math.floor, Math.ceil, Math.round, Math.pow, Math.sqrt, Math.abs, Math.min, Math.max, Math.log,
        function (x) { return Math.log2(x); }, function (x) { return Math.log10(x); }, colsum);
      return Number.isFinite(v) ? v : 0;
    } catch (e) { return 0; }
  }
  // 수식으로 열 값 배열 산출(소수 자릿수 반영) — 미리보기/적용 공용
  function colFormulaValues(table, formula, decimals) {
    const list = rows(table), n = list.length;
    const cs = function (nm) { let s = 0; list.forEach(function (r) { s += +r[nm] || 0; }); return s; };
    const d = Math.max(0, Math.min(6, +decimals || 0)), m = Math.pow(10, d);
    const out = []; let prev = 0;
    for (let i = 0; i < n; i++) {
      let v = evalColFormula(formula, i, i + 1, prev, n, cs);
      v = Math.round(v * m) / m;
      out.push(v); prev = v;
    }
    return out;
  }
  function applyColumnFormula(table, field, formula, decimals) {
    if (!field) return { ok: false, msg: "대상 열이 없습니다." };
    const list = rows(table), vals = colFormulaValues(table, formula, decimals);
    for (let i = 0; i < list.length; i++) list[i][field] = isImported(table) ? String(vals[i]) : vals[i];
    audit("edit", table, null, field, "(수식)", list.length + "행");
    sync(table); Data.save();
    return { ok: true, count: list.length };
  }
  // 스키마 테이블도 열 편집이 되도록 builderCols를 구체화(이 시점부터 해당 테이블은 커스텀 열)
  function ensureCols(table) {
    const st = Data.state;
    if (!st.builderCols) st.builderCols = {};
    if (!st.builderCols[table]) st.builderCols[table] = columns(table).map(function (c) { return { field: c.field, type: c.type, scope: c.scope || "Server", ref: c.ref || null }; });
    return st.builderCols[table];
  }
  function renameColumn(table, oldF, newF) {
    newF = String(newF == null ? "" : newF).trim();
    if (!newF || newF === oldF) return { ok: false };
    const cols = ensureCols(table);
    if (cols.some(function (c) { return c.field === newF; })) return { ok: false, msg: "이미 있는 열 이름" };
    const col = cols.find(function (c) { return c.field === oldF; }); if (!col) return { ok: false };
    col.field = newF;
    rows(table).forEach(function (r) { r[newF] = r[oldF]; delete r[oldF]; });
    sync(table); Data.save();
    return { ok: true, field: newF };
  }
  function setColumnType(table, field, type) {
    const col = ensureCols(table).find(function (c) { return c.field === field; }); if (!col) return { ok: false };
    col.type = type; sync(table); Data.save(); return { ok: true };
  }
  function deleteColumn(table, field) {
    const st = Data.state; ensureCols(table);
    st.builderCols[table] = st.builderCols[table].filter(function (c) { return c.field !== field; });
    rows(table).forEach(function (r) { delete r[field]; });
    sync(table); Data.save(); return { ok: true };
  }

  window.Builder = {
    seeds, ensure, rows, columns, isImported, addRow, deleteRow, dupRow, moveRow, setCell,
    curveFormula, curveValues, applyCurve, bulkEdit, fillColumn, replaceInColumn,
    colFormulaValues, applyColumnFormula, renameColumn, setColumnType, deleteColumn,
    refOptions, refLabel, tableCSV, downloadCSV, copyCSV, exportJSON, importJSON, importCSV, downloadAllZip,
    syncAll, isTable: (n) => !!S.tables[n], importedNames,
    patchCatalog, applyPatch, genContext, appendRows,
    baselines, saveBaseline, restoreBaseline, deleteBaseline,
    validate, diff, auditLog,
  };
})();
