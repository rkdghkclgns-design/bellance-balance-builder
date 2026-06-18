/* ============================================================
   units.js — 유닛 스탯 계산 엔진
   등급 · 역할 · 성급강화 · 유니크 검증
   ============================================================ */
(function () {
  "use strict";

  function ds() { return Data.state.unitDesign; }

  function getUnitById(id) {
    const units = ds().units;
    return units.find(function (u) { return u.id === id; }) || units[0];
  }

  /**
   * HP / ATK / DEF / SPD + 고정 4종(CritRate/CritDmg/DefPen/CritRes) 계산
   * - HP·ATK·DEF : 레벨 + 성급강화로 증가 (복리)
   * - SPD        : 유닛 개별 base + 개별 perLevel 성장
   * - 나머지 4종 : 유닛 고정값 (변동 없음)
   */
  function calcStats(unit, level, star) {
    var d   = ds();
    var grade = d.grades[unit.grade] || d.grades.R;
    var role  = d.roles[unit.role]   || d.roles.attacker;
    var ref   = d.baseRef;
    var pl    = d.perLevelRef;
    var ss    = d.starSystem;

    // 범위 클램프
    var maxStar = grade.maxStar || ss.maxSteps;
    var lv = Math.max(1, Math.min(+(level) || 1, grade.maxLevel));
    var st = Math.max(0, Math.min(+(star)  || 0, maxStar));
    var lv0 = lv - 1; // 레벨 보너스 구간 (Lv1 = 0)

    // Lv1 · ★0 기준값 = round(기준 × 등급배율 × 역할배율) + 개인 오프셋
    var off  = unit.offset || {};
    var baseHP  = Math.round(ref.hp  * grade.baseMult * role.hpMult)  + (off.hp  || 0);
    var baseATK = Math.round(ref.atk * grade.baseMult * role.atkMult) + (off.atk || 0);
    var baseDEF = Math.round(ref.def * grade.baseMult * role.defMult) + (off.def || 0);

    // 레벨 성장 (역할 배율 동일 적용 / 등급 간 차이 없음)
    var hpL  = baseHP  + Math.round(pl.hp  * role.hpMult  * lv0);
    var atkL = baseATK + Math.round(pl.atk * role.atkMult * lv0);
    var defL = baseDEF + Math.round(pl.def * role.defMult * lv0);

    // 성급강화 복리 배율 : (1 + multPerStep)^star
    var sm = Math.pow(1 + ss.multPerStep, st);

    // SPD : 유닛 개별 초기값 + 유닛 개별 레벨당 성장
    var spdObj = unit.spd || {};
    var spd = Math.round((spdObj.base || 80) + (spdObj.perLevel || 0) * lv0);

    var fx = unit.fixed || {};
    return {
      hp:       Math.round(hpL  * sm),
      atk:      Math.round(atkL * sm),
      def:      Math.round(defL * sm),
      spd:      spd,
      critRate: fx.critRate  != null ? fx.critRate  : 0,
      critDmg:  fx.critDmg   != null ? fx.critDmg   : 150,
      defPen:   fx.defPen    != null ? fx.defPen    : 0,
      critRes:  fx.critRes   != null ? fx.critRes   : 0,
    };
  }

  /** Lv1 · ★0 초기 스탯 */
  function calcInitStats(unit) { return calcStats(unit, 1, 0); }

  /** 최대레벨 · 최대성급 스탯 */
  function calcMaxStats(unit) {
    var d = ds();
    var g = d.grades[unit.grade] || d.grades.R;
    return calcStats(unit, g.maxLevel, g.maxStar || d.starSystem.maxSteps);
  }

  /** ★0 → targetStar 누적 조각 비용 */
  function shardCostTo(unit, targetStar) {
    var sc = (ds().starSystem.shardCosts || {})[unit.grade] || [];
    var total = 0;
    for (var i = 0; i < targetStar && i < sc.length; i++) total += (sc[i] || 0);
    return total;
  }

  /**
   * 유니크 검증
   * HP·ATK·DEF 세 값이 모두 같은 유닛 쌍을 찾아 반환
   * type: "init" | "max"
   */
  function checkUniqueness() {
    var units = ds().units;
    var conflicts = [];
    function eq(a, b) { return a.hp === b.hp && a.atk === b.atk && a.def === b.def; }
    for (var i = 0; i < units.length; i++) {
      for (var j = i + 1; j < units.length; j++) {
        if (eq(calcInitStats(units[i]), calcInitStats(units[j])))
          conflicts.push({ type: "init", a: units[i].name, b: units[j].name });
        if (eq(calcMaxStats(units[i]),  calcMaxStats(units[j])))
          conflicts.push({ type: "max",  a: units[i].name, b: units[j].name });
      }
    }
    return conflicts;
  }

  window.Units = {
    calcStats: calcStats,
    calcInitStats: calcInitStats,
    calcMaxStats: calcMaxStats,
    shardCostTo: shardCostTo,
    checkUniqueness: checkUniqueness,
    getUnitById: getUnitById,
  };
})();
