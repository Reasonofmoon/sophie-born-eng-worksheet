// P0 — Fix G: level-specific length rules are kept as structured data instead
// of being buried inside one giant prompt string. This makes them testable and
// keeps the prompt deterministic.

export type LevelValue =
  | 'elementary_1_2'
  | 'elementary_3_4'
  | 'elementary_5_6'
  | 'middle_1_2'
  | 'middle_2_3'

export interface LevelConfig {
  value: LevelValue
  /** Short code shown next to the title, e.g. "L3". */
  code: string
  /** Korean label for the UI. */
  labelKo: string
  /** English level description handed to the model. */
  levelText: string
  /** Number of paragraphs the story must have. */
  paragraphs: number
  /** Inclusive word-count band for the whole story. */
  words: readonly [min: number, max: number]
  /**
   * key_sentences rule:
   *  - 'ten'  → exactly 10 representative sentences
   *  - 'all'  → every sentence of the story, in order, exactly once
   */
  keySentences: 'ten' | 'all'
  /** CEFR band (approx. mapping). */
  cefr: string
  /** Accelerated Reader (ATOS) book-level band (approx. mapping). */
  ar: string
  /** Lexile band (approx. mapping). */
  lexile: string
}

export const LEVELS: Record<LevelValue, LevelConfig> = {
  elementary_1_2: {
    value: 'elementary_1_2',
    code: 'L1',
    labelKo: '초등학교 1~2학년',
    levelText: 'Grades 1-2',
    paragraphs: 3,
    words: [80, 95],
    keySentences: 'ten',
    cefr: 'Pre-A1',
    ar: '1.0–2.0',
    lexile: 'BR–300L',
  },
  elementary_3_4: {
    value: 'elementary_3_4',
    code: 'L2',
    labelKo: '초등학교 3~4학년',
    levelText: 'Grades 3-4',
    paragraphs: 3,
    words: [100, 115],
    keySentences: 'ten',
    cefr: 'A1',
    ar: '2.0–3.0',
    lexile: '200L–500L',
  },
  elementary_5_6: {
    value: 'elementary_5_6',
    code: 'L3',
    labelKo: '초등학교 5~6학년',
    levelText: 'Grades 5-6',
    paragraphs: 4,
    words: [120, 140],
    keySentences: 'all',
    cefr: 'A2',
    ar: '3.0–4.5',
    lexile: '400L–700L',
  },
  middle_1_2: {
    value: 'middle_1_2',
    code: 'L4',
    labelKo: '중학교 1~2학년',
    levelText: 'Middle School Grade 1-2',
    paragraphs: 4,
    words: [140, 155],
    keySentences: 'all',
    cefr: 'A2–B1',
    ar: '4.0–5.5',
    lexile: '600L–800L',
  },
  middle_2_3: {
    value: 'middle_2_3',
    code: 'L5',
    labelKo: '중학교 2~3학년',
    levelText: 'Middle School Grade 2-3',
    paragraphs: 4,
    words: [160, 180],
    keySentences: 'all',
    cefr: 'B1',
    ar: '5.0–6.5',
    lexile: '700L–900L',
  },
}

/** "CEFR A2 · AR 3.0–4.5 · Lexile 400L–700L" — approximate cross-mapping. */
export function readabilityLabel(cfg: LevelConfig): string {
  return `CEFR ${cfg.cefr} · AR ${cfg.ar} · Lexile ${cfg.lexile}`
}

/** Look up a level by its short code (e.g. "L3"). Used by presets. */
export function levelByCode(code: string): LevelConfig | undefined {
  return Object.values(LEVELS).find((l) => l.code === code)
}

export const LEVEL_VALUES = Object.keys(LEVELS) as LevelValue[]

export type Genre = 'literature' | 'nonfiction'

export interface StyleOption {
  value: string
  labelKo: string
  /** Phrase injected into the prompt. */
  promptText: string
}

export const STYLE_OPTIONS: Record<Genre, readonly StyleOption[]> = {
  literature: [
    { value: 'warm', labelKo: '따뜻하고 감동적인', promptText: 'warm and touching story' },
    { value: 'fun', labelKo: '재미있고 유쾌한', promptText: 'fun and humorous story' },
    { value: 'adventure', labelKo: '모험이 가득한', promptText: 'adventurous story' },
    { value: 'mystery', labelKo: '신비롭고 미스터리한', promptText: 'mysterious story' },
    { value: 'fantasy', labelKo: '환상적인 판타지', promptText: 'fantasy story' },
    { value: 'fable', labelKo: '교훈이 있는 우화', promptText: 'fable with a moral lesson' },
  ],
  nonfiction: [
    { value: 'science', labelKo: '과학과 기술', promptText: 'science and technology informational text' },
    { value: 'history', labelKo: '역사와 인물', promptText: 'history and biographical informational text' },
    { value: 'environment', labelKo: '자연과 환경', promptText: 'nature and environment informational text' },
    { value: 'space', labelKo: '우주와 천문학', promptText: 'space and astronomy informational text' },
    { value: 'economy', labelKo: '경제와 일상', promptText: 'economy and daily life informational text' },
    { value: 'society', labelKo: '사회와 인권', promptText: 'society and human rights informational text' },
    { value: 'health', labelKo: '건강과 운동', promptText: 'health, biology, and exercise informational text' },
    { value: 'culture', labelKo: '예술과 문화', promptText: 'art, music, and culture informational text' },
    { value: 'animal', labelKo: '동물의 세계', promptText: 'zoology and animal world informational text' },
    { value: 'sports', labelKo: '스포츠와 역사', promptText: 'sports, physical education, and history informational text' },
  ],
}
