/* ============================================================
   gemini.js — Google Generative Language API 연동(로컬 키)
   · 목표 이탈 시 교정안 자동 제안
   · 전체 밸런스 진단 리포트 자연어 생성
   ============================================================ */
(function () {
  "use strict";

  const LS_KEY = "pa_gemini_key";
  const LS_MODEL = "pa_gemini_model";

  function getKey() { try { return localStorage.getItem(LS_KEY) || ""; } catch (e) { return ""; } }
  function setKey(k) { try { localStorage.setItem(LS_KEY, k || ""); } catch (e) {} }
  function getModel() { try { return localStorage.getItem(LS_MODEL) || "gemini-2.0-flash"; } catch (e) { return "gemini-2.0-flash"; } }
  function setModel(m) { try { localStorage.setItem(LS_MODEL, m || "gemini-2.0-flash"); } catch (e) {} }

  async function call(prompt, opts) {
    // ── [주석처리] 기존 Google Gemini API 키 방식 — 코드 보존(미사용) ──────────
    // const key = getKey();
    // if (!key) throw new Error("Google API 키가 없습니다. 우측 상단 [API 키]에 입력하세요.");
    // const model = getModel();
    // const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    // const body = {
    //   contents: [{ role: "user", parts: [{ text: prompt }] }],
    //   generationConfig: Object.assign({ temperature: 0.4, maxOutputTokens: 2048 }, (opts && opts.gen) || {}),
    // };
    // const res = await fetch(url, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(body),
    // });
    // if (!res.ok) {
    //   let msg = `${res.status} ${res.statusText}`;
    //   try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) {}
    //   throw new Error(msg);
    // }
    // const j = await res.json();
    // const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text).join("") || "";
    // if (!text) throw new Error("빈 응답을 받았습니다.");
    // return text;
    // ──────────────────────────────────────────────────────────────────────

    // ── 듀얼 폴백 ───────────────────────────────────────────────
    // 1순위: 내장 AI(Claude) — Claude Design / claude.ai 환경에서 제공(키 불필요)
    if (window.claude && typeof window.claude.complete === "function") {
      const text = await window.claude.complete(prompt);
      if (!text) throw new Error("빈 응답을 받았습니다.");
      return text;
    }
    // 2순위(폴백): Google Gemini API 키 — 독립 실행(file:// · 일반 서버) 환경
    const key = getKey();
    if (!key) throw new Error("내장 AI를 쓸 수 없는 환경입니다. 우측 상단에 Google Gemini API 키를 입력하면 AI 기능이 동작합니다.");
    const model = getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: Object.assign({ temperature: 0.4, maxOutputTokens: 2048 }, (opts && opts.gen) || {}),
    };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) {}
      throw new Error("Gemini 오류: " + msg);
    }
    const j = await res.json();
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text) throw new Error("빈 응답을 받았습니다.");
    return text;
  }

  // ---- 현재 상태 스냅샷(프롬프트 컨텍스트) ----
  function snapshot() {
    // 다른 탭과 동일한 최신 수치를 보도록 빌더 데이터로 먼저 재동기화(AI 진단/교정이 실데이터 기준)
    if (window.Builder && Builder.syncAll) Builder.syncAll();
    const s = Data.state;
    const econ = Economy.daysToMax();
    const sims = Combat.simAll();
    const t = s.targets;
    const rc = (n) => (window.Builder && Builder.rows) ? Builder.rows(n).length : 0;
    return {
      targets: t,
      unit: { name: s.unit.name, element: s.unit.element, maxLevel: s.unit.maxLevel, star: `${s.unit.baseStar}→${s.unit.maxStar}` },
      roster: { units: rc("UnitMaster"), monsters: rc("MonsterMaster"), stages: rc("StageMaster") },
      growth: {
        days: Math.round(econ.days),
        bottleneck: econ.bottleneck,
        totals: econ.totals,
        income: econ.income,
        perResourceDays: Object.fromEntries(Object.entries(econ.perRes).map(([k, v]) => [k, Math.round(v.days)])),
      },
      combat: sims.map((r) => ({ id: r.id, sec: r.sec, cleared: r.cleared, wipedAt: r.wipedAt })),
    };
  }

  function fmtSnapshot(snap) {
    return JSON.stringify(snap, null, 2);
  }

  // ---- 교정안 자동 제안 (구조화 JSON) ----
  async function suggestCorrections() {
    const snap = snapshot();
    const cat = (window.Builder && Builder.patchCatalog) ? Builder.patchCatalog() : {};
    const catLines = Object.keys(cat).map((k) => `- ${k}: ${cat[k].label} (${cat[k].table}.${cat[k].field}, 현재값≈${Math.round(cat[k].current).toLocaleString()})`).join("\n");
    const prompt = [
      "너는 모바일 가챠 RPG의 시니어 밸런스 디자이너다.",
      "아래는 'ProjectA'의 현재 밸런스 시뮬레이션 스냅샷(JSON)이다.",
      "목표: 최고 레어도 유닛 1기 최대 육성 = " + snap.targets.maxDays + "일(±" + snap.targets.daysTol + "), 스테이지 전투 = " + snap.targets.clearSec + "초(±" + snap.targets.clearTol + ").",
      "",
      fmtSnapshot(snap),
      "",
      "목표에서 이탈한 지표를 찾아, 구체적이고 적용 가능한 교정안을 제시하라.",
      "각 교정안은 '어떤 파라미터를 몇 % 또는 몇으로 조정'하는 형태로 정량적이어야 한다.",
      "",
      "[적용 가능한 CSV 파라미터(patch.key 후보)]",
      catLines,
      "",
      "각 교정안에는 위 목록의 key를 사용한 patch를 포함하라. patch.op 의미: 'mul'=현재값×value(배수), 'add'=현재값+value, 'set'=절대값.",
      "예: 레벨업 골드 12% 인하 → patch={\"key\":\"level_gold\",\"op\":\"mul\",\"value\":0.88}. 목록에 없는 항목은 patch를 null 로 두라.",
      "오직 아래 JSON 스키마로만 응답하라(코드블록/설명 없이 JSON만):",
      `{"summary":"한 줄 요약","corrections":[{"area":"growth|combat","target":"조정 대상","action":"예: 12% 인하","reason":"근거","expected":"예상 효과","patch":{"key":"level_gold","op":"mul","value":0.88}}]}`,
    ].join("\n");
    const text = await call(prompt, { gen: { temperature: 0.3 } });
    return parseJSON(text);
  }

  // ---- 진단 리포트 (마크다운) ----
  async function diagnosticReport() {
    const snap = snapshot();
    const prompt = [
      "너는 모바일 가챠 RPG의 시니어 밸런스 디자이너다. 아래 시뮬레이션 스냅샷을 바탕으로 한국어 밸런스 진단 리포트를 작성하라.",
      "목표: 유닛 최대 육성 " + snap.targets.maxDays + "일(±" + snap.targets.daysTol + "), 전투 " + snap.targets.clearSec + "초(±" + snap.targets.clearTol + ").",
      "",
      fmtSnapshot(snap),
      "",
      "구성: ## 종합 판정 / ## 육성 경제 / ## 전투 시간 / ## 우선 조치(번호 목록).",
      "수치를 근거로 간결하게. 마크다운으로만 작성.",
    ].join("\n");
    return await call(prompt, { gen: { temperature: 0.5, maxOutputTokens: 1600 } });
  }

  // ---- 자연어 데이터 생성: 인터뷰 → 생성 ----
  async function interview(command) {
    const tables = window.Schema ? Object.keys(Schema.tables).filter((n) => Schema.tables[n].kind === "master").join(", ") : "";
    const prompt = [
      "너는 모바일 RPG 'ProjectA'의 데이터 디자이너 어시스턴트다.",
      "사용자 명령: \"" + command + "\"",
      "사용 가능한 마스터 테이블: " + tables,
      "이 명령으로 어떤 테이블에 몇 개의 행을 만들지 추정하고, 생성 방향을 확정하기 위한 핵심 질문 3~5개를 한국어로 제시하라.",
      "질문은 가능한 한 객관식(options 배열)으로 만들고, 자유 입력이 필요하면 options를 생략하라.",
      "오직 JSON만 응답(코드블록/설명 없이): {\"intro\":\"한 줄 요약\",\"target\":\"테이블명\",\"count\": 정수, \"questions\":[{\"id\":\"slug\",\"label\":\"질문\",\"options\":[\"선택A\",\"선택B\"],\"hint\":\"보조설명\"}]}",
    ].join("\n");
    return parseJSON(await call(prompt));
  }
  async function generateRows(command, target, count, answers, context) {
    const prompt = [
      "너는 'ProjectA' 데이터 디자이너다. 아래 스키마/제약에 정확히 맞춰 마스터 데이터 행을 생성하라.",
      "명령: \"" + command + "\"  (목표 개수: " + count + ")",
      "생성 방향(인터뷰 답변): " + JSON.stringify(answers),
      "",
      "[대상 테이블 스키마 & 제약]",
      context,
      "",
      "규칙:",
      "- Id는 위 '다음 Id'부터 1씩 증가시켜 부여한다.",
      "- 참조 컬럼은 반드시 제시된 '참조 허용값'의 숫자 id 중에서만 고른다.",
      "- NameId는 한국어로 서로 겹치지 않게. 스탯/수치는 역할·등급·방향에 맞게 합리적으로 차등한다.",
      "- 스키마에 있는 컬럼만, 정확한 컬럼명으로 채운다.",
      "오직 JSON만 응답(코드블록/설명 없이): {\"table\":\"" + target + "\",\"rows\":[{ 컬럼:값, ... }]}",
    ].join("\n");
    return parseJSON(await call(prompt));
  }

  function parseJSON(text) {
    let t = text.trim();
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const i = t.indexOf("{"), j = t.lastIndexOf("}");
    if (i >= 0 && j > i) t = t.slice(i, j + 1);
    try { return JSON.parse(t); } catch (e) { return { summary: "(JSON 파싱 실패) 원문:", raw: text, corrections: [] }; }
  }

  window.Gemini = {
    getKey, setKey, getModel, setModel, call,
    snapshot, suggestCorrections, diagnosticReport, interview, generateRows,
  };
})();
