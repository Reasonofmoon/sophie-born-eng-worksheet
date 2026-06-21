import { LEVELS, STYLE_OPTIONS, type Genre, type LevelValue } from './levels'

export interface GenerateParams {
  topic: string
  level: LevelValue
  genre: Genre
  style: string
  /** Optional comma-separated vocabulary the story must include. */
  requiredVocabulary?: string
}

export interface PassageParams {
  /** Pre-split English paragraphs supplied by the teacher (BYOT). */
  paragraphs: string[]
  level: LevelValue
  genre: Genre
}

function resolveStyleText(genre: Genre, style: string): string {
  const list = STYLE_OPTIONS[genre]
  const found = list.find((o) => o.value === style) ?? list[0]
  return found?.promptText ?? ''
}

/**
 * Split a pasted passage into paragraphs: prefer blank-line separation, fall
 * back to single newlines, and finally treat the whole thing as one paragraph.
 */
export function splitPassage(raw: string): string[] {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const byBlank = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  const byLine = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  return byLine.length > 0 ? byLine : [text]
}

/**
 * Build the generation prompt. Length rules come from the level table so the
 * model is given exactly one numeric target instead of self-selecting from a
 * conditional list (P0 — Fix G).
 */
export function buildPrompt(params: GenerateParams): string {
  const cfg = LEVELS[params.level]
  const [minWords, maxWords] = cfg.words
  const genreInstruction =
    params.genre === 'nonfiction'
      ? 'The passage must be an informational, explanatory, or argumentative text (non-fiction).'
      : 'The passage must be a narrative story or literary piece (literature/fiction).'
  const styleText = resolveStyleText(params.genre, params.style)
  const keySentenceRule =
    cfg.keySentences === 'all'
      ? 'Generate ALL sentences from the story in sequential order in "key_sentences" (every sentence of the story exactly once, in order).'
      : 'Generate exactly 10 representative sentences from the story in "key_sentences".'

  return [
    'You are a professional textbook designer creating a Korean-targeted English reading-comprehension worksheet.',
    'Produce a passage, a paragraph-by-paragraph Korean translation, comprehension questions, a sentence-translation list, and a vocabulary list.',
    '',
    'Requirements:',
    `- Topic: ${params.topic}`,
    `- Target student level: ${cfg.levelText}`,
    `- Target readability: CEFR ${cfg.cefr}, Accelerated Reader (ATOS) ${cfg.ar}, Lexile ${cfg.lexile}. Calibrate vocabulary and sentence complexity to this band.`,
    `- Passage type: ${params.genre}. ${genreInstruction}`,
    `- Style / subject: ${styleText}`,
    params.requiredVocabulary?.trim()
      ? `- Required vocabulary the story MUST include: ${params.requiredVocabulary.trim()}`
      : '',
    '',
    'Hard constraints (critical — prevents print overflow):',
    `- The story must have exactly ${cfg.paragraphs} short paragraphs.`,
    `- Total story length must be ${minWords}-${maxWords} words. Keep sentences short.`,
    '- "story_ko" must have the same number of paragraphs as "story", aligned one-to-one.',
    '- Exactly 5 multiple-choice questions, each with exactly 5 options.',
    '- For each multiple-choice question, "answer" is the 1-based index (1-5) of the correct option.',
    '- Exactly 5 subjective (short-answer) questions.',
    '- Between 6 and 20 key vocabulary items drawn from the story (no more than 20).',
    '- All Korean fields (question_ko, explanation, meaning, story_ko) must be natural Korean.',
    `- ${keySentenceRule}`,
    '',
    'Return JSON only, matching the provided response schema. Do not include any prose outside the JSON.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * BYOT prompt: the teacher supplies the passage, so the model does NOT rewrite
 * or echo the English text (token saving). It only produces the translation,
 * questions, key sentences and vocabulary for the given paragraphs.
 */
export function buildPassagePrompt(params: PassageParams): string {
  const cfg = LEVELS[params.level]
  const numbered = params.paragraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n')

  return [
    'You are a professional textbook designer building a Korean-targeted English reading-comprehension worksheet from a passage the teacher already wrote.',
    '',
    'The passage (numbered paragraphs — use them EXACTLY as given, do NOT rewrite, summarize, or output the English passage again):',
    numbered,
    '',
    `Target student level: ${cfg.levelText} (CEFR ${cfg.cefr}, AR ${cfg.ar}, Lexile ${cfg.lexile}). Passage type: ${params.genre}.`,
    '',
    'Produce ONLY the following, based on the passage above:',
    `- "story_ko": natural Korean translation, exactly ${params.paragraphs.length} entries, one per numbered paragraph, in the same order.`,
    '- "multiple_choice": exactly 5 questions, each with exactly 5 options; "answer" is the 1-based index (1-5) of the correct option; "explanation" in Korean.',
    '- "subjective": exactly 5 short-answer questions.',
    '- "key_sentences": exactly 10 important sentences taken verbatim from the passage, each with its Korean translation.',
    '- "vocabulary": 6 to 20 key words drawn from the passage (no more than 20), with part-of-speech abbreviation and Korean meaning.',
    '- "title": a short English title for this passage. "index": a lesson number string.',
    'Do NOT include a "story" field. Return JSON only, matching the provided response schema.',
  ].join('\n')
}

// ---- Gemini structured-output schemas (OpenAPI subset) ----
// Factored item schemas so the full and BYOT response schemas stay in sync.

const MC_ITEM = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    question_ko: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    answer: { type: 'integer' },
    explanation: { type: 'string' },
  },
  required: ['question', 'question_ko', 'options', 'answer', 'explanation'],
  propertyOrdering: ['question', 'question_ko', 'options', 'answer', 'explanation'],
} as const

