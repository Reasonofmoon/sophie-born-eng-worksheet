# WorksheetCraft — 영어 독해 학습지 생성기 (BYOK)

> **Why this stack: Vite + React + TypeScript (SPA).**
> SSR/SEO 불필요 + BYOK라 모든 LLM 호출이 브라우저에서 일어나야 함(서버가 키를 만지면 안 됨) →
> MoonWorkspace Stack Selection Gate 1번에서 정적 SPA로 확정. Next.js 미사용. Vercel에 정적 빌드로 배포.

사용자의 Gemini API 키로 초·중등 영어 독해 학습지(지문 + 한글 해석 + 객관식 5 + 서술형 5 + 핵심 문장 + 어휘 6~8)를
생성하고 인쇄/PDF로 출력합니다. 키는 브라우저 `localStorage`에만 저장되고 Gemini로만 직접 전송됩니다.

## 개발

```bash
npm install
npm run dev        # 로컬 개발 서버
npm run typecheck  # tsc --noEmit (strict)
npm test           # vitest (스키마 + 프롬프트 검증 게이트)
npm run build      # tsc -b && vite build → dist/
```

## 배포 (Vercel)

정적 빌드(`dist/`)를 그대로 서빙합니다. `vercel.json`에 framework/build/output 명시.
환경변수 불필요 — 키는 사용자가 런타임에 입력하는 BYOK 방식.

## P0 적용 사항 (레거시 대비 출시 차단 해소)

| Fix | 내용 | 파일 |
| --- | --- | --- |
| A | Gemini 구조화 출력(`responseMimeType` + `responseSchema`). 마크다운 펜스 수동 제거 제거 | `src/lib/gemini.ts`, `src/lib/prompt.ts` |
| B | Zod 런타임 검증 + 1회 자동 재생성. 옵션 5개·answer 1~5·문단 정렬 강제 | `src/lib/schema.ts`, `src/lib/gemini.ts` |
| C | API 키를 `x-goog-api-key` 헤더로 전송(URL query 노출 제거) | `src/lib/gemini.ts` |
| D | 모델 선택 UI · 타임아웃(AbortController) · 취소 | `src/lib/gemini.ts`, `src/App.tsx` |
| 게이트 | typecheck + vitest 15 케이스 — app-factory `studio inspect`의 BLOCK 해소 | `src/lib/*.test.ts` |

## P1 적용 사항 (레거시 기능 복원 + 확장)

| 항목 | 내용 | 파일 |
| --- | --- | --- |
| 4페이지 레이아웃 | A4 학습지2(지문+문제 / 문장해석+어휘) + 답안지2(한글번역+객관식해설 / 서술형+문장해석) | `src/components/WorksheetDoc.tsx` |
| 실시간 동기화 | 단일 상태 원천 + `contentEditable` 편집(`onBlur` 반영). 레거시 data-sync DOM 미러링 대체 | `src/components/EditableText.tsx` |
| 프리셋 3종 | 레거시 샘플 이식, 스키마 검증 테스트로 보호 | `src/lib/presets.ts`, `src/lib/presets.test.ts` |
| 삽화 (Fix E/F) | 인라인 SVG 플레이스홀더 + 업로드(data URL). 레거시 깨진 `assets/` + Pollinations 외부 의존 제거 | `src/components/Illustration.tsx` |
| 인쇄 모드 | 학습지만 / 답안지만 / 전체 — `@media print` 페이지 선택 | `src/index.css` |
| 멀티 프로바이더 | Gemini / OpenAI / Anthropic BYOK (provider별 키 저장, 모델 선택) | `src/lib/llm.ts` |

모델 목록은 2026-06-21 공식 문서 기준으로 검증·갱신했습니다 — Gemini `gemini-3.5-flash`(기본)·`3.1-flash-lite`·`2.5-*`·`3.1-pro-preview`, OpenAI `gpt-5.4-mini`(기본)·`gpt-5.4`·`gpt-5.5`·`gpt-5.5-pro`·`gpt-5.4-nano`, Anthropic `claude-sonnet-4-6`(기본)·`claude-haiku-4-5`·`claude-opus-4-8`·`claude-fable-5` 등. GPT-5.x 추론형 호환을 위해 OpenAI 호출은 `temperature`를 전송하지 않습니다.

레벨 L3~L5는 삽화를 숨겨 페이지 오버플로를 방지(레거시 동작 유지).

## 학원 브랜딩 · 난이도 매핑 · 언어 모드 (P4)

