/* ============================================================
   render.js — 포맷 헬퍼 · 대시보드 · 육성 경제 탭
   ============================================================ */
(function () {
  "use strict";

  // ---------- 포맷 ----------
  function fmt(n) {
    if (n === Infinity) return "∞";
    if (n == null || isNaN(n)) return "–";
    return Math.round(n).toLocaleString("en-US");
  }
  function fmtK(n) {
    if (n === Infinity) return "∞";
    if (n == null || isNaN(n)) return "–";
    const a = Math.abs(n);
    if (a >= 1e8) return (n / 1e8).toFixed(2) + "억";
    if (a >= 1e4) return (n / 1e4).toFixed(1) + "만";
    return Math.round(n).toLocaleString("en-US");
  }
  function fmt1(n) { return n == null || isNaN(n) ? "–" : (Math.round(n * 10) / 10).toLocaleString("en-US"); }
  // 일수 → "N개월 N일" (30일 = 1개월)
  function fmtMD(n) {
    if (n === Infinity) return "∞";
    if (n == null || isNaN(n)) return "–";
    const d = Math.round(n), m = Math.floor(d / 30), r = d % 30;
    if (m <= 0) return r + "일";
    return r > 0 ? `${m}개월 ${r}일` : `${m}개월`;
  }

  // ---------- 유저 체감 성장곡선 차트(SVG) ----------
  function growthChart(econ) {
    const g = Economy.growthCurve();
    const t = Data.state.targets;
    const sm = g.samples;
    if (!sm.length) return "";
    const W = 760, H = 300, ML = 58, MR = 18, MT = 34, MB = 50;
    const PW = W - ML - MR, PH = H - MT - MB;
    const maxDay = Math.max(g.days, t.maxDays) * 1.08 || 1;
    const maxPow = g.maxPower * 1.06 || 1;
    const X = (d) => ML + (d / maxDay) * PW;
    const Y = (p) => MT + PH - (p / maxPow) * PH;

    // 그리드 + 축
    let grid = "";
    for (let i = 0; i <= 4; i++) {
      const py = MT + (PH * i) / 4, val = maxPow * (1 - i / 4);
      grid += `<line x1="${ML}" y1="${py}" x2="${W - MR}" y2="${py}" stroke="#e6eaee"/>`;
      grid += `<text x="${ML - 8}" y="${py + 3}" text-anchor="end" class="gc-ax">${fmtK(val)}</text>`;
    }
    // X축 눈금: maxDay가 수천 일까지 커져도 라벨이 겹치지 않도록 1·2·5×10^k 단위로 ~8개만 표기
    const rawStep = (maxDay || 1) / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const norm = (rawStep || 1) / mag;
    const niceMul = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const dayStep = Math.max(1, Math.round(niceMul * mag));
    for (let d = 0; d <= maxDay + 0.5; d += dayStep) {
      const anchor = d === 0 ? "start" : (d + dayStep > maxDay ? "end" : "middle");
      grid += `<text x="${X(d).toFixed(1)}" y="${MT + PH + 16}" text-anchor="${anchor}" class="gc-ax">${Math.round(d)}</text>`;
    }

    // 곡선/면적
    const pts = sm.map((s) => `${X(s.day).toFixed(1)},${Y(s.power).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${(MT + PH).toFixed(1)} L` + pts.replace(/ /g, " L") + ` L${X(sm[sm.length - 1].day).toFixed(1)},${(MT + PH).toFixed(1)} Z`;

    // 성급업 점프: 마커(●)는 모두 표시하되, 라벨(N★)은 가로 간격이 확보될 때만 표기해 겹침 방지
    const js = sm.filter((s) => s.jump);
    const MIN_LABEL_GAP = 28;   // 라벨 간 최소 가로 간격(px)
    let lastLabelX = -Infinity;
    const jumps = js.map((s, i) => {
      const jx = X(s.day), jy = Y(s.power);
      const marker = `<circle cx="${jx.toFixed(1)}" cy="${jy.toFixed(1)}" r="4.5" fill="#b7791f" stroke="#fff" stroke-width="1.5"/>`;
      const showLabel = (jx - lastLabelX >= MIN_LABEL_GAP) || i === js.length - 1;
      if (!showLabel) return marker;
      lastLabelX = jx;
      const anchor = jx > W - 60 ? "end" : jx < ML + 24 ? "start" : "middle";
      const lx = anchor === "end" ? jx - 7 : anchor === "start" ? jx + 7 : jx;
      return marker + `<text x="${lx.toFixed(1)}" y="${(jy - 9).toFixed(1)}" text-anchor="${anchor}" class="gc-jl">${s.star}★</text>`;
    }).join("");

    // 목표·실제 도달일 세로선 — 라벨은 상단에 배치, 두 선이 가까우면 위아래로 분리
    const tx = X(t.maxDays);
    const ax = X(g.days);
    const near = Math.abs(tx - ax) < 80;
    const tAnchor = tx > W - 70 ? "end" : tx < ML + 30 ? "start" : "middle";
    const tlx = tAnchor === "end" ? tx - 3 : tAnchor === "start" ? tx + 3 : tx;
    const aAnchor = ax > W - 70 ? "end" : ax < ML + 30 ? "start" : "middle";
    const alx = aAnchor === "end" ? ax - 3 : aAnchor === "start" ? ax + 3 : ax;
    const targetLine = `<line x1="${tx}" y1="${MT}" x2="${tx}" y2="${MT + PH}" stroke="#c0392b" stroke-dasharray="4 3"/>` +
      `<text x="${tlx}" y="${MT - 18}" text-anchor="${tAnchor}" class="gc-tl" fill="#c0392b">목표 ${fmtMD(t.maxDays)}</text>`;
    const actualLine = `<line x1="${ax}" y1="${MT}" x2="${ax}" y2="${MT + PH}" stroke="#2f6f4f" stroke-dasharray="2 3"/>` +
      `<text x="${alx}" y="${near ? MT - 5 : MT - 18}" text-anchor="${aAnchor}" class="gc-tl" fill="#2f6f4f">만육성 ${fmtMD(g.days)}</text>`;

    const svg = `<svg viewBox="0 0 ${W} ${H}" class="gchart" preserveAspectRatio="xMidYMid meet">
      ${grid}
      <path d="${area}" fill="url(#gcg)" opacity="0.5"/>
      <polyline points="${pts}" fill="none" stroke="#2f6f4f" stroke-width="2.2"/>
      ${targetLine}${actualLine}${jumps}
      <defs><linearGradient id="gcg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3fa06a" stop-opacity="0.5"/><stop offset="1" stop-color="#3fa06a" stop-opacity="0.02"/>
      </linearGradient></defs>
      <text x="4" y="14" class="gc-ax">전투력</text>
      <text x="${W - MR}" y="${H - 4}" text-anchor="end" class="gc-ax">육성 경과일</text>
    </svg>`;

    const gain = g.minPower > 0 ? (g.maxPower / g.minPower) : 0;
    return `<div class="section"><h2>유저 체감 성장곡선 <span class="sub">전투력 vs 육성일 · ●=성급업 점프 · 빨간선=목표</span></h2>
      <div class="gcard">${svg}
        <div class="gc-legend"><span class="gl1">● 전투력 곡선</span><span class="gl2">● 성급업 점프</span>
          <span class="muted">최종 전투력 ${fmt(g.maxPower)} · 시작 대비 ×${fmt1(gain)}</span></div>
      </div></div>`;
  }

  function edit(path, value, opts) {
    opts = opts || {};
    const step = opts.step != null ? ` step="${opts.step}"` : "";
    const w = opts.w ? ` style="width:${opts.w}px"` : "";
    return `<td class="edit num"><input type="number" data-path="${path}" value="${value}"${step}${w}></td>`;
  }
  function editInline(path, value, opts) {
    opts = opts || {};
    return `<input class="tinp" type="number" data-path="${path}" value="${value}"${opts.step != null ? ` step="${opts.step}"` : ""}${opts.w ? ` style="width:${opts.w}px"` : ""}>`;
  }

  const RKOR = Economy.RES_KOR;
  const RES = Economy.RES;

  // ======================================================
  // 대시보드
  // ======================================================
  function dashboard() {
    const s = Data.state, t = s.targets;
    const econ = Economy.daysToMax();
    const sims = Combat.simAll();

    const dStat = Economy.status(econ.days, t.maxDays, t.daysTol);
    const months = econ.days / 30;

    const secs = sims.map((r) => r.sec);
    const avgSec = secs.reduce((a, b) => a + b, 0) / (secs.length || 1);
    const maxSec = Math.max(...secs);
    const cstats = sims.map((r) => Economy.combatStatus(r.sec, t.clearSec, t.clearTol, r.cleared).cls);
    const badN = cstats.filter((c) => c === "bad").length;
    const warnN = cstats.filter((c) => c === "warn").length;
    const overCount = badN;
    const cStat = badN ? "bad" : warnN ? "warn" : "ok";
    const cLabel = cStat === "ok" ? "충족" : cStat === "warn" ? "근접" : "이탈";

    const cards = `
      <div class="cards">
        <div class="card kpi ${dStat}">
          <div class="k">유닛 최대 육성 소요 <span class="badge ${dStat}">${dStat === "ok" ? "충족" : dStat === "warn" ? "근접" : "이탈"}</span></div>
          <div class="v" style="font-size:22px">${fmtMD(econ.days)}</div>
          <div class="meta">총 ${fmt(econ.days)}일 · 목표 ${fmtMD(t.maxDays)} (±${t.daysTol}일)</div>
        </div>
        <div class="card kpi">
          <div class="k">병목 자원</div>
          <div class="v" style="font-size:22px">${RKOR[econ.bottleneck] || "–"}</div>
          <div class="meta">이 자원이 6개월 도달을 좌우 · ${fmt(econ.perRes[econ.bottleneck] ? econ.perRes[econ.bottleneck].days : 0)}일 소요</div>
        </div>
        <div class="card kpi ${cStat}">
          <div class="k">전투 최대 클리어 <span class="badge ${cStat}">${cLabel}</span></div>
          <div class="v">${fmt1(maxSec)}<small> 초</small></div>
          <div class="meta">평균 ${fmt1(avgSec)}초 · 목표 ${t.clearSec}초 (±${t.clearTol})</div>
        </div>
        <div class="card kpi ${overCount ? "bad" : "ok"}">
          <div class="k">목표 이탈 스테이지</div>
          <div class="v">${overCount}<small> / ${sims.length}</small></div>
          <div class="meta">${overCount === 0 ? (warnN ? warnN + "개 근접(±허용내)" : "전 스테이지 2분 이내") : "2분+허용오차 초과 존재"}</div>
        </div>
      </div>`;

    // 미니 스테이지 현황
    const stageRows = sims.map((r) => {
      const cs = Economy.combatStatus(r.sec, t.clearSec, t.clearTol, r.cleared);
      const pct = Math.min(100, (r.sec / (t.clearSec * 1.3)) * 100);
      return `<tr>
        <td class="l">${r.id}</td><td class="l muted">${r.name}</td>
        <td class="num">${fmt1(r.sec)}s</td>
        <td><div class="bar ${cs.cls}"><i style="width:${pct}%"></i></div></td>
        <td class="st-${cs.cls}">${cs.label}</td>
      </tr>`;
    }).join("");

    const stageTable = `
      <div class="section">
        <h2>스테이지 클리어 현황 <span class="sub">정밀 전투 시뮬 결과</span></h2>
        <table class="grid">
          <thead><tr><th class="l">스테이지</th><th class="l">검증 목적</th><th class="num">클리어</th><th>2분 대비</th><th>판정</th></tr></thead>
          <tbody>${stageRows}</tbody>
        </table>
      </div>`;

    const ai = `
      <div class="section">
        <h2>AI 밸런스 진단 리포트 <span class="sub">내장 AI(Claude) 자연어 생성 · 키 불필요</span></h2>
        <div class="ai">
          <h3><span class="g">AI</span> 현재 스냅샷 기반 종합 진단</h3>
          <div style="margin-top:8px"><button class="btn accent" id="btn-report">진단 리포트 생성</button>
            <span class="hint" style="margin-left:8px">육성·전투 시뮬 수치를 모아 종합 판정과 우선 조치를 작성합니다.</span></div>
          <div class="out empty" id="report-out">아직 생성되지 않았습니다. 버튼을 눌러 진단을 시작하세요.</div>
        </div>
      </div>`;

    return `<div class="sheet-inner">
      <div class="section"><h2>종합 대시보드 <span class="sub">${s.unit.name} · ${Data.EL_KOR[s.unit.element]}속성 · ${s.unit.rarity}</span></h2>${cards}</div>
      ${growthChart(econ)}
      ${stageTable}${ai}</div>`;
  }

  // ======================================================
  // 육성 경제 탭
  // ======================================================
  function economy() {
    const s = Data.state, t = s.targets;
    const econ = Economy.daysToMax();          // 광고 미시청(base)
    const econAd = Economy.daysToMax(true);    // 광고 2배
    const { breakdown, totals } = Economy.totalCost();

    // 비용 합산표 — 골드 열 옆에 위에서부터 누적된 '누적 골드(최종 합산)' 열 추가
    const head = `<tr><th class="l">육성 단계</th><th class="l">구간</th>${RES.map((r) => {
      const th = `<th class="num">${RKOR[r]}</th>`;
      return r === "gold" ? th + `<th class="num">누적 골드</th>` : th;
    }).join("")}</tr>`;
    let cumG = 0;
    const body = breakdown.map((b) => {
      cumG += b.gold || 0;
      const isOpen = expandedCost.has(b.phase);
      const cells = RES.map((r) => {
        const cell = `<td class="num">${b[r] ? fmtK(b[r]) : "–"}</td>`;
        return r === "gold" ? cell + `<td class="num cumcol">${fmtK(cumG)}</td>` : cell;
      }).join("");
      const main = `<tr class="costmain${isOpen ? " open" : ""}" data-costrow="${b.phase}">
        <td class="l"><span class="exptri">${isOpen ? "▾" : "▸"}</span> ${b.phase}</td>
        <td class="l muted">${b.detail}</td>${cells}</tr>`;
      const det = isOpen ? `<tr class="costdetailrow"><td colspan="8" class="costdetailcell">${costDetail(b.phase)}</td></tr>` : "";
      return main + det;
    }).join("");
    const foot = `<tr><td class="l">합계</td><td></td>${RES.map((r) => {
      const td = `<td class="num total">${fmtK(totals[r])}</td>`;
      return r === "gold" ? td + `<td class="num total cumcol">${fmtK(totals.gold)}</td>` : td;
    }).join("")}</tr>`;
    const costTable = `<table class="grid">
      <thead>${head}</thead><tbody>${body}</tbody>
      <tfoot>${foot}</tfoot></table>`;

    // 재화 밸런스 — 광고 미시청 vs 광고 2배(자동사냥/스테이지 보상 ×adMult) 2분화 비교
    const adMult = +s.income.adMultiplier || 2;
    const dRows = RES.map((r) => {
      const pB = econ.perRes[r], pA = econAd.perRes[r];
      if (pB.need <= 0) return "";
      const stB = Economy.status(pB.days, t.maxDays, t.daysTol);
      const stA = Economy.status(pA.days, t.maxDays, t.daysTol);
      const isBn = econ.bottleneck === r;
      return `<tr${isBn ? ' style="font-weight:700"' : ""}>
        <td class="l">${RKOR[r]}${isBn ? ' <span class="badge bad" style="font-size:9px">병목</span>' : ""}</td>
        <td class="num">${fmtK(pB.need)}</td>
        <td class="num">${fmtK(pB.rate)}/일</td>
        <td class="num st-${stB}">${fmt(pB.days)}</td>
        <td class="num adcol">${fmtK(pA.rate)}/일</td>
        <td class="num adcol st-${stA}">${fmt(pA.days)}</td>
      </tr>`;
    }).join("");
    const incB = Economy.dailyIncome(false), incA = Economy.dailyIncome(true);
    const stAllB = Economy.status(econ.days, t.maxDays, t.daysTol);
    const stAllA = Economy.status(econAd.days, t.maxDays, t.daysTol);
    const daysTable = `<table class="grid">
      <thead>
        <tr><th class="l" rowspan="2">자원</th><th class="num" rowspan="2">총 필요</th><th class="num" colspan="2">광고 미시청</th><th class="num adcol" colspan="2">광고 2배 (×${adMult})</th></tr>
        <tr><th class="num">수급/일</th><th class="num">소요일</th><th class="num adcol">수급/일</th><th class="num adcol">소요일</th></tr>
      </thead>
      <tbody>${dRows}</tbody>
      <tfoot><tr>
        <td class="l">종합(병목)</td><td></td>
        <td class="num muted">${fmtK(incB[econ.bottleneck] || 0)}/일</td>
        <td class="num total st-${stAllB}">${fmtMD(econ.days)}</td>
        <td class="num muted adcol">${fmtK(incA[econAd.bottleneck] || 0)}/일</td>
        <td class="num total adcol st-${stAllA}">${fmtMD(econAd.days)}</td>
      </tr></tfoot>
    </table>
    <div class="hint">자동사냥 보상·스테이지 클리어 보상에 광고 시청 시 ×${adMult} 적용 — 두 시나리오의 소요일을 비교합니다. 종합 = 병목 자원 기준.</div>`;

    // 수급 에디터
    const inc = s.income;
    let incomeEditor;
    if (inc.mode === "manual") {
      incomeEditor = `<table class="grid" style="max-width:520px">
        <thead><tr><th class="l">자원</th><th class="num">일일 수급(수동)</th></tr></thead>
        <tbody>${RES.map((r) => `<tr><td class="l">${RKOR[r]}</td>${edit(`income.manual.${r}`, inc.manual[r], { step: r === "gold" || r === "exp" ? 100 : 0.01 })}</tr>`).join("")}</tbody>
      </table>`;
    } else {
      const a = inc.auto;
      const used = Economy.staminaUsed();
      const dunRows = a.dungeons.map((d, i) => `<tr>
        <td class="l">${d.label}</td>
        <td class="num muted">${d.cost}</td>
        ${editInlineCell(`income.auto.runs.${d.key}`, a.runs[d.key], { step: 1 })}
        <td class="num muted">${[d.gold && RKOR.gold + " " + fmtK(d.gold), d.exp && RKOR.exp + " " + fmtK(d.exp), d.skillBook && "북 " + d.skillBook, d.shard && "재료 " + d.shard, d.traitBook && "특성북 " + d.traitBook].filter(Boolean).join(" · ")}</td>
      </tr>`).join("");
      const stOver = used > a.staminaPerDay;
      incomeEditor = `<table class="grid">
        <thead><tr><th class="l">던전</th><th class="num">스태미나</th><th class="num">일일 회차</th><th class="l">1회 드랍</th></tr></thead>
        <tbody>${dunRows}</tbody>
        <tfoot><tr><td class="l">스태미나 소비 / 보유</td><td colspan="2" class="num ${stOver ? "st-bad" : "total"}">${used} / ${a.staminaPerDay}${stOver ? " ⚠ 초과" : ""}</td><td class="l muted">+ 스테이지 고정보상 자동합산</td></tr></tfoot>
      </table>
      <div class="hint">회차를 조정하면 일일 수급과 소요일이 즉시 재계산됩니다. 스태미나 보유량: ${editInline("income.auto.staminaPerDay", a.staminaPerDay, { step: 10, w: 70 })}</div>`;
    }

    const ai = `<div class="ai">
      <h3><span class="g">AI</span> 육성 경제 교정안</h3>
      <div style="margin-top:8px"><button class="btn accent" id="btn-sugg-growth">교정안 제안 받기</button>
        <span class="hint" style="margin-left:8px">병목 자원과 목표 이탈을 분석해 정량 조정안을 제시합니다.</span></div>
      <div id="sugg-growth"></div>
    </div>`;

    return `<div class="sheet-inner">
      <div class="row">
        <div class="col">
          <div class="section"><h2>육성 총비용 합산 <span class="sub">레벨·성급·스킬3종·특성</span></h2>${costTable}</div>
        </div>
      </div>
      ${costSteps()}
      <div class="row">
        <div class="col">
          <div class="section"><h2>일일 수급 모델
            <span class="seg" style="margin-left:6px">
              <button data-incmode="auto" class="${inc.mode === "auto" ? "active" : ""}">자동(던전 회차)</button>
              <button data-incmode="manual" class="${inc.mode === "manual" ? "active" : ""}">수동 입력</button>
            </span></h2>${incomeEditor}</div>
        </div>
        <div class="col">
          <div class="section"><h2>재화 밸런스 · 광고 2배 비교 <span class="sub">자동사냥/스테이지 보상 ×${adMult} · 병목 = 종합</span></h2>${daysTable}</div>
        </div>
      </div>
      <div class="section"><h2>AI 교정 <span class="sub">내장 AI</span></h2>${ai}</div>
    </div>`;
  }

  function editInlineCell(path, value, opts) {
    return `<td class="edit num"><input type="number" data-path="${path}" value="${value}"${opts && opts.step != null ? ` step="${opts.step}"` : ""}></td>`;
  }

  // 구간별 차등 요구치 + 구간 최대까지 누적치 (골드·조각·스킬북)
  // ---- 합산표 행별 세부 내역(레벨/성급/스킬레벨 차등+누적) ----
  let expandedCost = new Set();
  function toggleCostDetail(key) { if (expandedCost.has(key)) expandedCost.delete(key); else expandedCost.add(key); }
  function costDetail(phase) {
    const d = Economy.stepDetail();
    const c = Data.state.costs;
    const wrap = (head, rows) => `<table class="mini cost-detail"><thead>${head}</thead><tbody>${rows || `<tr><td class="l muted">세부 데이터 없음</td></tr>`}</tbody></table>`;
    if (phase === "레벨업") {
      const rows = d.level.map((r) => `<tr><td class="l">Lv.${r.lv}</td><td class="num">${fmtK(r.gold)}</td><td class="num cumcol">${fmtK(r.cumGold)}</td></tr>`).join("");
      return wrap(`<tr><th class="l">레벨</th><th class="num">골드(차등)</th><th class="num">누적 골드</th></tr>`, rows);
    }
    if (phase === "성급업") {
      const rows = d.star.map((r) => `<tr><td class="l">${r.from}★→${r.to}★</td><td class="num">${fmtK(r.shard)}</td><td class="num cumcol">${fmtK(r.cumShard)}</td></tr>`).join("");
      return wrap(`<tr><th class="l">성급</th><th class="num">조각(차등)</th><th class="num">누적 조각</th></tr>`, rows);
    }
    if (phase.indexOf("스킬·") === 0) {
      const sk = d.skills.find((s) => s.label === phase.slice(3));
      if (!sk) return wrap("", "");
      const rows = sk.rows.map((r) => `<tr><td class="l">Lv.${r.lv}</td><td class="num">${fmtK(r.gold)}</td><td class="num cumcol">${fmtK(r.cumGold)}</td><td class="num">${r.book}</td><td class="num cumcol">${fmtK(r.cumBook)}</td></tr>`).join("");
      return wrap(`<tr><th class="l">레벨</th><th class="num">골드(차등)</th><th class="num">누적 골드</th><th class="num">스킬북(차등)</th><th class="num">누적 스킬북</th></tr>`, rows);
    }
    if (phase.indexOf("특성") === 0) {
      let cg = 0, cb = 0;
      const rows = (c.trait || []).map((r) => { cg += r.gold || 0; cb += r.book || 0; return `<tr><td class="l">Lv.${r.lv}</td><td class="num">${fmtK(r.gold || 0)}</td><td class="num cumcol">${fmtK(cg)}</td><td class="num">${r.book || 0}</td><td class="num cumcol">${fmtK(cb)}</td></tr>`; }).join("");
      return wrap(`<tr><th class="l">레벨</th><th class="num">골드(차등)</th><th class="num">누적 골드</th><th class="num">특성북(차등)</th><th class="num">누적 특성북</th></tr>`, rows);
    }
    return wrap("", "");
  }

  // 레벨별 필요 골드 막대 그래프(SVG)
  function levelGoldChart(level) {
    if (!level || !level.length) return '<div class="hint">레벨 데이터가 없습니다.</div>';
    const W = 760, H = 220, ML = 56, MR = 14, MT = 16, MB = 34;
    const PW = W - ML - MR, PH = H - MT - MB;
    const maxG = Math.max(1, ...level.map((r) => +r.gold || 0)) * 1.05;
    const n = level.length, bw = PW / n;
    const Y = (g) => MT + PH - (g / maxG) * PH;
    let grid = "";
    for (let i = 0; i <= 4; i++) {
      const py = MT + PH * i / 4, val = maxG * (1 - i / 4);
      grid += `<line x1="${ML}" y1="${py.toFixed(1)}" x2="${W - MR}" y2="${py.toFixed(1)}" stroke="#e6eaee"/><text x="${ML - 6}" y="${(py + 3).toFixed(1)}" text-anchor="end" class="gc-ax">${fmtK(val)}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 8));
    let xlab = "";
    for (let i = 0; i < n; i += step) {
      const r = level[i], cx = ML + i * bw + bw / 2;
      xlab += `<text x="${cx.toFixed(1)}" y="${(MT + PH + 14).toFixed(1)}" text-anchor="middle" class="gc-ax">${r.lv - 1}→${r.lv}</text>`;
    }
    const bars = level.map((r, i) => {
      const x = ML + i * bw + bw * 0.12, w = Math.max(0.8, bw * 0.76), y = Y(+r.gold || 0), h = Math.max(0, MT + PH - y);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#b7791f" opacity="0.85"><title>${r.lv - 1}→${r.lv}: ${fmtK(r.gold)} 골드</title></rect>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="gchart" preserveAspectRatio="xMidYMid meet">${grid}${bars}${xlab}<text x="4" y="13" class="gc-ax">필요 골드</text></svg>`;
  }

  function costSteps() {
    const d = Economy.stepDetail();
    const s = Data.state;

    // 1) 레벨업 골드 — 레벨별(1→2, 2→3 …) 차등 + 누적 (전체 노출, 스크롤)
    const lvBody = d.level.map((r) => `<tr>
      <td class="l">${r.lv - 1}→${r.lv}</td>
      <td class="num">${fmtK(r.gold)}</td>
      <td class="num total">${fmtK(r.cumGold)}</td>
      <td><div class="cbar"><i style="width:${Math.min(100, d.cum.gold ? (r.cumGold / d.cum.gold) * 100 : 0)}%"></i></div></td>
    </tr>`).join("");
    const lvTable = `<div style="max-height:340px;overflow:auto;border:1px solid #e6eaee;border-radius:8px">
      <table class="grid">
      <thead><tr><th class="l">레벨</th><th class="num">필요 골드(차등)</th><th class="num">누적 골드</th><th>최대 대비</th></tr></thead>
      <tbody>${lvBody || `<tr><td colspan="4" class="l muted">레벨 데이터 없음</td></tr>`}</tbody>
      <tfoot><tr><td class="l">최대 누적</td><td class="num">–</td><td class="num total">${fmtK(d.cum.gold)}</td><td class="l muted">Lv.${s.unit.maxLevel} · 골드만</td></tr></tfoot></table></div>`;
    const lvChart = `<div class="gcard">${levelGoldChart(d.level)}
      <div class="gc-legend"><span class="gl2">■ 레벨별 필요 골드(차등)</span><span class="muted">막대 1개 = 한 레벨업 구간 · 좌→우 = 1레벨→만렙</span></div></div>`;

    // 2) 성급업 조각 — 성급별 차등 + 누적 (골드 미사용)
    const stBody = d.star.map((r) => `<tr>
      <td class="l">${r.from}★ → ${r.to}★</td>
      <td class="num">${fmtK(r.shard)}</td>
      <td class="num total">${fmtK(r.cumShard)}</td>
      <td><div class="cbar shard"><i style="width:${d.cum.shard ? Math.min(100, (r.cumShard / d.cum.shard) * 100) : 0}%"></i></div></td>
    </tr>`).join("");
    const stTable = `<div style="max-height:340px;overflow:auto;border:1px solid #e6eaee;border-radius:8px"><table class="grid">
      <thead><tr><th class="l">성급 단계</th><th class="num">필요 조각(차등)</th><th class="num">누적 조각</th><th>구간 최대 대비</th></tr></thead>
      <tbody>${stBody || `<tr><td colspan="4" class="l muted">성급 데이터 없음</td></tr>`}</tbody>
      <tfoot><tr><td class="l">최대 누적</td><td class="num">–</td><td class="num total">${fmtK(d.cum.shard)}</td><td class="l muted">캐릭터 조각만 사용 · 골드 미사용</td></tr></tfoot></table></div>`;

    // 3) 속성 스킬북 — 스킬·레벨별 차등 + 누적
    const lvls = d.skills[0] ? d.skills[0].rows.map((r) => r.lv) : [];
    const skHead = `<tr><th class="l">스킬</th>${lvls.map((lv) => `<th class="num">Lv.${lv}</th>`).join("")}<th class="num">누적 스킬북</th></tr>`;
    const skBody = d.skills.map((sk) => `<tr>
      <td class="l">${sk.label}</td>
      ${sk.rows.map((r) => `<td class="num">${r.book}</td>`).join("")}
      <td class="num total">${fmtK(sk.totalBook)}</td>
    </tr>`).join("");
    const skTable = `<div style="overflow-x:auto;max-width:100%;border:1px solid #e6eaee;border-radius:8px"><table class="grid" style="min-width:max-content">
      <thead>${skHead}</thead><tbody>${skBody}</tbody>
      <tfoot><tr><td class="l">합계 누적</td><td class="num muted" colspan="${lvls.length}">스킬 레벨업당 속성 스킬북 (구간별 증가)</td><td class="num total">${fmtK(d.cum.skillBook)}</td></tr></tfoot></table></div>`;

    return `<div class="section"><h2>레벨별 차등 요구치 · 구간 최대 누적 <span class="sub">레벨별 골드(그래프) · 성급업 조각 · 속성 스킬북</span></h2>
      <div class="cumcards">
        <div class="cumcard gold"><div class="cl">구간 최대 누적 · 골드</div><div class="cv">${fmtK(d.cum.gold)}</div><div class="ch">레벨업 전용 (성급 미사용)</div></div>
        <div class="cumcard shard"><div class="cl">구간 최대 누적 · 캐릭터 조각</div><div class="cv">${fmtK(d.cum.shard)}</div><div class="ch">성급업 전용 (골드 미사용)</div></div>
        <div class="cumcard book"><div class="cl">구간 최대 누적 · 속성 스킬북</div><div class="cv">${fmtK(d.cum.skillBook)}</div><div class="ch">스킬 3종 합계</div></div>
      </div>
      <div class="subh">레벨별 필요 골드 그래프</div>
      ${lvChart}
      <div class="row">
        <div class="col"><div class="subh">레벨업 골드 (레벨별 1→2 …)</div>${lvTable}</div>
        <div class="col"><div class="subh">성급업 조각 <span class="muted">(골드 없음)</span></div>${stTable}</div>
      </div>
      <div class="subh" style="margin-top:12px">속성 스킬북 (스킬·레벨별 차등)</div>${skTable}</div>`;
  }

  window.Render = window.Render || {};
  Object.assign(window.Render, { fmt, fmtK, fmt1, fmtMD, edit, editInline, dashboard, economy, toggleCostDetail });
})();