const SUB_ITEM = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    question_ko: { type: 'string' },
    answer: { type: 'string' },
  },
  required: ['question', 'question_ko', 'answer'],
  propertyOrdering: ['question', 'question_ko', 'answer'],
} as const

const SENT_ITEM = {
  type: 'object',
  properties: { english: { type: 'string' }, korean: { type: 'string' } },
  required: ['english', 'korean'],
  propertyOrdering: ['english', 'korean'],
} as const

const VOCAB_ITEM = {
  type: 'object',
  properties: { word: { type: 'string' }, pos: { type: 'string' }, meaning: { type: 'string' } },
  required: ['word', 'pos', 'meaning'],
  propertyOrdering: ['word', 'pos', 'meaning'],
} as const

/** Full generation: model writes the passage too. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'string' },
    title: { type: 'string' },
    story: { type: 'array', items: { type: 'string' } },
    story_ko: { type: 'array', items: { type: 'string' } },
    multiple_choice: { type: 'array', items: MC_ITEM },
    subjective: { type: 'array', items: SUB_ITEM },
    key_sentences: { type: 'array', items: SENT_ITEM },
    vocabulary: { type: 'array', items: VOCAB_ITEM },
  },
  required: ['index', 'title', 'story', 'story_ko', 'multiple_choice', 'subjective', 'key_sentences', 'vocabulary'],
  propertyOrdering: ['index', 'title', 'story', 'story_ko', 'multiple_choice', 'subjective', 'key_sentences', 'vocabulary'],
} as const

/** BYOT: no "story" — the passage is supplied client-side (token saving). */
export const BYOT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'string' },
    title: { type: 'string' },
    story_ko: { type: 'array', items: { type: 'string' } },
    multiple_choice: { type: 'array', items: MC_ITEM },
    subjective: { type: 'array', items: SUB_ITEM },
    key_sentences: { type: 'array', items: SENT_ITEM },
    vocabulary: { type: 'array', items: VOCAB_ITEM },
  },
  required: ['index', 'title', 'story_ko', 'multiple_choice', 'subjective', 'key_sentences', 'vocabulary'],
  propertyOrdering: ['index', 'title', 'story_ko', 'multiple_choice', 'subjective', 'key_sentences', 'vocabulary'],
} as const
