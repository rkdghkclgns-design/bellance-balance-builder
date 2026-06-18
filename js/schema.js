/* ============================================================
   schema.js — ProjectA CSV 마스터/Define 전체 스키마 + 시드
   마스터 40종 + Define 19종. 각 컬럼은 4-Row 헤더용 정보를 보유.
   col(field, type, scope, ref) — type=C#타입(Row1), scope=Client/Server(Row2)
   ref = Define 테이블명(드롭다운 연결) | "@TableName" (마스터 FK 참고)
   ============================================================ */
(function () {
  "use strict";

  // ---- 컬럼 헬퍼 -----------------------------------------------
  function c(field, type, scope, ref) {
    return { field: field, type: type || "int", scope: scope || "Server", ref: ref || null };
  }
  function defOf(type) {
    const t = (type || "").toLowerCase();
    if (t.startsWith("int")) return 0;
    if (t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal")) return 0;
    if (t.startsWith("bool")) return false;
    if (t.startsWith("list")) return "";
    if (t.startsWith("datetime")) return "";
    return "";
  }

  // 표준 Define 컬럼(대부분 공통)
  const D = (extra) => [c("Id", "int", "Server"), c("EnumName", "string", "Server"), c("KorName", "string", "Client")].concat(extra || []);

  // ============================================================
  // Define 테이블 (enum)
  // ============================================================
  const defines = {
    ElementalDefine:       { columns: D() },
    RarityDefine:          { columns: D([c("StarCount", "int", "Client")]) },
    ClassDefine:           { columns: D() },
    RoleDefine:            { columns: D() },
    BattleLineDefine:      { columns: D() },
    SizeTypeDefine:        { columns: D() },
    SkillTypeDefine:       { columns: D() },
    ExecuteLocationDefine: { columns: D() },
    TargetTypeDefine:      { columns: D() },
    ScopeDefine:           { columns: D() },
    BuffDebuffTypeDefine:  { columns: D([c("IsPositive", "bool", "Server")]) },
    StatusEffectTypeDefine:{ columns: D() },
    AbnormalTypeDefine:    { columns: D() },
    PassiveTriggerTypeDefine:{ columns: D() },
    ConditionTypeDefine:   { columns: D() },
    ComparisonTypeDefine:  { columns: [c("Id", "int", "Server"), c("EnumName", "string", "Server"), c("Symbol", "string", "Client")] },
    TraitTypeDefine:       { columns: D() },
    ArtifactTargetDefine:  { columns: D() },
    GuideQuestTypeDefine:  { columns: D() },
    MonsterTypeDefine:     { columns: D() },
  };

  // ============================================================
  // 마스터 테이블
  // ============================================================
  const masters = {
    // ---- Unit -------------------------------------------------
    UnitMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Elemental","int","Server","ElementalDefine"), c("Rarity","int","Server","RarityDefine"),
      c("Class","int","Server","ClassDefine"), c("Role","int","Server","RoleDefine"), c("BattleLine","int","Server","BattleLineDefine"),
      c("BaseHp","int","Server"), c("BaseAtk","int","Server"), c("BaseDef","int","Server"),
      c("AtkSpeed","float","Server"), c("MaxLevel","int","Server"),
      c("BaseStar","int","Server"), c("MaxStar","int","Server"),
      c("BaseActiveSkillId","int","Server","@BaseActiveSkillMaster"),
      c("SpecialActiveSkillId","int","Server","@SpecialActiveSkillMaster"),
      c("PassiveSkillId","int","Server","@PassiveSkillMaster"),
      c("TraitId","int","Server","@TraitMaster"),
    ]},
    ThumbnailMaster: { columns: [
      c("Id","int","Server"), c("UnitId","int","Server","@UnitMaster"),
      c("SpriteName","string","Client"), c("AtlasName","string","Client"),
      c("X","int","Client"), c("Y","int","Client"), c("Width","int","Client"), c("Height","int","Client"),
    ]},
    LevelUPDeltaStatMaster: { columns: [
      c("Id","int","Server"), c("Class","int","Server","ClassDefine"),
      c("DeltaHp","int","Server"), c("DeltaAtk","int","Server"), c("DeltaDef","int","Server"),
    ]},
    UnitLevelUpCostMaster: { columns: [
      c("Id","int","Server"), c("Level","int","Server"), c("Gold","int","Server"), c("Exp","int","Server"),
    ]},
    StarUpCostMaster: { columns: [
      c("Id","int","Server"), c("FromStar","int","Server"), c("ToStar","int","Server"),
      c("Gold","int","Server"), c("Shard","int","Server"),
    ]},
    StarUpDeltaStatMaster: { columns: [
      c("Id","int","Server"), c("Star","int","Server"),
      c("HpPermille","int","Server"), c("AtkPermille","int","Server"), c("DefPermille","int","Server"),
    ]},

    // ---- Skill ------------------------------------------------
    BaseActiveSkillMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("SkillType","int","Server","SkillTypeDefine"),
      c("ExecuteLocation","int","Server","ExecuteLocationDefine"),
      c("TargetType","int","Server","TargetTypeDefine"), c("Scope","int","Server","ScopeDefine"),
      c("Cooldown","float","Server"), c("BaseDamageRatio","int","Server"), c("MaxLevel","int","Server"),
    ]},
    BaseActiveSkillLevelUpCostMaster: { columns: [
      c("Id","int","Server"), c("SkillId","int","Server","@BaseActiveSkillMaster"),
      c("Level","int","Server"), c("Gold","int","Server"), c("Book","int","Server"),
    ]},
    BaseActiveSkillLevelUpDeltaMaster: { columns: [
      c("Id","int","Server"), c("SkillId","int","Server","@BaseActiveSkillMaster"),
      c("Level","int","Server"), c("DamageRatioDelta","int","Server"),
    ]},
    SpecialActiveSkillMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("SkillType","int","Server","SkillTypeDefine"),
      c("ExecuteLocation","int","Server","ExecuteLocationDefine"),
      c("TargetType","int","Server","TargetTypeDefine"), c("Scope","int","Server","ScopeDefine"),
      c("Cooldown","float","Server"), c("BaseDamageRatio","int","Server"),
      c("BuffDebuffGroupId","int","Server","@BuffDebuffGroupMaster"), c("MaxLevel","int","Server"),
    ]},
    SpecialActiveSkillLevelUpCostMaster: { columns: [
      c("Id","int","Server"), c("SkillId","int","Server","@SpecialActiveSkillMaster"),
      c("Level","int","Server"), c("Gold","int","Server"), c("Book","int","Server"),
    ]},
    SpecialActiveSkillLevelUpDeltaMaster: { columns: [
      c("Id","int","Server"), c("SkillId","int","Server","@SpecialActiveSkillMaster"),
      c("Level","int","Server"), c("DamageRatioDelta","int","Server"), c("BuffValueDelta","int","Server"),
    ]},
    PassiveSkillMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("PassiveTriggerType","int","Server","PassiveTriggerTypeDefine"),
      c("ConditionType","int","Server","ConditionTypeDefine"),
      c("ComparisonType","int","Server","ComparisonTypeDefine"), c("ConditionValue","int","Server"),
      c("TargetType","int","Server","TargetTypeDefine"),
      c("PermanentBuffDebuffId","int","Server","@PermanentBuffDebuffMaster"), c("MaxLevel","int","Server"),
    ]},
    PassiveSkillLevelUpCostMaster: { columns: [
      c("Id","int","Server"), c("SkillId","int","Server","@PassiveSkillMaster"),
      c("Level","int","Server"), c("Gold","int","Server"), c("Book","int","Server"),
    ]},
    PassiveSkillLevelUpDeltaMaster: { columns: [
      c("Id","int","Server"), c("SkillId","int","Server","@PassiveSkillMaster"),
      c("Level","int","Server"), c("EffectPercentDelta","int","Server"),
    ]},
    TraitMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("TraitType","int","Server","TraitTypeDefine"), c("BaseDamageRatio","int","Server"),
      c("BaseSkillId","int","Server","@BaseActiveSkillMaster"), c("MaxLevel","int","Server"),
    ]},
    TraitLevelUpCostMaster: { columns: [
      c("Id","int","Server"), c("TraitId","int","Server","@TraitMaster"),
      c("Level","int","Server"), c("Gold","int","Server"), c("Book","int","Server"),
    ]},
    TraitSkillLevelUpDeltaMaster: { columns: [
      c("Id","int","Server"), c("TraitId","int","Server","@TraitMaster"),
      c("Level","int","Server"), c("EffectDelta","int","Server"),
    ]},

    // ---- Buff/Debuff ------------------------------------------
    BuffDebuffMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("BuffDebuffType","int","Server","BuffDebuffTypeDefine"),
      c("StatusEffectType","int","Server","StatusEffectTypeDefine"),
      c("Duration","int","Server"), c("MaxStack","int","Server"), c("Value","int","Server"),
    ]},
    BuffDebuffGroupMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("BuffDebuffId1","int","Server","@BuffDebuffMaster"),
      c("BuffDebuffId2","int","Server","@BuffDebuffMaster"),
      c("BuffDebuffId3","int","Server","@BuffDebuffMaster"),
    ]},
    PermanentBuffDebuffMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("BuffDebuffType","int","Server","BuffDebuffTypeDefine"),
      c("StatusEffectType","int","Server","StatusEffectTypeDefine"),
      c("StackLimit","int","Server"), c("Value","int","Server"),
    ]},
    CrowdControlMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("AbnormalType","int","Server","AbnormalTypeDefine"),
      c("Duration","int","Server"), c("Accuracy","int","Server"),
    ]},
    DotHotMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("BuffDebuffType","int","Server","BuffDebuffTypeDefine"),
      c("Duration","int","Server"), c("TickValue","int","Server"), c("Accuracy","int","Server"),
    ]},

    // ---- Artifact ---------------------------------------------
    ArtifactMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Rarity","int","Server","RarityDefine"), c("MaxLevel","int","Server"),
      c("ArtifactTarget","int","Server","ArtifactTargetDefine"),
      c("StatusEffectType1","int","Server","StatusEffectTypeDefine"), c("Value1","int","Server"),
      c("StatusEffectType2","int","Server","StatusEffectTypeDefine"), c("Value2","int","Server"),
    ]},
    ArtifactLevelUpCostMaster: { columns: [
      c("Id","int","Server"), c("ArtifactId","int","Server","@ArtifactMaster"), c("Level","int","Server"),
      c("Ore","int","Server"), c("Steel","int","Server"), c("Gold","int","Server"), c("Essence","int","Server"),
    ]},
    ArtifactLevelUPDeltaStatMaster: { columns: [
      c("Id","int","Server"), c("Rarity","int","Server","RarityDefine"),
      c("Level","int","Server"), c("DeltaValue","int","Server"),
    ]},
    ArtifactStarUpCostMaster: { columns: [
      c("Id","int","Server"), c("FromStar","int","Server"), c("ToStar","int","Server"),
      c("Gold","int","Server"), c("Essence","int","Server"),
    ]},
    ArtifactStarUpDeltaStatMaster: { columns: [
      c("Id","int","Server"), c("Star","int","Server"), c("ValuePermille","int","Server"),
    ]},

    // ---- Monster ----------------------------------------------
    MonsterMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Elemental","int","Server","ElementalDefine"), c("Class","int","Server","ClassDefine"),
      c("Role","int","Server","RoleDefine"),
      c("Type","int","Server","MonsterTypeDefine"), c("SizeType","int","Server","SizeTypeDefine"),
      c("Hp","int","Server"), c("Atk","int","Server"), c("Def","int","Server"),
      c("AtkSpeed","float","Server"), c("SkillId","int","Server","@SpecialActiveSkillMaster"),
      c("IsBoss","bool","Server"),
    ]},
    MonsterGroupMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("FrontSlot1","int","Server","@MonsterMaster"), c("FrontSlot2","int","Server","@MonsterMaster"), c("FrontSlot3","int","Server","@MonsterMaster"),
      c("MiddleSlot1","int","Server","@MonsterMaster"), c("MiddleSlot2","int","Server","@MonsterMaster"), c("MiddleSlot3","int","Server","@MonsterMaster"),
      c("BackSlot1","int","Server","@MonsterMaster"), c("BackSlot2","int","Server","@MonsterMaster"), c("BackSlot3","int","Server","@MonsterMaster"),
    ]},

    // ---- Stage / Dungeon --------------------------------------
    StageMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Chapter","int","Server"), c("StageNo","int","Server"),
      c("MonsterGroupId1","int","Server","@MonsterGroupMaster"),
      c("MonsterGroupId2","int","Server","@MonsterGroupMaster"),
      c("MonsterGroupId3","int","Server","@MonsterGroupMaster"),
      c("ClearRewardId","int","Server","@ClearRewardMaster"),
      c("StaminaCost","int","Server"), c("RecommendPower","int","Server"),
    ]},
    MaterialDungeonMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Chapter","int","Server"), c("StageNo","int","Server"),
      c("MonsterGroupId1","int","Server","@MonsterGroupMaster"),
      c("MonsterGroupId2","int","Server","@MonsterGroupMaster"),
      c("ClearRewardId","int","Server","@ClearRewardMaster"),
      c("StaminaCost","int","Server"), c("RecommendPower","int","Server"),
    ]},
    GoldDungeonMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Chapter","int","Server"), c("StageNo","int","Server"),
      c("MonsterGroupId1","int","Server","@MonsterGroupMaster"),
      c("MonsterGroupId2","int","Server","@MonsterGroupMaster"),
      c("ClearRewardId","int","Server","@ClearRewardMaster"),
      c("StaminaCost","int","Server"), c("RecommendPower","int","Server"),
    ]},
    ExpDungeonMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("Chapter","int","Server"), c("StageNo","int","Server"),
      c("MonsterGroupId1","int","Server","@MonsterGroupMaster"),
      c("MonsterGroupId2","int","Server","@MonsterGroupMaster"),
      c("ClearRewardId","int","Server","@ClearRewardMaster"),
      c("StaminaCost","int","Server"), c("RecommendPower","int","Server"),
    ]},
    ClearRewardMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("ItemId1","int","Server","@ItemMaster"), c("Count1","int","Server"),
      c("ItemId2","int","Server","@ItemMaster"), c("Count2","int","Server"),
      c("ItemId3","int","Server","@ItemMaster"), c("Count3","int","Server"),
      c("DropRate","int","Server"),
    ]},

    // ---- Gacha ------------------------------------------------
    GachaDisplayMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("GachaId","int","Server","@GachaMaster"),
      c("StartDate","DateTime","Server"), c("EndDate","DateTime","Server"),
      c("Price","int","Client"), c("PityCount","int","Server"),
    ]},
    GachaMaster: { columns: [
      c("Id","int","Server"), c("GroupId","int","Server"),
      c("TargetUnitId","int","Server","@UnitMaster"),
      c("Rarity","int","Server","RarityDefine"), c("Rate","int","Server"),
    ]},
    GachaPityGroupMaster: { columns: [
      c("Id","int","Server"), c("GachaId","int","Server","@GachaMaster"),
      c("GuaranteedUnitId","int","Server","@UnitMaster"),
      c("GuaranteedRarity","int","Server","RarityDefine"),
    ]},

    // ---- Item -------------------------------------------------
    ItemMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"), c("IconName","string","Client"),
      c("Rarity","int","Server","RarityDefine"), c("ItemType","string","Server"),
      c("MaxStack","int","Server"), c("SellPrice","int","Server"),
    ]},

    // ---- Quest ------------------------------------------------
    GuideQuestMaster: { columns: [
      c("Id","int","Server"), c("NameId","string","Client"),
      c("GuideQuestType","int","Server","GuideQuestTypeDefine"), c("TargetValue","int","Server"),
      c("RewardItemId","int","Server","@ItemMaster"), c("RewardCount","int","Server"),
    ]},
  };

  // 도메인 구성(좌측 내비 순서/색)
  const domains = [
    { key: "Unit",   label: "Unit · 유닛",        color: "#3b6ea5", tables: ["UnitMaster","ThumbnailMaster","LevelUPDeltaStatMaster","UnitLevelUpCostMaster","StarUpCostMaster","StarUpDeltaStatMaster"] },
    { key: "Skill",  label: "Skill · 스킬",        color: "#3f8f5b", tables: ["BaseActiveSkillMaster","BaseActiveSkillLevelUpCostMaster","BaseActiveSkillLevelUpDeltaMaster","SpecialActiveSkillMaster","SpecialActiveSkillLevelUpCostMaster","SpecialActiveSkillLevelUpDeltaMaster","PassiveSkillMaster","PassiveSkillLevelUpCostMaster","PassiveSkillLevelUpDeltaMaster","TraitMaster","TraitLevelUpCostMaster","TraitSkillLevelUpDeltaMaster"] },
    { key: "Buff",   label: "Buff/Debuff · 버프",  color: "#b0556b", tables: ["BuffDebuffMaster","BuffDebuffGroupMaster","PermanentBuffDebuffMaster","CrowdControlMaster","DotHotMaster"] },
    { key: "Artifact", label: "Artifact · 아티팩트", color: "#b7912f", tables: ["ArtifactMaster","ArtifactLevelUpCostMaster","ArtifactLevelUPDeltaStatMaster","ArtifactStarUpCostMaster","ArtifactStarUpDeltaStatMaster"] },
    { key: "Monster", label: "Monster · 몬스터",   color: "#8e6fb0", tables: ["MonsterMaster","MonsterGroupMaster"] },
    { key: "Stage",  label: "Stage/Dungeon · 스테이지", color: "#4a7c9b", tables: ["StageMaster","MaterialDungeonMaster","GoldDungeonMaster","ExpDungeonMaster","ClearRewardMaster"] },
    { key: "Gacha",  label: "Gacha · 가챠",        color: "#c07a3e", tables: ["GachaDisplayMaster","GachaMaster","GachaPityGroupMaster"] },
    { key: "Item",   label: "Item · 아이템",       color: "#5b7a8c", tables: ["ItemMaster"] },
    { key: "Quest",  label: "Quest · 퀘스트",      color: "#6b8e3f", tables: ["GuideQuestMaster"] },
    { key: "Define", label: "Define · 열거형",     color: "#5b6570", tables: Object.keys(defines) },
  ];

  // 테이블 → 한 줄 설명(이미지 기반)
  const desc = {
    UnitMaster:"유닛 기본 정보 (원소·레어도·클래스·기본 스탯·스킬 참조)",
    ThumbnailMaster:"유닛 썸네일 스프라이트 매핑",
    LevelUPDeltaStatMaster:"레벨업 시 클래스 HP/ATK/DEF 증가량",
    UnitLevelUpCostMaster:"레벨업 소모 비용 (레벨→비용)",
    StarUpCostMaster:"성급 업 소모 비용",
    StarUpDeltaStatMaster:"성급 업 스탯 배율 (Permille 단위)",
    BaseActiveSkillMaster:"기본 액티브 스킬 정의 (타겟·범위·스킬 타입)",
    BaseActiveSkillLevelUpCostMaster:"기본 스킬 레벨업 골드/북 비용",
    BaseActiveSkillLevelUpDeltaMaster:"기본 스킬 레벨별 데미지율 증가",
    SpecialActiveSkillMaster:"스페셜 액티브 스킬 정의 (쿨턴·버프/CC 연결)",
    SpecialActiveSkillLevelUpCostMaster:"스페셜 스킬 레벨업 골드/북 비용",
    SpecialActiveSkillLevelUpDeltaMaster:"스페셜 스킬 레벨별 데미지율·버프값 증가",
    PassiveSkillMaster:"패시브 스킬 정의 (트리거·조건·영구버프 연결)",
    PassiveSkillLevelUpCostMaster:"패시브 스킬 레벨업 골드/북 비용",
    PassiveSkillLevelUpDeltaMaster:"패시브 스킬 레벨별 효과량 증가율",
    TraitMaster:"특성(Trait) 정의 (타입·기본 데미지율·기본 스킬 연결)",
    TraitLevelUpCostMaster:"특성 레벨업 골드/북 비용",
    TraitSkillLevelUpDeltaMaster:"특성 레벨별 효과율 증가",
    BuffDebuffMaster:"버프/디버프 정의 (지속 턴·최대 스택·스탯 효과)",
    BuffDebuffGroupMaster:"버프/디버프 묶음 그룹 (최대 3개 연결)",
    PermanentBuffDebuffMaster:"영구 버프/디버프 정의 (스택 제한·스탯 효과)",
    CrowdControlMaster:"군중제어(CC) 효과 정의 (타입·지속 턴·적중률)",
    DotHotMaster:"DoT/HoT 효과 정의 (지속 턴·효과값·적중률)",
    ArtifactMaster:"아티팩트 기본 정의 (레어도·최대 레벨·효과 타입·값)",
    ArtifactLevelUpCostMaster:"아티팩트 레벨업 재료별 비용 (Ore/Steel/Gold/Essence)",
    ArtifactLevelUPDeltaStatMaster:"아티팩트 레어도별 레벨별 스탯 증가량",
    ArtifactStarUpCostMaster:"아티팩트 성급 업 비용",
    ArtifactStarUpDeltaStatMaster:"아티팩트 성급 업 배율 (Permille 단위)",
    MonsterMaster:"몬스터 기본 스탯·스킬·원소·크기·보스 여부",
    MonsterGroupMaster:"전투 배치 그룹 (Front/Middle/Back 라인 × 3슬롯)",
    StageMaster:"메인 스테이지 (챕터·웨이브 구성·보상 그룹)",
    MaterialDungeonMaster:"재료 던전 스테이지 구성",
    GoldDungeonMaster:"골드 던전 스테이지 구성",
    ExpDungeonMaster:"경험치 던전 스테이지 구성",
    ClearRewardMaster:"클리어 보상 드롭 그룹 → 아이템·수량 목록",
    GachaDisplayMaster:"가챠 배너 표시 정보 (기간·가격·천장 설정)",
    GachaMaster:"가챠 그룹별 확률·타겟 유닛 정의",
    GachaPityGroupMaster:"천장 도달 시 확정 배출 풀",
    ItemMaster:"아이템 기본 정의 (이름·아이콘·레어도)",
    GuideQuestMaster:"가이드 퀘스트 (타입·목표값·보상 아이템·수량)",
    ElementalDefine:"원소 속성 enum", RarityDefine:"레어도 등급 enum", ClassDefine:"유닛·몬스터 클래스 enum",
    RoleDefine:"전투 역할 enum (공격형/방어형/지원형/회복형)",
    BattleLineDefine:"전투 라인 배치 위치 enum", SizeTypeDefine:"몬스터 크기 enum", SkillTypeDefine:"스킬 유형 enum",
    ExecuteLocationDefine:"스킬 발동 위치 enum", TargetTypeDefine:"스킬 대상 타입 enum", ScopeDefine:"스킬 범위 enum",
    BuffDebuffTypeDefine:"버프·디버프 유형 enum", StatusEffectTypeDefine:"스탯 효과 대상 enum (HP/ATK/DEF…)",
    AbnormalTypeDefine:"군중제어 이상 상태 enum", PassiveTriggerTypeDefine:"패시브 발동 트리거 enum",
    ConditionTypeDefine:"패시브 발동 조건 타입 enum", ComparisonTypeDefine:"조건 비교 연산자 enum",
    TraitTypeDefine:"특성 타입 enum", ArtifactTargetDefine:"아티팩트 적용 대상 enum",
    GuideQuestTypeDefine:"가이드 퀘스트 분류 enum", MonsterTypeDefine:"몬스터 종류 enum (일반/보스 등)",
  };

  // 전체 테이블 통합(kind 부여)
  const tables = {};
  Object.keys(masters).forEach((k) => { tables[k] = { kind: "master", columns: masters[k].columns, desc: desc[k] || "" }; });
  Object.keys(defines).forEach((k) => { tables[k] = { kind: "define", columns: defines[k].columns, desc: desc[k] || "" }; });

  // 빈 행 생성(기본값)
  function blankRow(tableName) {
    const t = tables[tableName];
    const o = {};
    t.columns.forEach((col) => { o[col.field] = defOf(col.type); });
    return o;
  }

  window.Schema = { domains, tables, defines, masters, desc, blankRow, defOf };
})();
