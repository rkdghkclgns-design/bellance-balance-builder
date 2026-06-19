/* ============================================================
   render_builder.js — 데이터 빌더 탭 (도메인 내비 + 행 편집 그리드)
   · 폴더/다중 파일에서 CSV 전체 불러오기
   · 불러온 테이블은 CSV 원본(헤더·값) 그대로 표시/편집/내보내기
   ============================================================ */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let selectedTable = "UnitMaster";
  function setTable(name) { selectedTable = name; resetGridScroll(); }
  function getTable() { return selectedTable; }

  // 테이블 메타(스키마 + 불러온 테이블 모두 대응)
  function tinfo(name) {
    const S = window.Schema;
    const imported = Builder.isImported(name);
    const base = S.tables[name];
    return {
      kind: base ? base.kind : "imported",
      desc: base ? base.desc : "불러온 CSV (스키마 외)",
      columns: Builder.columns(name),
      imported: imported,
      schema: !!base,
    };
  }

  // ---- 좌측 내비 ----------------------------------------------
  function navItem(name) {
    const n = Builder.rows(name).length;
    const active = name === selectedTable;
    const imp = Builder.isImported(name) ? '<span class="bimp" title="CSV 원본 불러옴">●</span>' : "";
    return `<div class="bitem${active ? " active" : ""}" data-btab="${esc(name)}">
      <span class="bk">${esc(name)}${imp}</span>
      <span class="bn${n ? "" : " z"}">${n}</span>
    </div>`;
  }
  function nav() {
    const S = window.Schema;
    let html = S.domains.map((dom) => `<div class="bgroup">
        <div class="bgroup-h"><span class="dot" style="background:${dom.color}"></span>${esc(dom.label)}
          <span class="bgc">${dom.tables.length}</span></div>
        ${dom.tables.map(navItem).join("")}
      </div>`).join("");
    // 불러온(스키마 외) 테이블
    const extra = Builder.importedNames();
    if (extra.length) {
      html += `<div class="bgroup">
        <div class="bgroup-h"><span class="dot" style="background:#2b6cb0"></span>불러온 파일 · 기타
          <span class="bgc">${extra.length}</span></div>
        ${extra.map(navItem).join("")}
      </div>`;
    }
    return html;
  }

  // ---- 메인 그리드 --------------------------------------------
  // 가상 스크롤 상태 (대용량 테이블 성능: 보이는 행만 렌더)
  const VROW = 30, VWIN = 160, VTHRESHOLD = 250;
  let gridScroll = { top: 0, start: 0 };
  function setGridScroll(top) { gridScroll.top = top; }
  function getGridScroll() { return gridScroll.top; }
  function resetGridScroll() { gridScroll = { top: 0, start: 0 }; }

  function rowHtml(name, cols, row, ri, imported) {
    const cells = cols.map((c) => cell(name, ri, c, row[c.field], imported)).join("");
    return `<tr class="brow" data-brow="${ri}" data-brt="${esc(name)}">
        <td class="bidx"><span class="bgrip" draggable="true" title="드래그하여 순서 이동">⠿</span><span class="bidx-n">${ri + 1}</span></td>
        ${cells}
        <td class="bact">
          <button class="bx bdup" data-bdup="${esc(name)}" data-br="${ri}" title="복제">⎘</button>
          <button class="bx bdel" data-bdel="${esc(name)}" data-br="${ri}" title="삭제">✕</button>
        </td>
      </tr>`;
  }

  function grid() {
    const name = selectedTable;
    const info = tinfo(name);
    const cols = info.columns;
    if (!cols.length) return "<div class='hint'>테이블을 선택하세요.</div>";
    const list = Builder.rows(name);

    const headFields = cols.map((c) => {
      const ref = c.ref ? `<span class="bref" title="참조: ${c.ref}">${c.ref[0] === "@" ? "↗" : "▾"}</span>` : "";
      return `<th class="${typeAlign(c.type)}"><div class="bfield">${esc(c.field)}${ref}</div>
        <div class="bmeta"><span>${esc(c.type)}</span> · <span class="bsc-${String(c.scope).toLowerCase()}">${esc(c.scope)}</span></div></th>`;
    }).join("");
    const totalCols = cols.length + 2; // bidx + cols + bact

    if (!list.length) {
      return `<div class="bgridwrap"><table class="bgrid">
        <thead><tr><th class="bidx">#</th>${headFields}<th class="bact"></th></tr></thead>
        <tbody><tr><td class="bidx"></td><td colspan="${cols.length + 1}" class="bempty">행이 없습니다. [+ 행 추가]로 데이터를 입력하세요.</td></tr></tbody>
      </table></div>`;
    }

    // 소규모(임계 이하): 전체 렌더(기존 동작 그대로)
    if (list.length <= VTHRESHOLD) {
      const body = list.map((row, ri) => rowHtml(name, cols, row, ri, info.imported)).join("");
      return `<div class="bgridwrap" data-vgrid="0">
        <table class="bgrid"><thead><tr><th class="bidx">#</th>${headFields}<th class="bact"></th></tr></thead>
        <tbody>${body}</tbody></table>
      </div>`;
    }

    // 대용량: 보이는 구간만 렌더 + 상/하 스페이서로 스크롤바 보존
    let start = Math.max(0, Math.floor(gridScroll.top / VROW) - 30);
    const end = Math.min(list.length, start + VWIN);
    if (start > list.length - 1) start = Math.max(0, list.length - VWIN);
    gridScroll.start = start;
    const padTop = start * VROW;
    const padBot = Math.max(0, (list.length - end) * VROW);
    let body = "";
    if (padTop > 0) body += `<tr class="vspace" style="height:${padTop}px"><td colspan="${totalCols}" style="padding:0;border:none"></td></tr>`;
    for (let ri = start; ri < end; ri++) body += rowHtml(name, cols, list[ri], ri, info.imported);
    if (padBot > 0) body += `<tr class="vspace" style="height:${padBot}px"><td colspan="${totalCols}" style="padding:0;border:none"></td></tr>`;

    return `<div class="bgridwrap" data-vgrid="1" data-vrows="${list.length}">
      <table class="bgrid"><thead><tr><th class="bidx">#</th>${headFields}<th class="bact"></th></tr></thead>
      <tbody>${body}</tbody></table>
      <div class="vgrid-note">가상 스크롤 · ${list.length.toLocaleString()}행 중 ${start + 1}–${end} 표시</div>
    </div>`;
  }

  function typeAlign(type) {
    const t = String(type).toLowerCase();
    if (t.startsWith("int") || t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal")) return "num";
    return "l";
  }

  // 셀 렌더 — imported=true 면 CSV 원본값 그대로(가공 없이) 텍스트 표시
  function cell(name, ri, col, value, imported) {
    const t = String(col.type).toLowerCase();
    if (imported) {
      const align = typeAlign(col.type) === "num" ? " num" : " l";
      return `<td class="bedit${align}"><input type="text" class="binp btext" data-bt="${esc(name)}" data-br="${ri}" data-bf="${esc(col.field)}" value="${esc(value)}"></td>`;
    }
    // 참조(Define / 마스터 FK) → 드롭다운
    if (col.ref) {
      const opts = Builder.refOptions(col.ref) || [];
      const isFK = col.ref[0] === "@";
      const cur = value == null ? 0 : value;
      let optHtml = "";
      if (isFK) {
        optHtml += `<option value="0"${(+cur === 0) ? " selected" : ""}>0 · (없음)</option>`;
        optHtml += opts.filter((o) => o.id !== 0).map((o) => `<option value="${o.id}"${(+cur === o.id) ? " selected" : ""}>${o.id} · ${esc(o.label)}</option>`).join("");
      } else {
        optHtml = opts.map((o) => `<option value="${o.id}"${(+cur === o.id) ? " selected" : ""}>${o.id} · ${esc(o.label)}</option>`).join("");
      }
      if (!opts.some((o) => o.id === +cur) && !(isFK && +cur === 0)) {
        optHtml = `<option value="${esc(cur)}" selected>${esc(cur)} · (미정의)</option>` + optHtml;
      }
      return `<td class="bedit bselcell"><select class="bsel" data-bt="${esc(name)}" data-br="${ri}" data-bf="${esc(col.field)}">${optHtml}</select></td>`;
    }
    if (t.startsWith("bool")) {
      const v = value === true || value === "true" || value === 1 || value === "1";
      return `<td class="bedit bselcell"><select class="bsel bbool" data-bt="${esc(name)}" data-br="${ri}" data-bf="${esc(col.field)}">
        <option value="0"${!v ? " selected" : ""}>false</option><option value="1"${v ? " selected" : ""}>true</option></select></td>`;
    }
    if (t.startsWith("int") || t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal")) {
      const step = (t.startsWith("float") || t.startsWith("double") || t.startsWith("decimal")) ? ' step="0.01"' : "";
      return `<td class="bedit num"><input type="number" class="binp" data-bt="${esc(name)}" data-br="${ri}" data-bf="${esc(col.field)}" value="${esc(value)}"${step}></td>`;
    }
    if (t.startsWith("datetime")) {
      return `<td class="bedit l"><input type="text" class="binp btext" placeholder="YYYY-MM-DD HH:mm" data-bt="${esc(name)}" data-br="${ri}" data-bf="${esc(col.field)}" value="${esc(value)}"></td>`;
    }
    return `<td class="bedit l"><input type="text" class="binp btext" data-bt="${esc(name)}" data-br="${ri}" data-bf="${esc(col.field)}" value="${esc(value)}"></td>`;
  }

  // ---- 베이스라인(기준 저장) 바 ----
  function baselinesBar() {
    const list = Builder.baselines();
    if (!list.length) return "";
    const ftime = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
    const items = list.map((b, i) => `<span class="bl-item">
      <b>${esc(b.label)}</b> <span class="muted">${b.tables}테이블 · ${b.rows}행 · ${ftime(b.at)}</span>
      <button class="bl-btn" data-bl-restore="${i}">복원</button>
      <button class="bl-btn alt" data-bl-diff="${i}">비교</button>
      <button class="bl-x" data-bl-del="${i}" title="삭제">✕</button>
    </span>`).join("");
    return `<div class="baselinebar"><span class="bl-h">📌 저장된 기준</span>${items}</div>`;
  }

  // ---- 곡선 생성기 / 열 설정 / 일괄 편집 패널 -----------------
  var cg = {
    open: false, tab: "curve",
    type: "exp", base: 100, ratio: 1.35, count: 12, custom: "floor(base * pow(ratio, i))", col: "",
    bcol: "", bop: "mul", bval: 2, bround: "none", bfrom: 1, bto: 0,
    scol: "", sval: 0, sfind: "", srep: "",
  };
  function curveState() { return cg; }
  function fnum(n) { return (Math.round(+n || 0)).toLocaleString("en-US"); }
  function numCols(name) {
    return Builder.columns(name).filter(function (c) {
      if (Builder.isImported(name)) return true;
      var t = String(c.type).toLowerCase();
      return t.indexOf("int") === 0 || t.indexOf("float") === 0 || t.indexOf("double") === 0 || t.indexOf("decimal") === 0;
    }).map(function (c) { return c.field; });
  }
  // 미리보기 라인 차트(SVG)
  function curveChart(vals) {
    if (!vals || !vals.length) return '<div class="cg-empty">행 수를 1 이상으로 설정하세요.</div>';
    var W = 300, H = 96, ML = 2, MR = 2, MT = 12, MB = 2, PW = W - ML - MR, PH = H - MT - MB;
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals), span = (max - min) || 1, n = vals.length;
    var X = function (i) { return ML + (n <= 1 ? PW / 2 : (i / (n - 1)) * PW); };
    var Y = function (v) { return MT + PH - ((v - min) / span) * PH; };
    var pts = vals.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ");
    var area = "M" + X(0).toFixed(1) + "," + (MT + PH) + " L" + pts.split(" ").join(" L") + " L" + X(n - 1).toFixed(1) + "," + (MT + PH) + " Z";
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="cgchart">'
      + '<path d="' + area + '" fill="rgba(46,204,113,0.14)"/>'
      + '<polyline points="' + pts + '" fill="none" stroke="#2ecc71" stroke-width="2" vector-effect="non-scaling-stroke"/>'
      + '<circle cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(vals[n - 1]).toFixed(1) + '" r="2.6" fill="#2ecc71"/>'
      + '<text x="3" y="9" class="cg-axhi">' + fnum(max) + '</text>'
      + '<text x="3" y="' + (MT + PH - 2) + '" class="cg-axlo">' + fnum(min) + '</text></svg>';
  }
  function curveChartHTML(vals) { return curveChart(vals); }
  function sRow(key, label, val, min, max, step) {
    return '<div class="cg-srow"><div class="cg-slh"><span>' + label + '</span>'
      + '<input type="number" class="cg-num" id="cg-' + key + '-n" value="' + val + '" step="' + step + '"></div>'
      + '<input type="range" class="cg-range" id="cg-' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + Math.min(max, Math.max(min, val)) + '"></div>';
  }
  function colSel(id, cols, sel) {
    return '<select class="cg-sel" id="' + id + '">' + (cols.length
      ? cols.map(function (f) { return '<option value="' + esc(f) + '"' + (f === sel ? " selected" : "") + '>' + esc(f) + '</option>'; }).join("")
      : '<option value="">(숫자 열 없음)</option>') + '</select>';
  }
  function curveTab(name, cols) {
    if (cols.indexOf(cg.col) < 0) cg.col = cols[0] || "";
    var tBtn = function (k, l) { return '<button class="cg-type' + (cg.type === k ? " active" : "") + '" data-cgtype="' + k + '">' + l + '</button>'; };
    return '<p class="cg-desc">공식으로 수치 곡선을 생성합니다. 대상 열에 적용되며 행 수까지 한 번에 맞춥니다.</p>'
      + '<label class="cg-lab">대상 열</label>' + colSel("cg-col", cols, cg.col)
      + '<label class="cg-lab">곡선 유형</label><div class="cg-types">'
      + tBtn("linear", "선형") + tBtn("exp", "지수") + tBtn("poly", "다항") + tBtn("log", "로그") + tBtn("custom", "커스텀") + '</div>'
      + sRow("base", "기본값 (base)", cg.base, 1, 10000, 1)
      + sRow("ratio", "증가율 (ratio)", cg.ratio, 1, 3, 0.01)
      + sRow("count", "행 수 (count)", cg.count, 1, 200, 1)
      + (cg.type === "custom"
        ? '<textarea class="cg-formula" id="cg-custom" rows="2" spellcheck="false">' + esc(cg.custom) + '</textarea>'
        : '<div class="cg-formula" id="cg-formula">' + esc(Builder.curveFormula(cg)) + '</div>')
      + '<div class="cg-chartwrap" id="cg-chart">' + curveChart(Builder.curveValues(cg)) + '</div>'
      + '<button class="cg-apply" id="cg-apply">곡선 적용</button>'
      + '<div class="cg-vars"><div class="cg-vh">수식 변수</div>'
      + '<div><code>i</code> 행 인덱스 (0부터)</div><div><code>lvl</code> i+1 (1부터)</div><div><code>prev</code> 같은 열 이전 행 값</div></div>';
  }
  function bulkTab(name, cols) {
    if (cols.indexOf(cg.bcol) < 0) cg.bcol = cols[0] || "";
    var oBtn = function (k, l) { return '<button class="cg-type' + (cg.bop === k ? " active" : "") + '" data-cgbop="' + k + '">' + l + '</button>'; };
    var rBtn = function (k, l) { return '<button class="cg-type sm' + (cg.bround === k ? " active" : "") + '" data-cground="' + k + '">' + l + '</button>'; };
    var list = Builder.rows(name), prev = list.slice(0, 5).map(function (r, i) {
      var v = +r[cg.bcol] || 0, nv = cg.bop === "mul" ? v * cg.bval : cg.bop === "add" ? v + cg.bval : cg.bval;
      if (cg.bround === "floor") nv = Math.floor(nv); else if (cg.bround === "ceil") nv = Math.ceil(nv); else if (cg.bround === "round") nv = Math.round(nv);
      return '<div class="cg-pv"><span>#' + (i + 1) + '</span><b>' + fnum(v) + ' → ' + fnum(nv) + '</b></div>';
    }).join("");
    return '<p class="cg-desc">대상 열의 값을 한 번에 ×배수 / ＋증감 / ＝설정으로 변환합니다.</p>'
      + '<label class="cg-lab">대상 열</label>' + colSel("cg-bcol", cols, cg.bcol)
      + '<label class="cg-lab">연산</label><div class="cg-types">' + oBtn("mul", "× 배수") + oBtn("add", "＋ 증감") + oBtn("set", "＝ 설정") + '</div>'
      + '<label class="cg-lab">값</label><input type="number" class="cg-sel cg-numfull" id="cg-bval" value="' + cg.bval + '" step="0.01">'
      + '<label class="cg-lab">반올림</label><div class="cg-types">' + rBtn("none", "없음") + rBtn("floor", "내림") + rBtn("round", "반올림") + rBtn("ceil", "올림") + '</div>'
      + '<label class="cg-lab">행 범위 (0 = 전체)</label><div class="cg-range2"><input type="number" class="cg-sel" id="cg-bfrom" value="' + cg.bfrom + '" min="1"><span>~</span><input type="number" class="cg-sel" id="cg-bto" value="' + cg.bto + '" min="0"></div>'
      + '<div class="cg-prevbox">' + (prev || '<div class="cg-empty">행 없음</div>') + '</div>'
      + '<button class="cg-apply" id="cg-bapply">일괄 적용</button>';
  }
  function columnTab(name, cols) {
    if (cols.indexOf(cg.scol) < 0) cg.scol = cols[0] || "";
    var info = Builder.columns(name).find(function (c) { return c.field === cg.scol; }) || {};
    return '<p class="cg-desc">열 전체를 같은 값으로 채우거나, 특정 값을 찾아 바꿉니다.</p>'
      + '<label class="cg-lab">대상 열</label>' + colSel("cg-scol", cols, cg.scol)
      + '<div class="cg-info">타입 <b>' + esc(info.type || "-") + '</b> · 스코프 <b>' + esc(info.scope || "-") + '</b></div>'
      + '<label class="cg-lab">전체 채우기 값</label><input type="number" class="cg-sel cg-numfull" id="cg-sval" value="' + cg.sval + '" step="0.01">'
      + '<div class="cg-row2"><button class="cg-apply alt" id="cg-fill">전체 채우기</button><button class="cg-apply alt" id="cg-fillempty">빈 칸만</button></div>'
      + '<label class="cg-lab">값 찾아 바꾸기</label><div class="cg-range2"><input type="text" class="cg-sel" id="cg-sfind" placeholder="찾을 값" value="' + esc(cg.sfind) + '"><span>→</span><input type="text" class="cg-sel" id="cg-srep" placeholder="바꿀 값" value="' + esc(cg.srep) + '"></div>'
      + '<button class="cg-apply alt" id="cg-replace">찾아 바꾸기</button>';
  }
  function curvePanel() {
    if (!cg.open) return "";
    var name = selectedTable, cols = numCols(name);
    var tab = function (k, l) { return '<button class="cg-ptab' + (cg.tab === k ? " active" : "") + '" data-cgtab="' + k + '">' + l + '</button>'; };
    var body = cg.tab === "column" ? columnTab(name, cols) : cg.tab === "bulk" ? bulkTab(name, cols) : curveTab(name, cols);
    return '<div class="cgpanel"><div class="cg-ptabs">' + tab("curve", "곡선 생성기") + tab("column", "열 설정") + tab("bulk", "일괄 편집")
      + '<span class="cg-tgt" title="대상 테이블">' + esc(name) + '</span><button class="cg-close" id="cg-close" title="닫기">✕</button></div>'
      + '<div class="cg-pbody">' + body + '</div></div>';
  }

  // ---- 탭 전체 ------------------------------------------------
  function builder() {
    const S = window.Schema;
    const name = selectedTable;
    const info = tinfo(name);
    const list = Builder.rows(name);
    const kindBadge = info.imported
      ? '<span class="kbadge kimp">불러옴</span>'
      : (info.kind === "define" ? '<span class="kbadge kdef">Define</span>' : '<span class="kbadge kmas">Master</span>');

    const allNames = Object.keys(S.tables).concat(Builder.importedNames());
    const total = allNames.reduce((a, k) => a + Builder.rows(k).length, 0);
    const impN = allNames.filter((k) => Builder.isImported(k)).length;

    const head = `<div class="bhead">
      <div class="bhead-l">
        <div class="bhead-title">${esc(name)} ${kindBadge}</div>
        <div class="bhead-desc">${esc(info.desc)}${info.imported ? ' · <span style="color:#2b6cb0">CSV 원본 그대로 표시 중 (타입·스코프·필드·값 무가공)</span>' : ""}</div>
      </div>
      <div class="bhead-r">
        <span class="bstat">${info.columns.length}열 · ${list.length}행</span>
        <button class="btn" data-bcopy="${esc(name)}">CSV 복사</button>
        <button class="btn" data-bcsv="${esc(name)}">CSV 다운로드</button>
        <button class="btn accent" data-badd="${esc(name)}">+ 행 추가</button>
      </div>
    </div>`;

    const sim = (!info.imported && info.kind === "master" && ["UnitMaster","LevelUPDeltaStatMaster","UnitLevelUpCostMaster","StarUpCostMaster"].indexOf(name) >= 0)
      ? `<div class="bsim">⚡ 이 테이블의 값은 <b>대시보드·육성 경제·전투 시뮬·밸런스 기조</b> 계산에 즉시 반영됩니다.</div>` : "";

    return `<div class="sheet-inner bfull">
      <div class="bbar">
        <div class="bbar-l"><b>마스터 데이터 CSV 빌더</b>
          <span class="muted">마스터 ${Object.values(S.tables).filter((x)=>x.kind==="master").length}종 · Define ${Object.values(S.tables).filter((x)=>x.kind==="define").length}종${impN ? " · 불러옴 " + impN : ""} · 총 ${total}행</span></div>
        <div class="bbar-r">
          <button class="btn accent" id="b-load-folder">📁 폴더 전체 불러오기</button>
          <input type="file" id="b-folder-file" webkitdirectory directory multiple style="display:none">
          <button class="btn" id="b-load-files">CSV 파일 불러오기</button>
          <input type="file" id="b-files-file" accept=".csv" multiple style="display:none">
          <span class="bbar-sep"></span>
          <button class="btn" id="b-baseline" title="현재 데이터 테이블을 기준으로 저장">💾 기준 저장</button>
          <button class="btn" id="b-validate" title="중복 Id·참조 무결성 검증">🔍 검증</button>
          <button class="btn" id="b-auditlog" title="변경 이력(감사 로그)">📝 이력</button>
          <button class="btn accent" id="b-curve" title="곡선 생성 · 일괄 편집">📈 곡선·일괄</button>
          <span class="bbar-sep"></span>
          <button class="btn" id="b-import-json">JSON 불러오기</button>
          <input type="file" id="b-json-file" accept=".json" style="display:none">
          <button class="btn" id="b-export-json">JSON 스냅샷</button>
          <button class="btn" id="b-export-zip">전체 CSV · ZIP</button>
        </div>
      </div>
      <div id="b-loadlog" class="bloadlog"></div>
      ${baselinesBar()}
      <div id="b-audit" class="auditpanel"></div>
      <div class="aigen">
        <div class="aigen-row">
          <span class="aigen-label">🪄 AI 데이터 생성</span>
          <input id="ai-cmd" class="aigen-input" placeholder="예: 방어형 유닛 5개 만들어줘 / 화속성 보스 몬스터 3종 만들어줘">
          <button class="btn accent" id="ai-go">생성 시작</button>
        </div>
        <div id="ai-flow" class="aigen-flow"></div>
      </div>
      ${curvePanel()}
      <div class="bwrap">
        <div class="bnav">${nav()}</div>
        <div class="bmain">
          ${head}
          ${sim}
          ${grid()}
        </div>
      </div>
    </div>`;
  }

  window.Render = window.Render || {};
  Object.assign(window.Render, { builder, setBuilderTable: setTable, getBuilderTable: getTable, setGridScroll, getGridScroll, curveState, curveChartHTML });
})();
