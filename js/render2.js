/* ============================================================
   render2.js — 전투 시뮬 탭 · 마스터 데이터 탭 · AI 출력 렌더
   ============================================================ */
(function () {
  "use strict";
  const R = window.Render;
  const fmt = R.fmt, fmtK = R.fmtK, fmt1 = R.fmt1, edit = R.edit;

  // 라인 색
  const LINE_KOR = { F: "전열", M: "중열", B: "후열" };

  // ======================================================
  // 전투 시뮬 탭
  // ======================================================
  let selectedStage = 0;

  function combat() {
    const s = Data.state, t = s.targets;
    const sims = Combat.simAll();
    if (selectedStage >= sims.length) selectedStage = 0;

    // 팀 원소 구성 vs 선택 스테이지 적
    const teamRows = s.team.map((u, i) => `<tr>
      <td class="l">${u.name}</td>
      <td class="l">${Data.EL_KOR[u.element]}</td>
      <td class="l">${LINE_KOR[u.line]}</td>
      ${edit(`team.${i}.atk`, u.atk, { step: 50 })}
      ${edit(`team.${i}.hp`, u.hp, { step: 500 })}
      ${edit(`team.${i}.def`, u.def, { step: 10 })}
      ${edit(`team.${i}.atkInterval`, u.atkInterval, { step: 0.05 })}
      <td class="l muted">${u.skills.map((sk) => sk.name + "(" + sk.cd + "s)").join(", ") || "–"}</td>
    </tr>`).join("");
    const teamTable = `<table class="grid">
      <thead><tr><th class="l">아군</th><th class="l">속성</th><th class="l">라인</th><th class="num">공격력</th><th class="num">HP</th><th class="num">방어</th><th class="num">평타(s)</th><th class="l">스킬</th></tr></thead>
      <tbody>${teamRows}</tbody></table>`;

    // 스테이지 결과 타임라인
    const maxScale = Math.max(t.clearSec * 1.6, ...sims.map((r) => r.sec)) * 1.05;
    const tl = sims.map((r, i) => {
      const st = Economy.combatStatus(r.sec, t.clearSec, t.clearTol, r.cleared).cls;
      const segColors = { ok: "#1f8a4c", warn: "#b7791f", bad: "#c0392b" };
      let acc = 0;
      const segs = r.waveTimes.map((w, wi) => {
        const left = (acc / maxScale) * 100;
        const width = (w.sec / maxScale) * 100;
        acc += w.sec;
        const shade = wi % 2 ? 0.82 : 1;
        return `<div class="tl-seg" style="left:${left}%;width:${width}%;background:${segColors[st]};opacity:${shade}" title="웨이브 ${w.wave}: ${fmt1(w.sec)}s">${width > 7 ? "W" + w.wave : ""}</div>`;
      }).join("");
      const targetLeft = (t.clearSec / maxScale) * 100;
      return `<div class="tl-row" data-stage="${i}" style="cursor:pointer${i === selectedStage ? ";font-weight:700" : ""}">
        <div class="l">${r.id}</div>
        <div class="tl-track">${segs}<div class="tl-target" style="left:${targetLeft}%"></div></div>
        <div class="num" style="text-align:right;color:${segColors[st]}">${fmt1(r.sec)}s</div>
      </div>`;
    }).join("");

    // 선택 스테이지 상세
    const sr = sims[selectedStage];
    const stage = s.stages[selectedStage];
    const waveDetail = sr.waveTimes.map((w) => `<tr><td class="l">웨이브 ${w.wave}</td><td class="num">${w.enemies}</td><td class="num">${fmt1(w.sec)}s</td></tr>`).join("");
    const topDmg = sr.topDamage.filter((d) => d.dmg > 0).map((d) => {
      const max = sr.topDamage[0].dmg || 1;
      return `<tr><td class="l">${d.name}</td><td class="num">${fmtK(d.dmg)}</td><td><div class="bar ok"><i style="width:${(d.dmg / max) * 100}%"></i></div></td></tr>`;
    }).join("");
    const allyHp = sr.allyHp.map((a) => {
      const st = a.pct > 0.5 ? "ok" : a.pct > 0.2 ? "warn" : "bad";
      return `<tr><td class="l">${a.name}</td><td class="num">${Math.round(a.pct * 100)}%</td><td><div class="bar ${st}"><i style="width:${a.pct * 100}%"></i></div></td></tr>`;
    }).join("");

    // 원소 상성 매트릭스(팀 vs 적 첫 웨이브)
    const enemyEls = [...new Set(stage.waves.flatMap((w) => w.units.map((u) => u.element)))];
    const matchRows = s.team.map((u) => {
      const cells = enemyEls.map((e) => {
        const m = Data.elementMult(u.element, e);
        const cls = m > 1 ? "st-ok" : m < 1 ? "st-bad" : "";
        return `<td class="num ${cls}">×${m.toFixed(2)}</td>`;
      }).join("");
      return `<tr><td class="l">${u.name}(${Data.EL_KOR[u.element]})</td>${cells}</tr>`;
    }).join("");
    const matchTable = `<table class="grid" style="max-width:520px">
      <thead><tr><th class="l">아군 → 적속성</th>${enemyEls.map((e) => `<th class="num">${Data.EL_KOR[e]}</th>`).join("")}</tr></thead>
      <tbody>${matchRows}</tbody></table>`;

    const cs = Economy.combatStatus(sr.sec, t.clearSec, t.clearTol, sr.cleared);
    const stStatus = cs.cls;
    const detail = `<div class="row">
      <div class="col">
        <div class="section"><h2>웨이브별 소요 <span class="sub">${sr.id} · ${sr.name}</span> <span class="badge ${stStatus}">${sr.cleared ? fmt1(sr.sec) + "s" : "전멸(W" + sr.wipedAt + ")"}</span></h2>
          <table class="grid" style="max-width:420px"><thead><tr><th class="l">구간</th><th class="num">적 수</th><th class="num">소요</th></tr></thead><tbody>${waveDetail}</tbody>
          <tfoot><tr><td class="l">합계</td><td></td><td class="num total">${fmt1(sr.sec)}s</td></tr></tfoot></table>
        </div>
        <div class="section"><h2>원소 상성 <span class="sub">우세 ×1.30 / 열세 ×0.77</span></h2>${matchTable}</div>
      </div>
      <div class="col">
        <div class="section"><h2>딜량 기여</h2><table class="grid"><thead><tr><th class="l">아군</th><th class="num">누적딜</th><th>비중</th></tr></thead><tbody>${topDmg}</tbody></table></div>
        <div class="section"><h2>종료 시 아군 잔여 HP</h2><table class="grid"><thead><tr><th class="l">아군</th><th class="num">잔여</th><th>HP</th></tr></thead><tbody>${allyHp}</tbody></table></div>
      </div>
    </div>`;

    const ai = `<div class="ai">
      <h3><span class="g">AI</span> 전투 교정안</h3>
      <div style="margin-top:8px"><button class="btn accent" id="btn-sugg-combat">교정안 제안 받기</button>
        <span class="hint" style="margin-left:8px">2분 초과·전멸 스테이지를 분석해 몬스터 HP/팀 스탯 조정안을 제시합니다.</span></div>
      <div id="sugg-combat"></div>
    </div>`;

    return `<div class="sheet-inner">
      <div class="section"><h2>스테이지 클리어 타임라인 <span class="sub">행 클릭 시 상세 · 빨간선 = 2분</span></h2>
        <div class="timeline">${tl}</div></div>
      <div class="section"><h2>아군 팀 편성 <span class="sub">스탯 직접 교정</span></h2>${teamTable}</div>
      ${detail}
      <div class="section"><h2>AI 교정 <span class="sub">내장 AI</span></h2>${ai}</div>
    </div>`;
  }

  // ======================================================
  // 마스터 데이터 탭
  // ======================================================
  function master() {
    const s = Data.state, c = s.costs;
    const unit = `<table class="grid" style="max-width:640px">
      <thead><tr><th class="l">유닛 기본</th><th class="num">값</th><th class="l">유닛 기본</th><th class="num">값</th></tr></thead>
      <tbody>
        <tr><td class="l">최대 레벨</td>${edit("unit.maxLevel", s.unit.maxLevel, { step: 1 })}<td class="l">최대 성급</td>${edit("unit.maxStar", s.unit.maxStar, { step: 1 })}</tr>
        <tr><td class="l">기본 공격력</td>${edit("unit.base.atk", s.unit.base.atk, { step: 10 })}<td class="l">레벨당 공격</td>${edit("unit.perLevel.atk", s.unit.perLevel.atk, { step: 1 })}</tr>
        <tr><td class="l">기본 HP</td>${edit("unit.base.hp", s.unit.base.hp, { step: 100 })}<td class="l">레벨당 HP</td>${edit("unit.perLevel.hp", s.unit.perLevel.hp, { step: 10 })}</tr>
      </tbody></table>`;

    const lvl = `<table class="grid" style="max-width:640px">
      <thead><tr><th class="l">레벨업 곡선</th><th class="num">기본계수</th><th class="num">지수</th></tr></thead>
      <tbody>
        <tr><td class="l">골드 = base·lv^exp</td>${edit("costs.level.goldBase", c.level.goldBase, { step: 10 })}${edit("costs.level.goldExp", c.level.goldExp, { step: 0.05 })}</tr>
        <tr><td class="l">경험치 = base·lv^exp</td>${edit("costs.level.expBase", c.level.expBase, { step: 10 })}${edit("costs.level.expExp", c.level.expExp, { step: 0.05 })}</tr>
      </tbody></table>
      ${c.levelTable ? '<div class="hint">CSV로 불러온 레벨업 테이블이 곡선보다 우선 적용됩니다.</div>' : ""}`;

    const skills = `<table class="grid">
      <thead><tr><th class="l">스킬</th><th class="num">최대Lv</th><th class="num">골드base</th><th class="num">지수</th><th class="num">레벨당 북</th></tr></thead>
      <tbody>${["base", "special", "passive"].map((k) => {
        const sk = c.skills[k];
        return `<tr><td class="l">${sk.label}</td>${edit(`costs.skills.${k}.maxLevel`, sk.maxLevel, { step: 1 })}${edit(`costs.skills.${k}.goldBase`, sk.goldBase, { step: 100 })}${edit(`costs.skills.${k}.goldExp`, sk.goldExp, { step: 0.05 })}${edit(`costs.skills.${k}.bookPerLv`, sk.bookPerLv, { step: 1 })}</tr>`;
      }).join("")}</tbody></table>`;

    const star = `<table class="grid" style="max-width:520px">
      <thead><tr><th class="l">성급업</th><th class="num">골드</th><th class="num">재료</th></tr></thead>
      <tbody>${c.star.map((r, i) => `<tr><td class="l">${isNaN(r.from) ? "–" : r.from}★→${isNaN(r.to) ? "–" : r.to}★</td>${edit(`costs.star.${i}.gold`, r.gold, { step: 10000 })}${edit(`costs.star.${i}.shard`, r.shard, { step: 1 })}</tr>`).join("")}</tbody></table>`;

    const trait = `<table class="grid" style="max-width:520px">
      <thead><tr><th class="l">특성 Lv</th><th class="num">골드</th><th class="num">특성북</th></tr></thead>
      <tbody>${c.trait.map((r, i) => `<tr><td class="l">→ Lv.${r.lv}</td>${edit(`costs.trait.${i}.gold`, r.gold, { step: 10000 })}${edit(`costs.trait.${i}.book`, r.book, { step: 1 })}</tr>`).join("")}</tbody></table>`;

    // 임포트된 raw 테이블
    const raw = Object.keys(s.rawTables);
    const rawView = raw.length ? `<div class="section"><h2>불러온 CSV 마스터 <span class="sub">${raw.length}개 파일</span></h2>
      ${raw.map((name) => {
        const p = s.rawTables[name];
        const rows = p.records.slice(0, 6);
        return `<div style="margin-bottom:12px"><b>${name}.csv</b> <span class="muted">(${p.records.length}행 · ${p.fields.length}열)</span>
          <table class="mini"><thead><tr>${p.fields.slice(0, 8).map((f) => `<th>${f}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((rec) => `<tr>${p.fields.slice(0, 8).map((f) => `<td>${rec[f] == null ? "" : rec[f]}</td>`).join("")}</tr>`).join("")}</tbody></table>
          ${p.records.length > 6 ? `<div class="hint">…외 ${p.records.length - 6}행</div>` : ""}</div>`;
      }).join("")}</div>` : `<div class="section"><h2>불러온 CSV 마스터</h2><div class="hint">아직 불러온 파일이 없습니다. 상단 [CSV 불러오기]로 UnitMaster, UnitLevelUpCostMaster, StarUpCostMaster 등을 넣으면 곡선/테이블에 자동 매핑됩니다.</div></div>`;

    return `<div class="sheet-inner">
      <div class="row">
        <div class="col"><div class="section"><h2>유닛 마스터</h2>${unit}</div>
          <div class="section"><h2>레벨업 비용 곡선</h2>${lvl}</div></div>
        <div class="col"><div class="section"><h2>스킬 레벨업 비용</h2>${skills}</div></div>
      </div>
      <div class="row">
        <div class="col"><div class="section"><h2>성급업 비용</h2>${star}</div></div>
        <div class="col"><div class="section"><h2>특성 비용</h2>${trait}</div></div>
      </div>
      ${rawView}
    </div>`;
  }

  // ======================================================
  // AI 출력 렌더
  // ======================================================
  function renderSuggestions(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (data.raw) {
      el.innerHTML = `<div class="out" style="margin-top:10px">${escapeHtml(data.summary || "")}\n${escapeHtml(data.raw)}</div>`;
      return;
    }
    const cat = (window.Builder && Builder.patchCatalog) ? Builder.patchCatalog() : {};
    const num = (n) => Math.round(+n || 0).toLocaleString("en-US");
    function opText(p) {
      if (p.op === "mul") { const pct = Math.round((p.value - 1) * 100); return `×${p.value} (${pct >= 0 ? "+" : ""}${pct}%)`; }
      if (p.op === "add") return `${p.value >= 0 ? "+" : ""}${num(p.value)}`;
      return `= ${num(p.value)}`;
    }
    // 패치가 실제로 값을 바꾸는지(대상 컬럼 존재 + before≠after) 판정
    function info(p) {
      const e = p && cat[p.key];
      if (!e) return { ok: false, reason: "알 수 없는 대상" };
      if (!e.fieldExists) return { ok: false, reason: `대상 컬럼 '${e.field}'이 현재 데이터에 없음`, label: e.label, table: e.table, field: e.field };
      const b = e.current;
      const v = p.op === "mul" ? Math.round(b * p.value) : p.op === "add" ? Math.round(b + p.value) : Math.round(p.value);
      if (v === b) return { ok: false, reason: "변경 없음 (현재값과 동일)", label: e.label, table: e.table, field: e.field, before: b, after: v };
      return { ok: true, label: e.label, table: e.table, field: e.field, before: b, after: v };
    }

    const summary = data.summary ? `<div class="out" style="margin-top:10px"><b>${escapeHtml(data.summary)}</b></div>` : "";
    const corrections = data.corrections || [];
    const patchable = corrections.filter((c) => c.patch && info(c.patch).ok);
    const allDone = patchable.length && patchable.every((c) => c.applied);
    const applyAll = patchable.length
      ? `<div class="sgbar"><button class="btn accent" data-applyall="${containerId}"${allDone ? " disabled" : ""}>제안 일괄 적용 → CSV</button>
         <span class="hint">실제 변경되는 ${patchable.length}건만 관련 CSV에 반영${allDone ? " (적용 완료)" : ""}</span></div>`
      : "";

    const sugg = corrections.map((c, i) => {
      const inf = c.patch ? info(c.patch) : null;
      let foot;
      if (inf && inf.ok) {
        const change = `<code class="sgcode">${escapeHtml(inf.table)}.${escapeHtml(inf.field)} ${opText(c.patch)}</code><span class="sgdelta">${num(inf.before)} → <b>${num(inf.after)}</b></span>`;
        const btn = c.applied
          ? '<span class="sgdone">✓ 적용됨</span>'
          : `<button class="btn sgbtn" data-applyone="${i}" data-sg="${containerId}">적용</button>`;
        foot = `<div class="sgfoot">${change}${btn}</div>`;
      } else {
        const why = inf ? inf.reason : "자동 패치 대상 아님";
        foot = `<div class="sgfoot"><span class="sgpatch muted">⊘ 자동 적용 제외 · ${escapeHtml(why)} (수동 조정)</span></div>`;
      }
      return `<div class="sugg${c.applied ? " applied" : ""}">
        <div class="top"><span class="act">${escapeHtml(c.target || "")} — ${escapeHtml(c.action || "")}</span><span class="area">${escapeHtml(c.area || "")}</span></div>
        <div class="why">근거: ${escapeHtml(c.reason || "")}</div>
        ${c.expected ? `<div class="why">예상 효과: ${escapeHtml(c.expected)}</div>` : ""}
        ${foot}
      </div>`;
    }).join("");

    el.innerHTML = summary + applyAll + (sugg || '<div class="out empty" style="margin-top:8px">제안된 교정안이 없습니다 (목표 충족 상태일 수 있음).</div>');
  }

  // 마크다운-라이트 (줄 단위 파서: 제목·목록·표·문단·볼드/이탤릭/코드)
  function md(text) {
    const lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\*(?!\s)([^*]+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    const out = [];
    let i = 0, listType = null;
    const closeList = () => { if (listType) { out.push("</" + listType + ">"); listType = null; } };
    const isTableRow = (s) => /^\|.*\|?$/.test(s) && s.indexOf("|") >= 0;
    while (i < lines.length) {
      const raw = lines[i].trim();
      // 표: 헤더행 + 구분행(---) + 데이터행
      if (isTableRow(raw) && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim()) && lines[i + 1].indexOf("-") >= 0) {
        closeList();
        const cells = (r) => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        const header = cells(raw);
        i += 2;
        const body = [];
        while (i < lines.length && isTableRow(lines[i].trim())) { body.push(cells(lines[i].trim())); i++; }
        let t = '<table class="mdtable"><thead><tr>' + header.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
        t += body.map((r) => "<tr>" + r.map((c) => '<td>' + inline(c) + "</td>").join("") + "</tr>").join("");
        out.push(t + "</tbody></table>");
        continue;
      }
      let m;
      if ((m = raw.match(/^###\s+(.*)$/))) { closeList(); out.push("<h4>" + inline(m[1]) + "</h4>"); i++; continue; }
      if ((m = raw.match(/^##\s+(.*)$/)))  { closeList(); out.push("<h3>" + inline(m[1]) + "</h3>"); i++; continue; }
      if ((m = raw.match(/^#\s+(.*)$/)))   { closeList(); out.push("<h2>" + inline(m[1]) + "</h2>"); i++; continue; }
      if ((m = raw.match(/^[-*]\s+(.*)$/))) { if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); i++; continue; }
      if ((m = raw.match(/^\d+\.\s+(.*)$/))) { if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); i++; continue; }
      if (raw === "") { closeList(); i++; continue; }
      closeList(); out.push("<p>" + inline(raw) + "</p>"); i++;
    }
    closeList();
    return out.join("");
  }
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  Object.assign(window.Render, {
    combat, master, renderSuggestions, md, escapeHtml,
    getSelectedStage: () => selectedStage,
    setSelectedStage: (i) => { selectedStage = i; },
  });
})();
