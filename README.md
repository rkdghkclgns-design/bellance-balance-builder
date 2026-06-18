# Bellance Balance Builder (밸런스 빌더)

ProjectA 모바일 RPG의 **밸런스 교정 빌더** — 의존성 0의 단일 페이지 바닐라 JS 웹앱.
유닛 / 육성 / 전투 / 경제 데이터를 한 화면에서 설계 · 시뮬레이션 · 검증합니다.

## 라이브 데모
https://rkdghkclgns-design.github.io/bellance-balance-builder/

## 기능
- **대시보드** — 핵심 KPI + 전투력 vs 육성일 성장곡선(SVG, 적응형 축 라벨)
- **육성 경제** — 레벨 / 성급 / 스킬 / 특성 비용 차등표 + 누적치, 행 클릭 시 상세 펼침
- **전투 시뮬** — 결정적 틱 기반 전투(기본공격 · 스킬 쿨다운 · 버프/CC · 원소 상성)
- **밸런스 기조** — 마스터 데이터에서 기준/캡 자동 산출, 스테이지 규칙(플레이타임 · 보스 비중 · 웨이브) 검증
- **마스터 데이터 / 유닛 설계** — 등급별 성급 상한, 유니크 검증
- **데이터 빌더** — 59종 테이블(마스터 40 + Define 19) 행 편집, 4-Row CSV / ZIP / JSON 입출력, 폴더 일괄 불러오기, 무결성 검증, 기준 저장/비교, AI 데이터 생성
- **AI 진단/교정** — 내장 AI 우선, 독립 실행 시 Gemini API 키로 폴백

## 실행
정적 파일이라 빌드가 필요 없습니다.
- **온라인**: 위 라이브 데모 링크
- **로컬**: `index.html`(또는 `밸런스 빌더.html`)을 브라우저로 열기

## AI 사용
- **Claude Design 환경**: `window.claude` 내장 AI 자동 사용(키 불필요)
- **독립 실행**: 우측 상단에 Google Gemini API 키 입력 시 동작(브라우저 로컬 저장, 내장 AI가 있으면 무시)

## 기술
순수 HTML / CSS / JS, 외부 라이브러리 없음. 상태는 `localStorage` + `IndexedDB` 백업.

## 구조
```
index.html          # 엔트리(= 밸런스 빌더.html 복사본, GitHub Pages 기본)
밸런스 빌더.html      # 원본 엔트리
css/builder.css     # 스타일
js/                 # 14개 모듈 (data · schema · builder · doctrine · economy · combat · units · gemini · render · render2 · render_units · render_builder · render_doctrine · app)
```