- **학원 로고 / 학원명**: 사이드바에서 입력·업로드(localStorage 영속), 모든 페이지 상단 브랜딩 바 + HWP 내보내기에 반영 — [App.tsx](worksheet-gen/src/App.tsx), [WorksheetDoc.tsx](worksheet-gen/src/components/WorksheetDoc.tsx)
- **난이도 CEFR · AR · Lexile 매핑**: 학년→`CEFR/AR(ATOS)/Lexile` 근사 매핑을 레벨 테이블에 추가, 헤더 배지로 표시 + 프롬프트에 readability 타깃 주입 — [levels.ts](worksheet-gen/src/lib/levels.ts)
- **언어 표시 모드**: `영어+한국어(해석 포함)` ↔ `영어만(해석 숨김)` — 한국어 질문 번역·어휘 뜻·문장 해석·한글 본문을 토글, 화면·인쇄·HWP 모두 반영
- **본문 컨테이너 박스**: 지문에 아주 흐린 배경(`#fafaf8`)+테두리로 경계를 표시, 내용이 박스 안에 정돈되도록
- **페이지 넘침 처리**: 인쇄 시 한 페이지를 넘는 내용은 다음 시트로 자동 흐름(`break-before: page` + 블록 `break-inside: avoid`)되어 문항이 잘리지 않음. 배경/배지/정답 하이라이트는 `print-color-adjust: exact`로 인쇄 보존
- **레이아웃 재배치 (P5)**: 핵심 단어 정리를 **1페이지 본문 바로 아래**(2단 그리드)로 이동, 어휘 스키마 **6~20개**로 확장(badge `8 / 6–20`), 구문 해석 연습은 **1단(full-width)**. HWP 내보내기도 본문→어휘→문제 순으로 일치 — [WorksheetDoc.tsx](worksheet-gen/src/components/WorksheetDoc.tsx), [schema.ts](worksheet-gen/src/lib/schema.ts)
- **페이지 미리보기 (paged.js)**: 사이드바 `⊞ 페이지 미리보기` 토글 → 화면에서도 **실제 A4 분할**을 보여줌. 내용이 한 장을 넘치면 5·6…페이지로 이어지고 토글에 총 페이지 수 표시(`(11p)`). 편집은 편집 모드(기본)에서, 분할 확인은 미리보기에서. paged.js는 동적 import로 메인 번들과 분리 — [App.tsx](worksheet-gen/src/App.tsx)

## 인쇄 친화 / 블록 모델 (P1.1)

- **편집 필드 = 블록 개체**: 모든 편집 가능 항목(stem·option·해설·지문 단락·어휘·문장)을 `EditableField` 개체로 식별하고, 편집/정규화는 `applyEdit()` 한 곳으로 모음 — [blocks.ts](worksheet-gen/src/lib/blocks.ts), 테스트 [blocks.test.ts](worksheet-gen/src/lib/blocks.test.ts)
- **문항 잘림 방지**: 각 블록(`.print-block`)에 `break-inside: avoid` — 인쇄 시 문항/단락/어휘 항목이 페이지 경계에서 쪼개지지 않음
- **page-break 제어**: 각 논리 페이지(`.page`)는 `break-before: page`로 새 시트에서 시작하되, 콘텐츠가 넘치면 다음 시트로 **자동 흐름**(고정 A4 박스가 아니라 블록이 분할 지점 결정). 첫 페이지/모드별 첫 페이지는 빈 시트 방지
- **고아/과부 줄 방지**: 지문 단락 `orphans: 3; widows: 3`. 어휘 박스는 페이지를 가로질러도 항목 단위는 보존(`.vocab-box` auto / `.vocab-item` avoid)
- `@page { size: A4; margin: 12mm }`

## 스마트 편집 / 내보내기 (P3)

- **내 본문 사용 (BYOT)**: 영어 지문을 붙여넣으면 그 지문 그대로 객관식·서술형·어휘·해석을 생성. 본문을 재생성·재출력하지 않아 **토큰 절약** — [llm.ts `generateFromPassage`](worksheet-gen/src/lib/llm.ts), 클라이언트 단락 분할 + `byotOutputSchema` 병합 후 전체 스키마 재검증
- **템플릿 / 스마트 편집**: 템플릿(기본·시험지·콤팩트·교과서) + 폰트·글자 크기·문항 간격 슬라이더. 레이아웃은 CSS 변수로 클라이언트 처리 → **LLM 토큰 0** — [templates.ts](worksheet-gen/src/lib/templates.ts)
- **HWP용 HTML 복사**: 현재 인쇄 범위(학습지/답안지/전체)를 인라인 스타일 HTML로 클립보드에 복사 → HWP/HWPX에 Ctrl+V. CSS 클래스 대신 인라인 스타일이라 한글 워드프로세서에서 서식 유지 — [hwp.ts](worksheet-gen/src/lib/hwp.ts)
- **답 기입란 박스**: 서술형(Q6-10)·문장 해석은 얇은 밑줄 대신 학생이 직접 쓰는 **빈 테두리 박스**. 높이는 `답란 높이` 슬라이더(`--answer-h`)로 조절, 화면·인쇄·HWP 모두 반영. 문항은 hanging-indent로 번호 아래 stem·선택지가 정렬

## 후속 (P2 — 미구현)

- 프라이버시 정책 페이지, 배포 체크리스트(app-factory `studio inspect` 잔여 warn 해소)
- 어휘/문장 항목 추가·삭제 UI, 줌 슬라이더
