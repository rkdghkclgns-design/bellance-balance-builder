/* ============================================================
   app.js — 탭 전환 · 편집 위임 · CSV 임포트 · Gemini 버튼 · 영속
   ============================================================ */
(function () {
  "use strict";
  const R = window.Render;

  let currentTab = "dashboard";
  const suggStore = {};   // containerId → 최근 교정안 데이터(적용 상태 추적)
  let dragRow = null;     // 빌더 행 드래그 상태
  const aigen = { stage: "idle", command: "", target: "", data: null, gen: null, error: "" };
  const TABS = [
    { id: "dashboard", label: "대시보드", color: "#2f6f4f" },
    { id: "economy",   label: "육성 경제",   color: "#b7791f" },
    { id: "combat",    label: "전투 시뮬",   color: "#c0392b" },
    { id: "doctrine",  label: "밸런스 기조", color: "#a23b72" },
    { id: "master",    label: "마스터 데이터", color: "#5b6570" },
    { id: "units",     label: "유닛 설계",   color: "#8e44ad" },
    { id: "builder",   label: "데이터 빌더", color: "#2b6cb0" },
  ];

  // ---------- path 유틸 ----------
  function setByPath(obj, path, value) {
    const parts = path.split(".");
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      o = o[k];
      if (o == null) { console.warn("[setByPath] 경로가 존재하지 않아 무시됨:", path); return; }
    }
    o[parts[parts.length - 1]] = value;
  }

  // ---------- 렌더 ----------
  function render() {
    const host = document.getElementById("sheet");
    // 데이터 빌더 외 탭은 항상 최신 CSV 기준으로 재동기화(실시간 반영)
    if (currentTab !== "builder" && window.Builder && Builder.syncAll) Builder.syncAll();
    if (currentTab === "dashboard")      host.innerHTML = R.dashboard();
    else if (currentTab === "economy")   host.innerHTML = R.economy();
    else if (currentTab === "combat")    host.innerHTML = R.combat();
    else if (currentTab === "doctrine")  host.innerHTML = R.doctrine();
    else if (currentTab === "master")    host.innerHTML = R.master();
    else if (currentTab === "units")     host.innerHTML = R.units();
    else if (currentTab === "builder")   host.innerHTML = R.builder();
    bindSheet();
    renderTabs();
    refreshDock();
  }

  // 전역 조정 패널(곡선·일괄·열) — 모든 탭에서 #cgdock 에 렌더
  function refreshDock() {
    const dock = document.getElementById("cgdock");
    if (!dock || !Render.curvePanel) return;
    const cg = Render.curveState ? Render.curveState() : null;
    dock.innerHTML = Render.curvePanel();
    document.body.classList.toggle("cg-open", !!(cg && cg.open));
    const btn = document.getElementById("btn-cgdock");
    if (btn) btn.classList.toggle("active", !!(cg && cg.open));
    bindCurvePanel();
  }

  function renderTabs() {
    document.querySelectorAll(".sheettabs .tab").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === currentTab);
    });
  }

  let rerenderTimer = null;
  function softRerender() {
    // 편집 중 포커스 잃지 않도록 디바운스 후 전체 재렌더
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => { render(); Data.save(); }, 350);
  }

  // ---------- 본문 이벤트 바인딩(위임) ----------
  function bindSheet() {
    const host = document.getElementById("sheet");

    // 편집 입력 (range 제외)
    host.querySelectorAll("input[data-path]:not([type=range])").forEach((inp) => {
      inp.addEventListener("input", () => {
        let v = inp.value === "" ? 0 : parseFloat(inp.value);
        if (isNaN(v)) v = 0;
        setByPath(Data.state, inp.dataset.path, v);
        liveUpdate();
        softRerender();
      });
    });

    // 슬라이더 — 즉시 반응(시뮬레이터 레벨·성급)
    host.querySelectorAll("input[type=range][data-path]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const v = parseInt(inp.value, 10) || 0;
        setByPath(Data.state, inp.dataset.path, v);
        render(); Data.save();
      });
    });

    // 셀렉트 — 유닛 선택 등 문자열 값
    host.querySelectorAll("select[data-path]").forEach((sel) => {
      sel.addEventListener("change", () => {
        setByPath(Data.state, sel.dataset.path, sel.value);
        render(); Data.save();
      });
    });

    // 수급 모드 토글
    host.querySelectorAll("[data-incmode]").forEach((b) => {
      b.addEventListener("click", () => { Data.state.income.mode = b.dataset.incmode; render(); Data.save(); });
    });

    // 스테이지 선택
    host.querySelectorAll("[data-stage]").forEach((row) => {
      row.addEventListener("click", () => { R.setSelectedStage(+row.dataset.stage); render(); });
    });

    // 합산표 행 세부 펼치기
    host.querySelectorAll("[data-costrow]").forEach((row) => {
      row.addEventListener("click", () => { R.toggleCostDetail(row.dataset.costrow); render(); });
    });

    // 데이터 빌더 컨트롤
    bindBuilder(host);

    // AI 버튼
    const bReport = document.getElementById("btn-report");
    if (bReport) bReport.addEventListener("click", onReport);
    const bGrow = document.getElementById("btn-sugg-growth");
    if (bGrow) bGrow.addEventListener("click", () => onSuggest("growth", "sugg-growth", bGrow));
    const bComb = document.getElementById("btn-sugg-combat");
    if (bComb) bComb.addEventListener("click", () => onSuggest("combat", "sugg-combat", bComb));
  }

  // 편집 시 즉시 KPI 일부만 갱신(시각적 반응성)
  function liveUpdate() { /* softRerender가 전체를 처리; 자리표시 */ }

  // ---------- 데이터 빌더 ----------
  function loadCsvFiles(files) {
    const csvs = [...files].filter((f) => /\.csv$/i.test(f.name));
    if (!csvs.length) { toast("CSV 파일이 없습니다."); return; }
    let done = 0, ok = 0, lastName = null;
    const lines = [];
    csvs.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base = file.name.replace(/.*[\\/]/, "").replace(/\.csv$/i, "");
        const res = Builder.importCSV(base, reader.result);
        if (res && res.error) lines.push(`<span class="lf">${base}.csv</span><span class="le">${res.error}</span>`);
        else { ok++; lastName = base; lines.push(`<span class="lf">${base}.csv</span><span class="lo">${res.rows}행 · ${res.cols}열${Builder.isTable(base) ? "" : " · 신규"}</span>`); }
        done++;
        if (done === csvs.length) finish();
      };
      reader.onerror = () => { lines.push(`<span class="lf">${file.name}</span><span class="le">읽기 실패</span>`); if (++done === csvs.length) finish(); };
      reader.readAsText(file, "utf-8");
    });
    function finish() {
      if (lastName) R.setBuilderTable(lastName);
      // 전체 파일 적재 후 시뮬 상태를 한 번 더 완전 재동기화(비동기 적재 순서와 무관하게 보장)
      if (window.Builder && Builder.syncAll) Builder.syncAll();
      render();
      const lg = document.getElementById("b-loadlog");
      // 시뮬 반영 요약 — 다른 탭(대시보드·전투·육성경제)이 실제로 무엇을 반영하는지 즉시 표시.
      // 여기에 시드 유닛(SSR_프로토)이 그대로 보이면 파일명이 테이블명과 안 맞은 것.
      let syncLine = "";
      try {
        const u = Data.state.unit, stg = (Data.state.stages || []).length, lvN = (Data.state.costs.levelTable || []).length;
        syncLine = `<div class="bll-row" style="color:#1f8a4c;font-weight:600">✓ 다른 탭 자동 반영됨 — 대표 유닛 <b>${u.name}</b> (HP ${u.base.hp}/ATK ${u.base.atk}) · 스테이지 ${stg}개 · 레벨비용 ${lvN}행</div>`;
      } catch (_) {}
      if (lg) lg.innerHTML = `<div class="bll-h">불러오기 완료 · ${ok}/${csvs.length} 파일 (원본 그대로 적재)</div>` + syncLine + lines.map((l) => `<div class="bll-row">${l}</div>`).join("");
      toast(`${ok}개 CSV를 불러왔습니다. (대시보드·전투·육성경제 자동 반영)`);
      // 무결성 게이트: 적재 직후 검증, 치명 이슈 시 경고
      try {
        const v = Builder.validate();
        if (v && v.total > 0) {
          const lg2 = document.getElementById("b-loadlog");
          if (lg2) lg2.insertAdjacentHTML("beforeend", `<div class="bll-row" style="color:#c0392b;font-weight:600">⚠ 무결성 경고: 중복 Id ${v.dupes} · 빈 Id ${v.empties} · 참조 오류 ${v.refErr} (총 ${v.total}건) — [🔍 검증]에서 확인</div>`);
        }
      } catch (_) {}
    }
  }

  function bindBuilder(host) {
    if (!host.querySelector(".bwrap")) return; // 빌더 탭 아닐 때 종료

    // 가상 스크롤: 스크롤 위치 복원 + 구간 변경 시에만 재렌더
    const gw = host.querySelector(".bgridwrap[data-vgrid='1']");
    if (gw) {
      gw.scrollTop = R.getGridScroll();
      let raf = null, lastStart = Math.max(0, Math.floor(R.getGridScroll() / 30) - 30);
      gw.addEventListener("scroll", () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const top = gw.scrollTop;
          const start = Math.max(0, Math.floor(top / 30) - 30);
          if (Math.abs(start - lastStart) < 40) return; // 구간 변동 적으면 스킵(루프 방지)
          lastStart = start;
          R.setGridScroll(top);
          render();
        });
      });
    }

    // 테이블 선택
    host.querySelectorAll("[data-btab]").forEach((el) => {
      el.addEventListener("click", () => { R.setBuilderTable(el.dataset.btab); render(); });
    });

    // 셀 편집 — 숫자/텍스트는 타이핑 중 포커스 유지(input=저장만, change=재렌더)
    host.querySelectorAll("input.binp[data-bt]").forEach((inp) => {
      inp.addEventListener("input", () => {
        Builder.setCell(inp.dataset.bt, +inp.dataset.br, inp.dataset.bf, inp.value);
      });
      inp.addEventListener("change", () => { render(); });
    });
    // 셀렉트(참조/bool) — 즉시 재렌더
    host.querySelectorAll("select.bsel[data-bt]").forEach((sel) => {
      sel.addEventListener("change", () => {
        Builder.setCell(sel.dataset.bt, +sel.dataset.br, sel.dataset.bf, sel.value);
        render();
      });
    });

    // 행 추가 / 삭제 / 복제
    host.querySelectorAll("[data-badd]").forEach((b) => b.addEventListener("click", () => { Builder.addRow(b.dataset.badd); render(); }));
    host.querySelectorAll("[data-bdel]").forEach((b) => b.addEventListener("click", () => { Builder.deleteRow(b.dataset.bdel, +b.dataset.br); render(); }));
    host.querySelectorAll("[data-bdup]").forEach((b) => b.addEventListener("click", () => { Builder.dupRow(b.dataset.bdup, +b.dataset.br); render(); }));

    // 테이블별 CSV 다운로드 / 복사
    host.querySelectorAll("[data-bcsv]").forEach((b) => b.addEventListener("click", () => { Builder.downloadCSV(b.dataset.bcsv); toast(b.dataset.bcsv + ".csv 다운로드"); }));
    host.querySelectorAll("[data-bcopy]").forEach((b) => b.addEventListener("click", () => { Builder.copyCSV(b.dataset.bcopy).then(() => toast(b.dataset.bcopy + " CSV를 클립보드에 복사했습니다.")); }));

    // 전체 내보내기
    const zip = document.getElementById("b-export-zip");
    if (zip) zip.addEventListener("click", () => { Builder.downloadAllZip(); toast("전체 테이블을 ZIP으로 내보냈습니다."); });
    // 폴더/파일 불러오기
    const fb = document.getElementById("b-load-folder"), fbf = document.getElementById("b-folder-file");
    if (fb && fbf) { fb.addEventListener("click", () => fbf.click()); fbf.addEventListener("change", () => { loadCsvFiles(fbf.files); fbf.value = ""; }); }
    const lf = document.getElementById("b-load-files"), lff = document.getElementById("b-files-file");
    if (lf && lff) { lf.addEventListener("click", () => lff.click()); lff.addEventListener("change", () => { loadCsvFiles(lff.files); lff.value = ""; }); }

    // 행 드래그 순서 이동
    host.querySelectorAll(".bgrip").forEach((grip) => {
      grip.addEventListener("dragstart", (e) => {
        const tr = grip.closest(".brow");
        dragRow = { table: tr.dataset.brt, from: +tr.dataset.brow };
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", String(dragRow.from)); } catch (_) {}
        tr.classList.add("dragging");
      });
      grip.addEventListener("dragend", () => {
        dragRow = null;
        host.querySelectorAll(".brow").forEach((r) => r.classList.remove("drop-target", "dragging"));
      });
      // 터치 드래그(모바일/태블릿) — HTML5 DnD 미지원 보완.
      // 터치 이벤트는 시작 요소(grip)에 계속 발생하므로 grip 단위로 바인딩 → 재렌더 시 리스너 중복 누적 없음.
      grip.addEventListener("touchstart", () => {
        const tr = grip.closest(".brow"); if (!tr) return;
        dragRow = { table: tr.dataset.brt, from: +tr.dataset.brow };
        tr.classList.add("dragging");
      }, { passive: true });
      grip.addEventListener("touchmove", (e) => {
        if (!dragRow) return;
        e.preventDefault(); // 드래그 중 페이지 스크롤 방지
        const t = e.touches[0]; if (!t) return;
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const tr = el && el.closest ? el.closest(".brow") : null;
        host.querySelectorAll(".brow.drop-target").forEach((r) => r.classList.remove("drop-target"));
        if (tr && tr.dataset.brt === dragRow.table) tr.classList.add("drop-target");
      }, { passive: false });
      grip.addEventListener("touchend", (e) => {
        if (!dragRow) return;
        const t = e.changedTouches && e.changedTouches[0];
        const el = t && document.elementFromPoint(t.clientX, t.clientY);
        const tr = el && el.closest ? el.closest(".brow") : null;
        const tbl = dragRow.table, from = dragRow.from;
        const moved = tr && tr.dataset.brt === tbl && +tr.dataset.brow !== from;
        const to = tr ? +tr.dataset.brow : -1;
        dragRow = null;
        if (moved) { Builder.moveRow(tbl, from, to); render(); }
        else host.querySelectorAll(".brow").forEach((r) => r.classList.remove("drop-target", "dragging"));
      });
    });
    host.querySelectorAll(".brow").forEach((tr) => {
      tr.addEventListener("dragover", (e) => {
        if (!dragRow || tr.dataset.brt !== dragRow.table) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        host.querySelectorAll(".brow.drop-target").forEach((r) => { if (r !== tr) r.classList.remove("drop-target"); });
        tr.classList.add("drop-target");
      });
      tr.addEventListener("dragleave", () => tr.classList.remove("drop-target"));
      tr.addEventListener("drop", (e) => {
        if (!dragRow || tr.dataset.brt !== dragRow.table) return;
        e.preventDefault();
        const to = +tr.dataset.brow;
        Builder.moveRow(dragRow.table, dragRow.from, to);
        dragRow = null;
        render();
      });
    });
    const ej = document.getElementById("b-export-json");
    if (ej) ej.addEventListener("click", () => { Builder.exportJSON(); toast("JSON 스냅샷을 내보냈습니다."); });
    const ij = document.getElementById("b-import-json");
    const ijf = document.getElementById("b-json-file");
    if (ij && ijf) {
      ij.addEventListener("click", () => ijf.click());
      ijf.addEventListener("change", () => {
        const file = ijf.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try { const ok = Builder.importJSON(JSON.parse(reader.result)); toast(ok ? "JSON을 불러왔습니다." : "형식이 올바르지 않습니다."); render(); }
          catch (e) { toast("JSON 파싱 오류: " + e.message); }
        };
        reader.readAsText(file, "utf-8"); ijf.value = "";
      });
    }

    // 베이스라인(기준 저장)
    const bBase = document.getElementById("b-baseline");
    if (bBase) bBase.addEventListener("click", () => { const n = Builder.saveBaseline(); render(); toast("현재 데이터를 " + n + "차 기준으로 저장했습니다."); });
    host.querySelectorAll("[data-bl-restore]").forEach((b) => b.addEventListener("click", () => {
      if (confirm("저장된 기준으로 되돌릴까요? 현재 편집 내용은 덮어쓰여집니다.")) { Builder.restoreBaseline(+b.dataset.blRestore); render(); toast("기준 데이터로 복원했습니다."); }
    }));
    host.querySelectorAll("[data-bl-del]").forEach((b) => b.addEventListener("click", () => { Builder.deleteBaseline(+b.dataset.blDel); render(); }));
    // 검증 / 기준 비교
    const bVal = document.getElementById("b-validate");
    if (bVal) bVal.addEventListener("click", () => renderAudit({ type: "validate" }));
    host.querySelectorAll("[data-bl-diff]").forEach((b) => b.addEventListener("click", () => renderAudit({ type: "diff", idx: +b.dataset.blDiff })));
    const bAudit = document.getElementById("b-auditlog");
    if (bAudit) bAudit.addEventListener("click", () => renderAudit({ type: "audit" }));

    // AI 데이터 생성
    const aiGo = document.getElementById("ai-go");
    if (aiGo) aiGo.addEventListener("click", aiStart);
    const aiCmd = document.getElementById("ai-cmd");
    if (aiCmd) { aiCmd.value = aigen.command || ""; aiCmd.addEventListener("keydown", (e) => { if (e.key === "Enter") aiStart(); }); }
    renderAiFlow();
    // 빌더 툴바의 '📈 곡선·일괄' 토글 → 전역 조정 패널 열고 닫기
    const cv = document.getElementById("b-curve");
    if (cv) cv.addEventListener("click", () => { const cg = Render.curveState(); cg.open = !cg.open; refreshDock(); });
  }

  // ---------- 곡선 생성기 / 일괄 편집 / 열 설정 패널 (전역 #cgdock) ----------
  function bindCurvePanel() {
    if (!Render.curveState) return;
    const cg = Render.curveState();
    const tbl = () => cg.table || R.getBuilderTable();
    // 닫기
    const cls = document.getElementById("cg-close");
    if (cls) cls.addEventListener("click", () => { cg.open = false; refreshDock(); });
    if (!cg.open) return;
    const host = document.getElementById("cgdock");
    if (!host) return;
    // 대상 테이블 선택 → 패널만 갱신(열 선택은 새 테이블 기준으로 자동 보정)
    const tsel = document.getElementById("cg-table");
    if (tsel) tsel.addEventListener("change", () => { cg.table = tsel.value; refreshDock(); });
    // 이산 클릭(서브탭·유형·연산·반올림) → 패널만 갱신
    host.querySelectorAll("[data-cgtab]").forEach((b) => b.addEventListener("click", () => { cg.tab = b.dataset.cgtab; refreshDock(); }));
    host.querySelectorAll("[data-cgtype]").forEach((b) => b.addEventListener("click", () => { cg.type = b.dataset.cgtype; refreshDock(); }));
    host.querySelectorAll("[data-cgbop]").forEach((b) => b.addEventListener("click", () => { cg.bop = b.dataset.cgbop; refreshDock(); }));
    host.querySelectorAll("[data-cground]").forEach((b) => b.addEventListener("click", () => { cg.bround = b.dataset.cground; refreshDock(); }));
    // 대상 열 셀렉트(미리보기에 영향 없음 → 상태만 갱신)
    const onSel = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => { cg[key] = el.value; }); };
    onSel("cg-col", "col"); onSel("cg-bcol", "bcol");
    // 곡선 슬라이더+숫자 동기화 + 라이브 미리보기(풀 렌더 없이 공식·차트만 갱신)
    function preview() {
      const f = document.getElementById("cg-formula"); if (f) f.textContent = Builder.curveFormula(cg);
      const ch = document.getElementById("cg-chart"); if (ch) ch.innerHTML = Render.curveChartHTML(Builder.curveValues(cg));
    }
    function pair(key, min, max) {
      const r = document.getElementById("cg-" + key), n = document.getElementById("cg-" + key + "-n");
      const set = (raw, other) => { const v = parseFloat(raw); if (isNaN(v)) return; cg[key] = v; if (other === "r" && r) r.value = Math.min(max, Math.max(min, v)); if (other === "n" && n) n.value = v; preview(); };
      if (r) r.addEventListener("input", () => set(r.value, "n"));
      if (n) n.addEventListener("input", () => set(n.value, "r"));
    }
    pair("base", 1, 10000); pair("ratio", 1, 3); pair("count", 1, 200);
    const cust = document.getElementById("cg-custom");
    if (cust) cust.addEventListener("input", () => { cg.custom = cust.value; const ch = document.getElementById("cg-chart"); if (ch) ch.innerHTML = Render.curveChartHTML(Builder.curveValues(cg)); });
    const apply = document.getElementById("cg-apply");
    if (apply) apply.addEventListener("click", () => { const res = Builder.applyCurve(tbl(), cg.col, cg); if (res.ok) { toast(`곡선을 ${cg.col}에 적용했습니다 (${res.count}행)`); render(); } else toast(res.msg || "적용 실패"); });
    // 일괄 편집
    const num = (id, key, int) => { const el = document.getElementById(id); if (el) el.addEventListener("input", () => { cg[key] = int ? (parseInt(el.value, 10) || 0) : (parseFloat(el.value) || 0); }); };
    num("cg-bval", "bval"); num("cg-bfrom", "bfrom", true); num("cg-bto", "bto", true);
    const bAp = document.getElementById("cg-bapply");
    if (bAp) bAp.addEventListener("click", () => { const res = Builder.bulkEdit(tbl(), cg.bcol, cg.bop, cg.bval, cg.bround, cg.bfrom, cg.bto); if (res.ok) { toast(`일괄 적용했습니다 (${res.count}행)`); render(); } else toast(res.msg || "적용 실패"); });
    // 열 설정 — 컬럼 에디터(이름/타입/수식+칩/소수자릿수/적용/삭제)
    const scolSel = document.getElementById("cg-scol");
    if (scolSel) scolSel.addEventListener("change", () => { cg.scol = scolSel.value; cg._lastScol = null; refreshDock(); });
    const sname = document.getElementById("cg-sname");
    if (sname) sname.addEventListener("change", () => {
      const res = Builder.renameColumn(tbl(), cg.scol, sname.value);
      if (res.ok) { cg.scol = res.field; cg.sname = res.field; cg._lastScol = res.field; toast("열 이름 변경: " + res.field); render(); }
      else { toast(res.msg || "이름 변경 실패"); sname.value = cg.scol; }
    });
    const stype = document.getElementById("cg-stype");
    if (stype) stype.addEventListener("change", () => { cg.stype = stype.value; Builder.setColumnType(tbl(), cg.scol, stype.value); render(); });
    const scolPrev = () => { const ch = document.getElementById("cg-scolchart"); if (ch) ch.innerHTML = Render.curveChartHTML(Builder.colFormulaValues(tbl(), cg.sformula, cg.sdec)); };
    const sform = document.getElementById("cg-sformula");
    if (sform) sform.addEventListener("input", () => { cg.sformula = sform.value; scolPrev(); });
    host.querySelectorAll("[data-cgchip]").forEach((b) => b.addEventListener("click", () => {
      const ta = document.getElementById("cg-sformula"); if (!ta) return;
      const tok = b.dataset.cgchip;
      const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      const e = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
      ta.value = ta.value.slice(0, s) + tok + ta.value.slice(e); cg.sformula = ta.value;
      ta.focus(); try { ta.selectionStart = ta.selectionEnd = s + tok.length; } catch (_) {} scolPrev();
    }));
    host.querySelectorAll("[data-cgdec]").forEach((b) => b.addEventListener("click", () => { cg.sdec = +b.dataset.cgdec; refreshDock(); }));
    const applycol = document.getElementById("cg-applycol");
    if (applycol) applycol.addEventListener("click", () => { const res = Builder.applyColumnFormula(tbl(), cg.scol, cg.sformula, cg.sdec); if (res.ok) { toast(`${cg.scol}에 수식 적용 (${res.count}행)`); render(); } else toast(res.msg || "적용 실패"); });
    const delcol = document.getElementById("cg-delcol");
    if (delcol) delcol.addEventListener("click", () => { if (cg.scol && confirm(`'${cg.scol}' 열을 삭제할까요?`)) { Builder.deleteColumn(tbl(), cg.scol); cg.scol = ""; cg._lastScol = null; render(); toast("열 삭제됨"); } });
  }

  // ---------- AI 자연어 데이터 생성 (인터뷰 → 생성 → 미리보기 → 적용) ----------
  function aiStart() {
    const inp = document.getElementById("ai-cmd");
    const cmd = inp ? inp.value.trim() : "";
    if (!cmd) { toast("명령을 입력하세요. 예: 방어형 유닛 5개 만들어줘"); return; }
    aigen.command = cmd; aigen.data = null; aigen.gen = null; aigen.error = ""; aigen.stage = "loading";
    renderAiFlow();
    Gemini.interview(cmd)
      .then((res) => { aigen.data = res; aigen.stage = "interview"; renderAiFlow(); })
      .catch((e) => { aigen.stage = "error"; aigen.error = e.message; renderAiFlow(); });
  }
  function aiProceed() {
    const data = aigen.data; if (!data) return;
    const answers = {};
    (data.questions || []).forEach((q) => {
      const el = document.getElementById("aiq-" + q.id);
      if (el) answers[q.label || q.id] = el.value;
    });
    const target = (data.target && Builder.isTable(data.target)) ? data.target
      : (Builder.isTable(R.getBuilderTable()) ? R.getBuilderTable() : "UnitMaster");
    aigen.target = target; aigen.stage = "generating"; renderAiFlow();
    const ctx = Builder.genContext(target);
    Gemini.generateRows(aigen.command, target, data.count || 0, answers, ctx)
      .then((res) => { aigen.gen = res; aigen.stage = "preview"; renderAiFlow(); })
      .catch((e) => { aigen.stage = "error"; aigen.error = e.message; renderAiFlow(); });
  }
  function aiApply() {
    const g = aigen.gen; if (!g || !g.rows) return;
    const table = g.table && Builder.isTable(g.table) ? g.table : aigen.target;
    const n = Builder.appendRows(table, g.rows);
    R.setBuilderTable(table);
    aigen.stage = "idle"; aigen.data = null; aigen.gen = null; aigen.command = "";
    render();
    toast(n + "개 행을 " + table + "에 추가했습니다.");
  }
  function aiCancel() { aigen.stage = "idle"; aigen.data = null; aigen.gen = null; renderAiFlow(); }

  // ---------- 데이터 검증 / 기준 비교 결과 ----------
  function renderAudit(opt) {
    const el = document.getElementById("b-audit");
    if (!el) return;
    const esc = R.escapeHtml;
    if (opt.type === "validate") {
      const v = Builder.validate();
      if (!v.total) { el.innerHTML = '<div class="audit-card okc">✓ 검증 통과 — 중복 Id·빈 Id·참조 오류 없음 (' + v.tables + '개 테이블) <button class="btn" id="audit-close">닫기</button></div>'; bindAudit(); return; }
      const rows = v.issues.map((it) => `<tr><td class="l">${esc(it.table)}</td><td class="num">${it.row}</td><td class="l"><span class="audit-t">${esc(it.type)}</span></td><td class="l">${esc(it.detail)}</td></tr>`).join("");
      el.innerHTML = `<div class="audit-card">
        <div class="audit-head">🔍 검증 결과 <span class="muted">중복 Id ${v.dupes} · 빈 Id ${v.empties} · 참조 오류 ${v.refErr} (총 ${v.total}건${v.capped ? ", 상위 " + v.issues.length + "건" : ""})</span><button class="btn" id="audit-close">닫기</button></div>
        <div class="audit-scroll"><table class="mini"><thead><tr><th>테이블</th><th>행</th><th>유형</th><th>내용</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
    } else if (opt.type === "diff") {
      const d = Builder.diff(opt.idx);
      if (!d) { el.innerHTML = ""; return; }
      if (!d.tables.length) { el.innerHTML = '<div class="audit-card okc">✓ ' + esc(d.label) + ' 기준과 현재가 동일합니다 (변경 없음). <button class="btn" id="audit-close">닫기</button></div>'; bindAudit(); return; }
      const rows = d.tables.map((t) => {
        const ch = t.changes.map((c) => `${c.id}: ${esc(c.flds.join(", "))}`).join("  ·  ");
        return `<tr><td class="l">${esc(t.table)}</td><td class="num" style="color:#1f8a4c">+${t.added}</td><td class="num" style="color:#c0392b">−${t.removed}</td><td class="num" style="color:#b7791f">~${t.changed}</td><td class="l muted" style="max-width:380px;white-space:normal">${ch}</td></tr>`;
      }).join("");
      el.innerHTML = `<div class="audit-card">
        <div class="audit-head">≠ ${esc(d.label)} 대비 변경점 <span class="muted">추가 ${d.tAdd} · 삭제 ${d.tRem} · 변경 ${d.tChg}</span><button class="btn" id="audit-close">닫기</button></div>
        <div class="audit-scroll"><table class="mini"><thead><tr><th>테이블</th><th>추가</th><th>삭제</th><th>변경</th><th>변경 상세(일부)</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
    } else if (opt.type === "audit") {
      const log = Builder.auditLog();
      if (!log.length) { el.innerHTML = '<div class="audit-card okc">기록된 변경 이력이 없습니다. <button class="btn" id="audit-close">닫기</button></div>'; bindAudit(); return; }
      const ft = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
      const aLabel = { edit: "수정", add: "추가", delete: "삭제", duplicate: "복제" };
      const rows = log.slice(0, 300).map((e) => `<tr><td class="l muted">${ft(e.ts)}</td><td class="l">${esc(e.table)}</td><td class="num">${e.row != null ? e.row : "–"}</td><td class="l">${esc(e.field || "")}</td><td class="l"><span class="audit-t">${aLabel[e.action] || e.action}</span></td><td class="l muted">${esc(e.old)} → <b>${esc(e.val)}</b></td></tr>`).join("");
      el.innerHTML = `<div class="audit-card">
        <div class="audit-head">📝 변경 이력 (감사 로그) <span class="muted">최근 ${Math.min(log.length, 300)} / 총 ${log.length}건</span><button class="btn" id="audit-close">닫기</button></div>
        <div class="audit-scroll"><table class="mini"><thead><tr><th>시각</th><th>테이블</th><th>행</th><th>필드</th><th>동작</th><th>변경</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
    }
    bindAudit();
  }
  function bindAudit() {
    const cl = document.getElementById("audit-close");
    if (cl) cl.onclick = () => { const el = document.getElementById("b-audit"); if (el) el.innerHTML = ""; };
  }
  function bindFlow() {
    const p = document.getElementById("ai-proceed"); if (p) p.onclick = aiProceed;
    const ap = document.getElementById("ai-apply"); if (ap) ap.onclick = aiApply;
    const c = document.getElementById("ai-cancel"); if (c) c.onclick = aiCancel;
  }
  function renderAiFlow() {
    const el = document.getElementById("ai-flow");
    if (!el) return;
    const esc = R.escapeHtml, a = aigen;
    if (a.stage === "idle") { el.innerHTML = ""; return; }
    if (a.stage === "loading") { el.innerHTML = '<div class="aig-card"><span class="spin"></span> 인터뷰 질문 준비 중…</div>'; return; }
    if (a.stage === "generating") { el.innerHTML = '<div class="aig-card"><span class="spin"></span> 데이터 생성 중… (' + esc(a.target) + ')</div>'; return; }
    if (a.stage === "error") { el.innerHTML = '<div class="aig-card" style="color:#c0392b">오류: ' + esc(a.error || "") + ' <button class="btn" id="ai-cancel">닫기</button></div>'; bindFlow(); return; }
    if (a.stage === "interview") {
      const d = a.data || {};
      const qs = (d.questions || []).map((q) => {
        const ctrl = (q.options && q.options.length)
          ? `<select id="aiq-${esc(q.id)}" class="aig-input">${q.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select>`
          : `<input id="aiq-${esc(q.id)}" class="aig-input" placeholder="${esc(q.hint || "")}">`;
        return `<div class="aig-q"><label>${esc(q.label || q.id)}</label>${ctrl}</div>`;
      }).join("");
      el.innerHTML = `<div class="aig-card">
        <div class="aig-head">${esc(d.intro || "방향 인터뷰")} <span class="muted">→ ${esc(d.target || "")} · ${d.count || "?"}행</span></div>
        ${qs || '<div class="muted">추가 질문이 없습니다.</div>'}
        <div class="aig-foot"><button class="btn accent" id="ai-proceed">이 방향으로 생성 →</button><button class="btn" id="ai-cancel">취소</button></div>
      </div>`;
      bindFlow();
    }
    if (a.stage === "preview") {
      const g = a.gen || {}, rows = g.rows || [];
      const table = g.table || a.target;
      const cols = rows.length ? Object.keys(rows[0]) : [];
      const head = cols.map((c) => `<th>${esc(c)}</th>`).join("");
      const body = rows.slice(0, 12).map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("");
      el.innerHTML = `<div class="aig-card">
        <div class="aig-head">생성 미리보기 <span class="muted">${esc(table)} · ${rows.length}행</span></div>
        <div style="overflow:auto"><table class="mini">${head ? `<thead><tr>${head}</tr></thead>` : ""}<tbody>${body}</tbody></table></div>
        ${rows.length > 12 ? `<div class="aig-hint">…외 ${rows.length - 12}행</div>` : ""}
        <div class="aig-foot"><button class="btn accent" id="ai-apply">${rows.length}행 빌더에 추가 →</button><button class="btn" id="ai-cancel">취소</button></div>
      </div>`;
      bindFlow();
    }
  }

  // ---------- 상단 목표바 ----------
  function bindTargets() {
    document.querySelectorAll("#targetbar input[data-path]").forEach((inp) => {
      inp.addEventListener("input", () => {
        let v = parseFloat(inp.value); if (isNaN(v)) v = 0;
        setByPath(Data.state, inp.dataset.path, v);
        render(); Data.save();
      });
    });
  }

  // ---------- Gemini ----------
  async function onReport() {
    const out = document.getElementById("report-out");
    const btn = document.getElementById("btn-report");
    // [주석처리] 키 입력 강제 제거 — 내장 AI 사용(키 불필요)
    // if (!Gemini.getKey()) { toast("먼저 우측 상단에 Google API 키를 입력하세요."); openKey(); return; }
    out.classList.remove("empty");
    out.innerHTML = '<span class="spin"></span> 진단 리포트 생성 중…';
    btn.disabled = true;
    try {
      const text = await Gemini.diagnosticReport();
      out.innerHTML = R.md(text);
    } catch (e) {
      out.innerHTML = '<span style="color:#c0392b">오류: ' + R.escapeHtml(e.message) + "</span>";
    } finally { btn.disabled = false; }
  }

  async function onSuggest(area, containerId, btn) {
    // [주석처리] 키 입력 강제 제거 — 내장 AI 사용(키 불필요)
    // if (!Gemini.getKey()) { toast("먼저 우측 상단에 Google API 키를 입력하세요."); openKey(); return; }
    const el = document.getElementById(containerId);
    el.innerHTML = '<div class="out" style="margin-top:10px"><span class="spin"></span> 교정안 분석 중…</div>';
    btn.disabled = true;
    try {
      const data = await Gemini.suggestCorrections();
      // area로 필터링(선택)
      if (data.corrections) {
        const filtered = data.corrections.filter((c) => !c.area || c.area === area || area === "all");
        data.corrections = filtered.length ? filtered : data.corrections;
      }
      suggStore[containerId] = data;
      R.renderSuggestions(containerId, data);
    } catch (e) {
      el.innerHTML = '<div class="out" style="margin-top:10px;color:#c0392b">오류: ' + R.escapeHtml(e.message) + "</div>";
    } finally { btn.disabled = false; }
  }

  // ---------- 교정안 CSV 적용(부분/일괄) ----------
  function onApplyClick(e) {
    const all = e.target.closest && e.target.closest("[data-applyall]");
    const one = e.target.closest && e.target.closest("[data-applyone]");
    if (all) applyCorrections(all.getAttribute("data-applyall"), null);
    else if (one) applyCorrections(one.getAttribute("data-sg"), [parseInt(one.getAttribute("data-applyone"), 10)]);
  }
  function applyCorrections(cid, idxs) {
    const data = suggStore[cid];
    if (!data || !data.corrections) return;
    const list = idxs || data.corrections.map((c, i) => i);
    let applied = 0; const notes = [];
    list.forEach((i) => {
      const c = data.corrections[i];
      if (!c || !c.patch || c.applied) return;
      const res = Builder.applyPatch(c.patch);
      if (res && res.ok) { c.applied = true; applied++; notes.push(`${res.label} ${res.before.toLocaleString()}→${res.after.toLocaleString()}`); }
    });
    if (!applied) { toast("적용할 패치가 없습니다."); return; }
    Data.save();
    render();                       // 시뮬 재계산(관련 탭 갱신)
    R.renderSuggestions(cid, data); // render()가 컨테이너를 비우므로 교정안 재주입(적용표시 유지)
    toast(`${applied}건을 관련 CSV에 반영했습니다.`);
  }

  // ---------- API 키 ----------
  function bindKey() {
    const inp = document.getElementById("apikey");
    if (inp) {
      const dot = document.getElementById("keydot");
      inp.value = Gemini.getKey();
      if (dot) dot.classList.toggle("on", !!Gemini.getKey());
      inp.addEventListener("input", () => { Gemini.setKey(inp.value.trim()); if (dot) dot.classList.toggle("on", !!inp.value.trim()); });
    }
    const sel = document.getElementById("model");
    if (sel) { sel.value = Gemini.getModel(); sel.addEventListener("change", () => Gemini.setModel(sel.value)); }
  }
  function openKey() { const e = document.getElementById("apikey"); if (e) e.focus(); }

  // ---------- CSV 임포트 모달 ----------
  function bindImport() {
    const modal = document.getElementById("importModal");
    const drop = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const list = document.getElementById("importList");

    document.getElementById("btn-import").addEventListener("click", () => { list.innerHTML = ""; modal.classList.add("show"); });
    modal.querySelector(".modal-close").addEventListener("click", () => modal.classList.remove("show"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("show"); });

    drop.addEventListener("click", () => fileInput.click());
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));

    function handleFiles(files) {
      [...files].forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const parsed = Data.parseCSV(reader.result);
          let line;
          if (parsed.error) line = `<div><span>${file.name}</span><span style="color:#c0392b">${parsed.error}</span></div>`;
          else {
            Data.ingestCSV(file.name, parsed);          // 원본 보관(마스터 데이터 탭 표시용)
            const bname = file.name.replace(/\.csv$/i, "");
            const res = Builder.importCSV(bname, reader.result); // 시뮬 매핑은 여기(→syncAll) 단일 경로
            const status = (res && res.ok)
              ? (Builder.isTable(bname) ? "→ 빌더 적재 · 스키마 매칭(시뮬 반영)" : "→ 빌더 적재 · 원본 보관")
              : (res && res.error ? res.error : "보관됨");
            const color = (res && res.error) ? "#c0392b" : "#1f8a4c";
            line = `<div><span>${file.name} <span class="muted">(${parsed.records.length}행)</span></span><span style="color:${color}">${status}</span></div>`;
          }
          list.insertAdjacentHTML("beforeend", line);
          render(); Data.save();
        };
        reader.readAsText(file, "utf-8");
      });
    }
  }

  // ---------- 내보내기 / 리셋 ----------
  function bindMisc() {
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("모든 값을 기본값으로 되돌릴까요? (불러온 CSV 포함)")) { Data.reset(); render(); Data.save(); toast("기본값으로 초기화했습니다."); }
    });
    document.getElementById("btn-export").addEventListener("click", () => {
      const snap = Gemini.snapshot();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "ProjectA_balance_snapshot.json"; a.click();
      toast("현재 밸런스 스냅샷(JSON)을 내보냈습니다.");
    });
  }

  // ---------- 토스트 ----------
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- 시트탭 ----------
  function bindTabs() {
    document.querySelectorAll(".sheettabs .tab").forEach((el) => {
      el.addEventListener("click", () => { currentTab = el.dataset.tab; render(); });
    });
  }

  // ---------- init ----------
  function init() {
    Data.load();
    // localStorage가 비었으면 IndexedDB 백업에서 비동기 복구
    if (!localStorage.getItem("pa_balance_state") && Data.restoreFromBackup) {
      Data.restoreFromBackup().then((ok) => { if (ok) { Builder.ensure(); Builder.syncAll(); render(); toast("백업(IndexedDB)에서 데이터를 복구했습니다."); } });
    }
    // 저장 실패(용량 초과 등) 비파괴 경고
    window.addEventListener("pa-save-error", (e) => {
      toast("⚠ localStorage 저장 실패 — IndexedDB 백업으로 전환했습니다. (용량 초과 가능)");
    });
    Builder.ensure(); Builder.syncAll();
    bindTabs(); bindTargets(); bindKey(); bindImport(); bindMisc();
    // 전역 '밸런스 조정' 토글(상단 툴바) — 정적 버튼이므로 1회만 바인딩
    const cgBtn = document.getElementById("btn-cgdock");
    if (cgBtn) cgBtn.addEventListener("click", () => { const cg = Render.curveState && Render.curveState(); if (!cg) return; cg.open = !cg.open; refreshDock(); });
    document.addEventListener("click", onApplyClick);
    // 목표바 값 주입
    const t = Data.state.targets;
    ["maxDays", "daysTol", "clearSec", "clearTol"].forEach((k) => {
      const el = document.querySelector(`#targetbar input[data-path="targets.${k}"]`);
      if (el) el.value = t[k];
    });
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.App = { render, toast };
})();
