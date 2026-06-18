/* ============================================================
   render_units.js — 유닛 설계 탭 렌더
   ============================================================ */
(function () {
  "use strict";

  var R     = window.Render;
  var fmt   = R.fmt;
  var esc   = R.escapeHtml;

  var GRADES    = ["R", "SR", "SSR"];
  var GRADE_C   = { R: "#5b6570", SR: "#2563eb", SSR: "#b7791f" };
  var ROLE_KEYS = ["tank", "attacker", "mage", "support", "assassin"];

  /* ── 헬퍼 ─────────────────────────────────────────────── */
  function ed(path, val, step, w) {
    var sw = w ? " style=\"width:" + w + "px\"" : "";
    return "<td class=\"edit num\"><input type=\"number\" data-path=\"" + path + "\" value=\"" + val + "\" step=\"" + (step || 1) + "\"" + sw + "></td>";
  }

  function bdg(label, color) {
    return "<span class=\"badge\" style=\"background:" + color + "22;color:" + color + "\">" + label + "</span>";
  }

  /* ── 섹션 1 : 등급 시스템 ──────────────────────────────── */
  function secGrades(d) {
    var rows = GRADES.map(function (g) {
      var gr   = d.grades[g];
      var prev = g === "R" ? null : g === "SR" ? d.grades.R.baseMult : d.grades.SR.baseMult;
      var diff = prev ? "+" + ((gr.baseMult / prev - 1) * 100).toFixed(1) + "%" : "기준";
      return "<tr><td class=\"l\">" + bdg(g, GRADE_C[g]) + "</td>" +
        ed("unitDesign.grades." + g + ".maxLevel", gr.maxLevel, 1) +
        ed("unitDesign.grades." + g + ".maxStar", gr.maxStar || 10, 1) +
        ed("unitDesign.grades." + g + ".baseMult", gr.baseMult, 0.005) +
        "<td class=\"num muted\">" + diff + "</td></tr>";
    }).join("");
    return "<table class=\"grid\" style=\"max-width:480px\">" +
      "<thead><tr><th class=\"l\">\ub4f1\uae09</th><th class=\"num\">\ucd5c\ub300 \ub808\ubca8</th><th class=\"num\">\ucd5c\ub300 \uc131\uae09</th><th class=\"num\">\uae30\uc900 \ubc30\uc728</th><th class=\"num\">\uc804\ub4f1\uae09 \ub300\ube44</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      "<div class=\"hint\">R 50/\u260510 \u00b7 SR 70/\u260520 \u00b7 SSR 100/\u260530 \u00b7 \uac12 \uc9c1\uc811 \uc218\uc815 \uac00\ub2a5</div>";
  }

  /* ── 섹션 2 : 성급강화 시스템 ─────────────────────────── */
  function secStarSystem(d) {
    var ss  = d.starSystem;
    var tot = Math.pow(1 + ss.multPerStep, ss.maxSteps);
    return "<table class=\"grid\" style=\"max-width:380px\">" +
      "<thead><tr><th class=\"l\">항목</th><th class=\"num\">값</th></tr></thead>" +
      "<tbody>" +
      "<tr><td class=\"l\">최대 강화 단계</td>" + ed("unitDesign.starSystem.maxSteps", ss.maxSteps, 1) + "</tr>" +
      "<tr><td class=\"l\">단계당 증가율 (복리)</td>" + ed("unitDesign.starSystem.multPerStep", ss.multPerStep, 0.01) + "</tr>" +
      "<tr><td class=\"l muted\">최대단계 누적 배율</td><td class=\"num total\">×" + tot.toFixed(4) + "</td></tr>" +
      "</tbody></table>" +
      "<div class=\"hint\">HP · ATK · DEF 에만 적용 · 공식 : (1 + 단계당증가율) ^ 강화단계</div>";
  }

  /* ── 섹션 3 : 역할별 스탯 배율 (사용자 직접 설정) ──────── */
  function secRoles(d) {
    var rows = ROLE_KEYS.map(function (k) {
      var r = d.roles[k]; if (!r) return "";
      var avg = ((r.hpMult + r.atkMult + r.defMult) / 3 * 100).toFixed(0);
      return "<tr><td class=\"l\">" + r.label + "</td>" +
        ed("unitDesign.roles." + k + ".hpMult",  r.hpMult,  0.05) +
        ed("unitDesign.roles." + k + ".atkMult", r.atkMult, 0.05) +
        ed("unitDesign.roles." + k + ".defMult", r.defMult, 0.05) +
        "<td class=\"num muted\">" + avg + "%</td></tr>";
    }).join("");
    return "<table class=\"grid\">" +
      "<thead><tr><th class=\"l\">역할</th><th class=\"num\">HP 배율</th><th class=\"num\">ATK 배율</th><th class=\"num\">DEF 배율</th><th class=\"num\">평균</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      "<div class=\"hint\">Lv1 기준값과 레벨당 성장 두 곳에 동일하게 적용됩니다. 등급 간 배율 차이는 없습니다.</div>";
  }

  /* ── 섹션 4 : 기준 스탯 & 레벨당 성장 ─────────────────── */
  function secBaseRef(d) {
    var ref = d.baseRef, pl = d.perLevelRef;
    return "<table class=\"grid\" style=\"max-width:460px\">" +
      "<thead><tr><th class=\"l\">스탯</th><th class=\"num\">Lv1 기준값 (R등급·보정전)</th><th class=\"num\">레벨당 성장</th></tr></thead>" +
      "<tbody>" +
      "<tr><td class=\"l\">HP</td>"  + ed("unitDesign.baseRef.hp",     ref.hp,  100) + ed("unitDesign.perLevelRef.hp", pl.hp,  5)  + "</tr>" +
      "<tr><td class=\"l\">ATK</td>" + ed("unitDesign.baseRef.atk",    ref.atk,  10) + ed("unitDesign.perLevelRef.atk", pl.atk, 1) + "</tr>" +
      "<tr><td class=\"l\">DEF</td>" + ed("unitDesign.baseRef.def",    ref.def,   5) + ed("unitDesign.perLevelRef.def", pl.def, 1) + "</tr>" +
      "</tbody></table>" +
      "<div class=\"hint\">레벨당 성장은 모든 등급에 동일. 등급 차이는 최대레벨과 기준배율로만 표현됩니다.</div>";
  }

  /* ── 섹션 5 : 성급강화 조각 비용 ──────────────────────── */
  function secShardCosts(d) {
    var ss = d.starSystem, sc = ss.shardCosts || {};
    var heads = GRADES.map(function (g) {
      return "<th class=\"num\">" + bdg(g, GRADE_C[g]) + " 조각수</th>";
    }).join("");
    var rows = Array.from({ length: ss.maxSteps }, function (_, i) {
      var cells = GRADES.map(function (g) {
        return ed("unitDesign.starSystem.shardCosts." + g + "." + i, (sc[g] || [])[i] || 0, 1);
      }).join("");
      var mult = Math.pow(1 + ss.multPerStep, i + 1);
      return "<tr><td class=\"l\">★" + (i + 1) + " 단계</td>" + cells +
        "<td class=\"num muted\">×" + mult.toFixed(3) + "</td></tr>";
    }).join("");
    return "<table class=\"grid\">" +
      "<thead><tr><th class=\"l\">강화 단계</th>" + heads + "<th class=\"num\">누적 배율</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>";
  }

  /* ── 섹션 6 : 유닛 명부 ────────────────────────────────── */
  function secRoster(d) {
    var rows = d.units.map(function (u) {
      var role = d.roles[u.role] || {};
      var init = Units.calcInitStats(u);
      var mx   = Units.calcMaxStats(u);
      var maxLv = (d.grades[u.grade] || {}).maxLevel || "?";
      return "<tr>" +
        "<td class=\"l\"><b>" + esc(u.name) + "</b></td>" +
        "<td class=\"l\">" + bdg(u.grade, GRADE_C[u.grade]) + "</td>" +
        "<td class=\"l\">" + (role.label || u.role) + "</td>" +
        "<td class=\"num\">" + fmt(init.hp)  + "</td>" +
        "<td class=\"num\">" + fmt(init.atk) + "</td>" +
        "<td class=\"num\">" + fmt(init.def) + "</td>" +
        "<td class=\"num\">" + init.spd      + "</td>" +
        "<td class=\"num\">" + fmt(mx.hp)    + "</td>" +
        "<td class=\"num\">" + fmt(mx.atk)   + "</td>" +
        "<td class=\"num\">" + fmt(mx.def)   + "</td>" +
        "<td class=\"num\">" + mx.spd        + "</td>" +
        "<td class=\"num muted\">" + maxLv   + "</td>" +
        "</tr>";
    }).join("");
    return "<div style=\"overflow-x:auto\"><table class=\"grid\">" +
      "<thead>" +
      "<tr>" +
        "<th class=\"l\" rowspan=\"2\">유닛명</th>" +
        "<th class=\"l\" rowspan=\"2\">등급</th>" +
        "<th class=\"l\" rowspan=\"2\">역할</th>" +
        "<th class=\"num\" colspan=\"4\" style=\"background:#e8f0fe;color:#2563eb\">Lv1 · ★0 (초기)</th>" +
        "<th class=\"num\" colspan=\"4\" style=\"background:#fcebe9;color:#b7791f\">최대레벨 · 최대★ (등급별)</th>" +
        "<th class=\"num\" rowspan=\"2\">최대레벨</th>" +
      "</tr>" +
      "<tr>" +
        "<th class=\"num\" style=\"background:#e8f0fe\">HP</th>" +
        "<th class=\"num\" style=\"background:#e8f0fe\">ATK</th>" +
        "<th class=\"num\" style=\"background:#e8f0fe\">DEF</th>" +
        "<th class=\"num\" style=\"background:#e8f0fe\">SPD</th>" +
        "<th class=\"num\" style=\"background:#fcebe9\">HP</th>" +
        "<th class=\"num\" style=\"background:#fcebe9\">ATK</th>" +
        "<th class=\"num\" style=\"background:#fcebe9\">DEF</th>" +
        "<th class=\"num\" style=\"background:#fcebe9\">SPD</th>" +
      "</tr>" +
      "</thead>" +
      "<tbody>" + rows + "</tbody>" +
      "</table></div>";
  }

  /* ── 섹션 7 : 스탯 시뮬레이터 ─────────────────────────── */
  function secSimulator(d) {
    var simId   = d.simUnit || (d.units[0] && d.units[0].id) || "";
    var simUnit = Units.getUnitById(simId);
    var maxLv   = (d.grades[simUnit.grade] || {}).maxLevel || 100;
    var maxStar = (d.grades[simUnit.grade] || {}).maxStar || d.starSystem.maxSteps;
    var simLv   = Math.max(1,   Math.min(d.simLevel || 1,   maxLv));
    var simStar = Math.max(0,   Math.min(d.simStar  || 0,   maxStar));
    var stats   = Units.calcStats(simUnit, simLv, simStar);
    var shards  = Units.shardCostTo(simUnit, simStar);
    var role    = d.roles[simUnit.role] || {};

    var opts = d.units.map(function (u) {
      var sel = u.id === simId ? " selected" : "";
      var rl  = (d.roles[u.role] || {}).label || u.role;
      return "<option value=\"" + u.id + "\"" + sel + ">" + esc(u.name) + " (" + u.grade + " / " + rl + ")</option>";
    }).join("");

    var STAT_DEF = [
      { k:"hp",       label:"HP",        max:120000, color:"#1f8a4c", note:"레벨·성급" },
      { k:"atk",      label:"ATK",       max:15000,  color:"#c0392b", note:"레벨·성급" },
      { k:"def",      label:"DEF",       max:6000,   color:"#2563eb", note:"레벨·성급" },
      { k:"spd",      label:"SPD",       max:250,    color:"#b7791f", note:"개별 성장" },
      { k:"critRate", label:"치명타율",   max:80,     color:"#8e44ad", note:"고정값", pct:true },
      { k:"critDmg",  label:"치명배율",   max:300,    color:"#e74c3c", note:"고정값", pct:true },
      { k:"defPen",   label:"방어관통",   max:100,    color:"#16a085", note:"고정값", pct:true },
      { k:"critRes",  label:"치명저항",   max:80,     color:"#7f8c8d", note:"고정값", pct:true },
    ];

    var bars = STAT_DEF.map(function (s) {
      var v    = stats[s.k] || 0;
      var pctW = Math.min(100, (v / s.max) * 100).toFixed(1);
      var disp = s.pct ? v + "%" : fmt(v);
      return "<tr>" +
        "<td style=\"padding:5px 9px;width:70px;font-size:12px;color:var(--ink-2)\">" + s.label + "</td>" +
        "<td style=\"padding:5px 9px;width:80px;font-family:var(--mono);font-weight:700;font-size:13px;color:" + s.color + "\">" + disp + "</td>" +
        "<td style=\"padding:5px 9px\">" +
          "<div style=\"height:9px;background:#eceff2;border-radius:5px;overflow:hidden;min-width:120px\">" +
            "<div style=\"height:100%;width:" + pctW + "%;background:" + s.color + ";border-radius:5px;transition:width .2s\"></div>" +
          "</div></td>" +
        "<td style=\"padding:5px 9px;font-size:10.5px;color:var(--ink-3);width:58px\">" + s.note + "</td>" +
        "</tr>";
    }).join("");

    var shardNote = simStar > 0
      ? "<span class=\"hint\" style=\"margin:0\">재료 총 " + shards + "조각</span>"
      : "";

    return "<div style=\"background:var(--panel);border:1px solid var(--grid);border-radius:8px;padding:16px\">" +
      "<div style=\"display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:16px\">" +
        "<div><div class=\"hint\" style=\"margin:0 0 4px\">유닛</div>" +
          "<select data-path=\"unitDesign.simUnit\" style=\"font:13px var(--sans);padding:5px 9px;border:1px solid var(--grid-strong);border-radius:5px;background:#fff;cursor:pointer\">" + opts + "</select></div>" +
        "<div><div class=\"hint\" style=\"margin:0 0 4px\">레벨 <b style=\"font-family:var(--mono);color:var(--ink)\">" + simLv + "</b> / " + maxLv + "</div>" +
          "<input type=\"range\" data-path=\"unitDesign.simLevel\" min=\"1\" max=\"" + maxLv + "\" value=\"" + simLv + "\" style=\"width:130px;accent-color:var(--accent-ink);cursor:pointer\"></div>" +
        "<div><div class=\"hint\" style=\"margin:0 0 4px\">성급 <b style=\"font-family:var(--mono);color:var(--ink)\">★" + simStar + "</b> / ★" + maxStar + "</div>" +
          "<input type=\"range\" data-path=\"unitDesign.simStar\" min=\"0\" max=\"" + maxStar + "\" value=\"" + simStar + "\" style=\"width:90px;accent-color:var(--accent-ink);cursor:pointer\"></div>" +
      "</div>" +
      "<div style=\"display:flex;align-items:center;gap:7px;margin-bottom:13px;flex-wrap:wrap\">" +
        "<span style=\"font-size:15px;font-weight:700\">" + esc(simUnit.name) + "</span>" +
        bdg(simUnit.grade, GRADE_C[simUnit.grade]) +
        "<span class=\"badge\" style=\"background:#f2f2f2;color:#444\">" + (role.label || simUnit.role) + "</span>" +
        "<span class=\"badge\" style=\"background:#e8f6ee;color:#1f8a4c\">Lv." + simLv + "</span>" +
        "<span class=\"badge\" style=\"background:#fff3e0;color:#b7791f\">★" + simStar + "</span>" +
        shardNote +
      "</div>" +
      "<table style=\"border-collapse:collapse\"><tbody>" + bars + "</tbody></table>" +
      "</div>";
  }

  /* ── 섹션 8 : 유니크 검증 ──────────────────────────────── */
  function secUniqueness() {
    var conflicts = Units.checkUniqueness();
    if (!conflicts.length) {
      return "<div style=\"background:#e6f6ec;border:1px solid #cfe3d8;border-radius:8px;padding:14px 16px\">" +
        "<div style=\"font-weight:700;color:#1f8a4c;margin-bottom:4px\">✓ 유니크 검증 통과</div>" +
        "<div style=\"font-size:12px;color:#2d6a4a\">초기값 · 최대값 모두 각 유닛의 HP/ATK/DEF 조합이 고유합니다.</div>" +
        "</div>";
    }
    var items = conflicts.map(function (c) {
      return "<div style=\"padding:6px 0;border-bottom:1px solid #f8d4d0;font-size:12.5px\">" +
        "<b style=\"color:#c0392b\">⚠ " + (c.type === "init" ? "초기값" : "최대값") + " 충돌</b>" +
        "&nbsp;" + esc(c.a) + " ↔ " + esc(c.b) +
        "</div>";
    }).join("");
    return "<div style=\"background:#fcebe9;border:1px solid #f5b7b1;border-radius:8px;padding:14px 16px\">" +
      "<div style=\"font-weight:700;color:#c0392b;margin-bottom:8px\">⚠ 스탯 충돌 " + conflicts.length + "건 감지</div>" +
      items +
      "<div class=\"hint\" style=\"margin-top:8px\">역할 배율 또는 개인 오프셋을 조정해 충돌을 해소하세요.</div>" +
      "</div>";
  }

  /* ── 메인 렌더 ─────────────────────────────────────────── */
  function units() {
    var d = Data.state.unitDesign;
    return "<div class=\"sheet-inner\">" +
      "<div class=\"row\">" +
        "<div class=\"col\">" +
          "<div class=\"section\"><h2>등급 시스템 <span class=\"sub\">레벨 한계 · 기준 스탯 배율</span></h2>" + secGrades(d) + "</div>" +
        "</div>" +
        "<div class=\"col\">" +
          "<div class=\"section\"><h2>성급강화 시스템 <span class=\"sub\">단계당 복리 증가</span></h2>" + secStarSystem(d) + "</div>" +
        "</div>" +
      "</div>" +
      "<div class=\"row\">" +
        "<div class=\"col\" style=\"flex:2;min-width:420px\">" +
          "<div class=\"section\"><h2>역할별 스탯 배율 <span class=\"sub\">직접 설정 · HP·ATK·DEF 기준값 &amp; 레벨성장 동시 적용</span></h2>" + secRoles(d) + "</div>" +
        "</div>" +
        "<div class=\"col\">" +
          "<div class=\"section\"><h2>기준 스탯 <span class=\"sub\">R등급 · 역할보정 전</span></h2>" + secBaseRef(d) + "</div>" +
        "</div>" +
      "</div>" +
      "<div class=\"section\"><h2>성급강화 재료 비용 <span class=\"sub\">등급 × 단계별 조각 필요량</span></h2>" + secShardCosts(d) + "</div>" +
      "<div class=\"section\"><h2>유닛 명부 <span class=\"sub\">" + d.units.length + "기 · 초기(Lv1·★0) vs 최대 성장치 비교</span></h2>" + secRoster(d) + "</div>" +
      "<div class=\"row\">" +
        "<div class=\"col\" style=\"flex:2;min-width:360px\">" +
          "<div class=\"section\"><h2>스탯 시뮬레이터 <span class=\"sub\">레벨·성급강화 조합별 8종 스탯 미리보기</span></h2>" + secSimulator(d) + "</div>" +
        "</div>" +
        "<div class=\"col\">" +
          "<div class=\"section\"><h2>유니크 검증 <span class=\"sub\">초기·최대 HP/ATK/DEF 충돌 감지</span></h2>" + secUniqueness() + "</div>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  Object.assign(window.Render, { units: units });
})();
