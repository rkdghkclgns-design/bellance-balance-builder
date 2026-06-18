/* ============================================================
   render_doctrine.js — 전투 밸런스 기조 탭
   ============================================================ */
(function () {
  "use strict";
  const R = window.Render;
  const fmt = R.fmt, fmt1 = R.fmt1, fmtK = R.fmtK;
  const fmtMD = R.fmtMD || ((n) => Math.round(n) + "일");
  const esc = R.escapeHtml;

  // 인라인 편집 입력(data-path → bindSheet가 처리)
  function di(path, val, step, w) {
    return `<input class="tinp" type="number" data-path="${path}" value="${val}"${step != null ? ` step="${step}"` : ""}${w ? ` style="width:${w}px"` : ""}>`;
  }
  function ec(path, val, step) {
    return `<td class="edit num"><input type="number" data-path="${path}" value="${val}"${step != null ? ` step="${step}"` : ""}></td>`;
  }

  // ---- 성장 밸런스 기조 패널 ----
  function growthPanel() {
    const cfg = Data.state.doctrine, gr = cfg.growth, d = Data.state.unitDesign;
    if (!gr) return "";
    const POW = (s) => s.atk + s.def * 1.5 + s.hp * 0.08;
    function gradeStat(g) {
      const G = d.grades[g] || {}; const ref = d.baseRef, pl = d.perLevelRef;
      const ms = (gr.grades[g] && gr.grades[g].maxStar) || G.maxStar || 0;
      const sf = Math.pow(1 + d.starSystem.multPerStep, ms);
      const lv0 = ((gr.grades[g] && gr.grades[g].maxLevel) || G.maxLevel || 1) - 1;
      return { hp: (ref.hp * G.baseMult + pl.hp * lv0) * sf, atk: (ref.atk * G.baseMult + pl.atk * lv0) * sf, def: (ref.def * G.baseMult + pl.def * lv0) * sf };
    }
    const pow = { R: POW(gradeStat("R")), SR: POW(gradeStat("SR")), SSR: POW(gradeStat("SSR")) };
    const hierOk = pow.R < pow.SR && pow.SR < pow.SSR;

    const gradeRows = ["R", "SR", "SSR"].map((g) => {
      const x = gr.grades[g];
      return `<tr><td class="l">${g}</td>
        ${ec("doctrine.growth.grades." + g + ".maxLevel", x.maxLevel, 1)}
        ${ec("doctrine.growth.grades." + g + ".maxStar", x.maxStar, 1)}
        ${ec("doctrine.growth.grades." + g + ".mileagePerShard", x.mileagePerShard, 1)}
        <td class="num">${fmt(pow[g])}</td></tr>`;
    }).join("");
    const gradeTable = `<table class="grid" style="max-width:560px">
      <thead><tr><th class="l">등급</th><th class="num">최대 레벨</th><th class="num">최대 성급</th><th class="num">조각→마일리지</th><th class="num">최대 전투력</th></tr></thead>
      <tbody>${gradeRows}</tbody>
      <tfoot><tr><td class="l">등급 위계</td><td colspan="3" class="l muted">R(${cfg.growth.grades.R.maxLevel}/★${cfg.growth.grades.R.maxStar}) 완성 &lt; SSR(${cfg.growth.grades.SSR.maxLevel}/★${cfg.growth.grades.SSR.maxStar})</td>
        <td class="st-${hierOk ? "ok" : "bad"}">${hierOk ? "충족" : "역전!"}</td></tr></tfoot></table>
      <div class="hint">성급 완료 후 추가 조각은 마일리지 재화로 환원됩니다(R ${cfg.growth.grades.R.mileagePerShard} / SR ${cfg.growth.grades.SR.mileagePerShard} / SSR ${cfg.growth.grades.SSR.mileagePerShard}).</div>`;

    // 육성 시간
    const totalMonths = gr.ssrMonths * gr.partySize;
    const timeBox = `<div class="dgrid">
      <div class="dbox"><div class="dl">SSR 1기 최대강화</div><div class="dv drow">${di("doctrine.growth.ssrMonths", gr.ssrMonths, 1, 52)} 개월</div><div class="dh">레벨업=골드 · 성급=유닛조각</div></div>
      <div class="dbox"><div class="dl">파티 구성</div><div class="dv drow">${di("doctrine.growth.partySize", gr.partySize, 1, 52)} 인</div><div class="dh">SSR ${gr.partySize}기 가정</div></div>
      <div class="dbox"><div class="dl">파티 전체 최대강화</div><div class="dv">${totalMonths}<small> 개월</small></div><div class="dh">${gr.ssrMonths}개월 × ${gr.partySize}인</div></div>
    </div>`;

    // 골드 수급 + 일관성
    const perHour = gr.goldPerMin * 60, perDay = gr.goldPerMin * gr.minutesPerDay;
    const needGold = Economy.totalCost().totals.gold;
    const needMin = gr.goldPerMin > 0 ? needGold / gr.goldPerMin : 0;
    const needDays = perDay > 0 ? needGold / perDay : 0;
    const targetDays = gr.ssrMonths * 30;
    const goldOk = Economy.status(needDays, targetDays, targetDays * 0.18);
    const goldBox = `<div class="dgrid">
      <div class="dbox"><div class="dl">골드 수급</div><div class="dv drow">1분 ${di("doctrine.growth.goldPerMin", gr.goldPerMin, 10, 64)} G</div><div class="dh">시간당 ${fmtK(perHour)} · 일(${gr.minutesPerDay}분) ${fmtK(perDay)}</div></div>
      <div class="dbox"><div class="dl">일일 플레이(가정)</div><div class="dv drow">${di("doctrine.growth.minutesPerDay", gr.minutesPerDay, 10, 64)} 분</div><div class="dh">시간↔일 환산용</div></div>
      <div class="dbox"><div class="dl">SSR 1기 필요 골드</div><div class="dv">${fmtK(needGold)}</div><div class="dh">≈ ${fmtK(needMin)}분 플레이</div></div>
      <div class="dbox ${goldOk}"><div class="dl">골드 기준 소요</div><div class="dv">${fmtMD(needDays)}</div><div class="dh">목표 ${fmtMD(targetDays)}(${gr.ssrMonths}개월) 대비 <b class="st-${goldOk}" style="padding:0 4px">${goldOk === "ok" ? "적정" : needDays > targetDays ? "느림" : "빠름"}</b></div></div>
    </div>`;

    return `<div class="section"><h2>성장 밸런스 기조 · 등급 한계 <span class="sub">R 50/★10 · SR 70/★20 · SSR 100/★30 · 마일리지 환원</span></h2>${gradeTable}</div>
      <div class="section"><h2>육성 시간 기조 <span class="sub">SSR 1기 = ${gr.ssrMonths}개월 · ${gr.partySize}인 파티 = ${totalMonths}개월</span></h2>${timeBox}</div>
      <div class="section"><h2>골드 수급 · 시간 일관성 <span class="sub">레벨업은 골드로 진행 · 1분 ${gr.goldPerMin}골드 기준</span></h2>${goldBox}</div>`;
  }

  function doctrine() {
    const cfg = Data.state.doctrine;
    const B = Doctrine.baselines();
    const C = Doctrine.caps();

    // ---- 기조 상수 ----
    const constBar = `<div class="dgrid">
      <div class="dbox"><div class="dl">기준 등급</div><div class="dv">${cfg.refGrade}</div><div class="dh">평균 산출 등급</div></div>
      <div class="dbox"><div class="dl">스탯 계수</div><div class="dv">${di("doctrine.baselineFactor", cfg.baselineFactor, 0.05, 56)}</div><div class="dh">SR 평균 × 계수</div></div>
      <div class="dbox"><div class="dl">스킬 계수</div><div class="dv">${di("doctrine.skillFactor", cfg.skillFactor, 0.05, 56)}</div><div class="dh">스킬 가중치 × 계수</div></div>
      <div class="dbox"><div class="dl">캡 등급</div><div class="dv">${cfg.capGrade}</div><div class="dh">최대 스탯 산출</div></div>
      <div class="dbox wide"><div class="dl">유물 보정치 (최대강화·성급 기준)</div>
        <div class="dv drow">공 ${di("doctrine.artifactBonus.atk", cfg.artifactBonus.atk, 10, 64)}
          방 ${di("doctrine.artifactBonus.def", cfg.artifactBonus.def, 10, 64)}
          HP ${di("doctrine.artifactBonus.hp", cfg.artifactBonus.hp, 100, 70)}</div>
        <div class="dh">기준·캡 양쪽에 가산됩니다</div></div>
    </div>`;

    // ---- 기준(Baseline) 카드 ----
    function baseCard(title, b, unit) {
      return `<div class="card kpi">
        <div class="k">${title} 기준 <span class="badge ${b.n ? "ok" : "warn"}">${b.n}유닛</span></div>
        <div class="v">${fmt(b.value)}<small> ${unit}</small></div>
        <div class="meta">${cfg.refGrade} 평균 ${fmtK(b.avg)} × ${b.factor} ${b.bonus ? "+ 유물 " + fmtK(b.bonus) : ""}</div>
      </div>`;
    }
    const baseCards = `<div class="cards">
      ${baseCard("공격력", B.atk, "ATK")}
      ${baseCard("방어력", B.def, "DEF")}
      ${baseCard("최대 HP", B.hp, "HP")}
      <div class="card kpi">
        <div class="k">스킬 가중치 기준 <span class="badge ${B.skill.n ? "ok" : "warn"}">${B.skill.n}유닛</span></div>
        <div class="v">${fmt1(B.skill.value)}<small> %</small></div>
        <div class="meta">${cfg.refGrade} 공격형 평균 ${fmt1(B.skill.avg)} × ${B.skill.factor}</div>
      </div>
    </div>`;

    // ---- 밸런스 윈도우(기준→캡) ----
    function windowRow(label, b, c, unit) {
      if (!c) return `<tr><td class="l">${label}</td><td class="num">${fmt(b.value)}</td><td class="num muted">캡 없음</td><td colspan="2" class="muted">${cfg.capGrade} ${unit} 유닛을 입력하세요</td></tr>`;
      const ratio = c.value > 0 ? Math.min(100, (b.value / c.value) * 100) : 0;
      const head = c.value - b.value;
      return `<tr>
        <td class="l">${label}</td>
        <td class="num">${fmt(b.value)}</td>
        <td class="num total">${fmt(c.value)}</td>
        <td><div class="dwin"><i style="width:${ratio}%"></i><span class="dwin-cap">캡</span></div></td>
        <td class="l muted">${esc(Doctrine.unitLabel(c.unit))} · 여유 ${fmtK(head)}</td>
      </tr>`;
    }
    const windowTable = `<table class="grid">
      <thead><tr><th class="l">스탯</th><th class="num">기준(하한)</th><th class="num">캡(상한)</th><th>밸런스 윈도우</th><th class="l">캡 기준 유닛</th></tr></thead>
      <tbody>
        ${windowRow("공격력", B.atk, C.atk, "공격형")}
        ${windowRow("방어력", B.def, C.def, "방어형")}
        ${windowRow("최대 HP", B.hp, C.hp, "방어형")}
      </tbody></table>`;

    // ---- 유닛 분포(역할 × 등급) ----
    const roles = [["Attacker","공격형"],["Defender","방어형"],["Support","지원형"],["Healer","회복형"]];
    const grades = ["R","SR","SSR"];
    const distRows = roles.map(([rk, rko]) => {
      const cells = grades.map((g) => {
        const n = Doctrine.byRoleGrade(rk, g).length;
        const hl = (g === cfg.refGrade && (rk === "Attacker" || rk === "Defender")) || (g === cfg.capGrade && (rk === "Attacker" || rk === "Defender"));
        return `<td class="num ${n ? "" : "muted"}${hl && n ? " st-ok" : ""}">${n}</td>`;
      }).join("");
      return `<tr><td class="l">${rko}</td>${cells}</tr>`;
    }).join("");
    const distTable = `<table class="grid" style="max-width:420px">
      <thead><tr><th class="l">역할 \\ 등급</th>${grades.map((g) => `<th class="num">${g}</th>`).join("")}</tr></thead>
      <tbody>${distRows}</tbody></table>
      <div class="hint">초록 = 기준/캡 산출에 사용되는 셀 (공격형·방어형의 ${cfg.refGrade}/${cfg.capGrade}). 비어 있으면 해당 기준/캡이 0이 됩니다.</div>`;

    // ---- 스테이지 기조 검증 ----
    const playBand = `${cfg.play.min}~${cfg.play.max}s (목표 ${cfg.play.target}s)`;
    const checks = Doctrine.stageChecks();
    const chkRows = checks.map((s) => `<tr>
      <td class="l">${s.id}</td><td class="l muted">${esc(s.name)}</td>
      <td class="st-${s.playCls}">${s.cleared ? fmt1(s.total) + "s" : "전멸"}</td>
      <td class="st-${s.waveCls}">${s.waveCount}</td>
      <td class="st-${s.bossExistCls}">${s.lastIsBoss ? "보스" : "없음"}</td>
      <td class="st-${s.bossTimeCls}">${fmt1(s.bossSec)}s</td>
      <td class="st-${s.bossShareCls}">${fmt1(s.bossShare)}%</td>
      <td><span class="badge ${s.pass ? "ok" : "bad"}">${s.pass ? "기조 충족" : "교정 필요"}</span></td>
    </tr>`).join("");
    const chkTable = `<table class="grid">
      <thead><tr><th class="l">스테이지</th><th class="l">목적</th><th class="num">플레이</th><th class="num">웨이브</th><th>막웨이브</th><th class="num">보스전</th><th class="num">보스비중</th><th>판정</th></tr></thead>
      <tbody>${chkRows}</tbody></table>`;

    // ---- 기조 규칙 편집 ----
    const ruleBar = `<table class="grid" style="max-width:680px">
      <thead><tr><th class="l">규칙</th><th class="num">최소</th><th class="num">목표/기준</th><th class="num">최대</th></tr></thead>
      <tbody>
        <tr><td class="l">플레이타임(초)</td><td class="edit num"><input type="number" data-path="doctrine.play.min" value="${cfg.play.min}" step="5"></td><td class="edit num"><input type="number" data-path="doctrine.play.target" value="${cfg.play.target}" step="5"></td><td class="edit num"><input type="number" data-path="doctrine.play.max" value="${cfg.play.max}" step="5"></td></tr>
        <tr><td class="l">보스전(초)</td><td class="edit num"><input type="number" data-path="doctrine.boss.min" value="${cfg.boss.min}" step="5"></td><td class="num muted">비중 <input class="tinp" type="number" data-path="doctrine.boss.sharePct" value="${cfg.boss.sharePct}" step="5" style="width:48px">%</td><td class="edit num"><input type="number" data-path="doctrine.boss.max" value="${cfg.boss.max}" step="5"></td></tr>
        <tr><td class="l">웨이브 수</td><td class="edit num"><input type="number" data-path="doctrine.waves.min" value="${cfg.waves.min}" step="1"></td><td class="num muted">막 웨이브 = 보스</td><td class="edit num"><input type="number" data-path="doctrine.waves.max" value="${cfg.waves.max}" step="1"></td></tr>
      </tbody></table>`;

    return `<div class="sheet-inner">
      <div class="section"><h2>밸런스 기조 상수 <span class="sub">SR 기준 등급 · 유물 최대강화 보정</span></h2>${constBar}</div>

      ${growthPanel()}

      <div class="section"><h2>전투 기준 (하한) <span class="sub">${cfg.refGrade} 평균 × 계수 + 유물 보정 — 신규 콘텐츠 설계 하한선</span></h2>${baseCards}</div>

      <div class="row">
        <div class="col" style="flex:2">
          <div class="section"><h2>밸런스 윈도우 <span class="sub">기준(하한) → 캡(상한) — ${cfg.capGrade} 최대레벨·최대성급</span></h2>${windowTable}</div>
        </div>
        <div class="col">
          <div class="section"><h2>유닛 분포 <span class="sub">역할 × 등급</span></h2>${distTable}</div>
        </div>
      </div>

      <div class="row">
        <div class="col" style="flex:2">
          <div class="section"><h2>스테이지 기조 검증 <span class="sub">플레이 ${playBand} · 보스전 ${cfg.boss.sharePct}% · ${cfg.waves.min}~${cfg.waves.max}웨이브 · 1챕터 ${cfg.stagesPerChapter || 10}스테이지</span></h2>${chkTable}</div>
        </div>
        <div class="col">
          <div class="section"><h2>기조 규칙 <span class="sub">판정 기준 편집</span></h2>${ruleBar}</div>
        </div>
      </div>
    </div>`;
  }

  Object.assign(window.Render, { doctrine });
})();
