import { LEVELS, STYLE_OPTIONS, type Genre, type LevelValue } from './levels'

export interface GenerateParams {
  topic: string
  level: LevelValue
  genre: Genre
  style: string
  /** Optional comma-separated vocabulary the story must include. */
  requiredVocabulary?: string
}

function resolveStyleText(genre: Genre, style: string): string {
  const list = STYLE_OPTIONS[genre]
  const found = list.find((o) => o.value === style) ?? list[0]
  return found?.promptText ?? ''
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
    '- Exactly 6 to 8 vocabulary items drawn from the story.',
    '- All Korean fields (question_ko, explanation, meaning, story_ko) must be natural Korean.',
    `- ${keySentenceRule}`,
    '',
    'Return JSON only, matching the provided response schema. Do not include any prose outside the JSON.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * Gemini structured-output schema (OpenAPI subset). Used with
 * responseMimeType: "application/json" so the model returns parseable JSON
 * without markdown fences (P0 — Fix A). Zod (schema.ts) remains the final
 * authority on validity.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'string' },
    title: { type: 'string' },
    story: { type: 'array', items: { type: 'string' } },
    story_ko: { type: 'array', items: { type: 'string' } },
    multiple_choice: {
      type: 'array',
      items: {
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
      },
    },
    subjective: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          question_ko: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'question_ko', 'answer'],
        propertyOrdering: ['question', 'question_ko', 'answer'],
      },
    },
    key_sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          english: { type: 'string' },
          korean: { type: 'string' },
        },
        required: ['english', 'korean'],
        propertyOrdering: ['english', 'korean'],
      },
    },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          pos: { type: 'string' },
          meaning: { type: 'string' },
        },
        required: ['word', 'pos', 'meaning'],
        propertyOrdering: ['word', 'pos', 'meaning'],
      },
    },
  },
  required: [
    'index',
    'title',
    'story',
    'story_ko',
    'multiple_choice',
    'subjective',
    'key_sentences',
    'vocabulary',
  ],
  propertyOrdering: [
    'index',
    'title',
    'story',
    'story_ko',
    'multiple_choice',
    'subjective',
    'key_sentences',
    'vocabulary',
  ],
} as const
