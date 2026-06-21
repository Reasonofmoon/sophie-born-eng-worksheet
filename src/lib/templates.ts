// Layout templates are pure client-side presentation — choosing one costs zero
// LLM tokens (the model only ever produces content, never styling). Each
// template seeds editable settings the teacher can then fine-tune.

export interface LayoutSettings {
  /** CSS font stack; first name is the HWP target font. */
  fontFamily: string
  /** Body font size in px (screen). */
  fontSizePx: number
  /** Body font size in pt (HWP export). */
  bodyPt: number
  /** Gap between questions in px (screen). */
  questionGapPx: number
  /** Paragraph spacing in pt (HWP export). */
  blockGapPt: number
  lineHeight: number
  /** Height of the student answer box (short answer) in px. */
  answerHeightPx: number
}

export interface Template extends LayoutSettings {
  id: string
  label: string
  desc: string
}

const GOTHIC = "'맑은 고딕', 'Malgun Gothic', system-ui, sans-serif"
const SERIF = "'바탕', Batang, 'Noto Serif KR', serif"

export const TEMPLATES: Template[] = [
  {
    id: 'standard',
    label: '기본 고딕',
    desc: '균형 잡힌 기본 레이아웃',
    fontFamily: GOTHIC,
    fontSizePx: 12.5,
    bodyPt: 11,
    questionGapPx: 16,
    blockGapPt: 10,
    lineHeight: 1.6,
    answerHeightPx: 56,
  },
  {
    id: 'exam',
    label: '시험지(넓게)',
    desc: '문항 간격이 넓어 필기·채점하기 좋음',
    fontFamily: GOTHIC,
    fontSizePx: 13,
    bodyPt: 12,
    questionGapPx: 24,
    blockGapPt: 14,
    lineHeight: 1.75,
    answerHeightPx: 84,
  },
  {
    id: 'compact',
    label: '콤팩트(절약)',
    desc: '한 장에 더 많이 — 종이 절약',
    fontFamily: GOTHIC,
    fontSizePx: 11.5,
    bodyPt: 10,
    questionGapPx: 9,
    blockGapPt: 6,
    lineHeight: 1.45,
    answerHeightPx: 40,
  },
  {
    id: 'textbook',
    label: '교과서 명조',
    desc: '바탕체 기반 교과서 느낌',
    fontFamily: SERIF,
    fontSizePx: 12.5,
    bodyPt: 11,
    questionGapPx: 16,
    blockGapPt: 10,
    lineHeight: 1.7,
    answerHeightPx: 60,
  },
]

export const FONT_CHOICES: ReadonlyArray<{ label: string; value: string }> = [
  { label: '맑은 고딕', value: GOTHIC },
  { label: '바탕(명조)', value: SERIF },
  { label: '굴림', value: "'굴림', Gulim, sans-serif" },
  { label: '돋움', value: "'돋움', Dotum, sans-serif" },
]

export function templateById(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!
}

export function settingsFrom(t: Template): LayoutSettings {
  const { fontFamily, fontSizePx, bodyPt, questionGapPx, blockGapPt, lineHeight, answerHeightPx } = t
  return { fontFamily, fontSizePx, bodyPt, questionGapPx, blockGapPt, lineHeight, answerHeightPx }
}
