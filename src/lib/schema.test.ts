import { describe, expect, it } from 'vitest'
import { worksheetSchema, type Worksheet } from './schema'

function validWorksheet(): Worksheet {
  return {
    index: '6',
    title: 'A Small Kindness',
    story: ['Para one.', 'Para two.', 'Para three.'],
    story_ko: ['문단 하나.', '문단 둘.', '문단 셋.'],
    multiple_choice: Array.from({ length: 5 }, (_, i) => ({
      question: `Q${i + 1}?`,
      question_ko: `질문 ${i + 1}?`,
      options: ['A', 'B', 'C', 'D', 'E'],
      answer: 2,
      explanation: '해설입니다.',
    })),
    subjective: Array.from({ length: 5 }, (_, i) => ({
      question: `SQ${i + 1}?`,
      question_ko: `서술 ${i + 1}?`,
      answer: 'An answer.',
    })),
    key_sentences: [{ english: 'Para one.', korean: '문단 하나.' }],
    vocabulary: Array.from({ length: 6 }, (_, i) => ({
      word: `word${i}`,
      pos: 'n.',
      meaning: '뜻',
    })),
  }
}

describe('worksheetSchema', () => {
  it('accepts a well-formed worksheet', () => {
    expect(worksheetSchema.safeParse(validWorksheet()).success).toBe(true)
  })

  it('rejects when multiple_choice is not exactly 5', () => {
    const w = validWorksheet()
    w.multiple_choice = w.multiple_choice.slice(0, 4)
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })

  it('rejects when an MC question lacks exactly 5 options', () => {
    const w = validWorksheet()
    w.multiple_choice[0]!.options = ['A', 'B', 'C', 'D']
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })

  it('rejects an out-of-range answer index', () => {
    const w = validWorksheet()
    w.multiple_choice[0]!.answer = 6
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })

  it('rejects answer index 0 (must be 1-based)', () => {
    const w = validWorksheet()
    w.multiple_choice[0]!.answer = 0
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })

  it('rejects when subjective is not exactly 5', () => {
    const w = validWorksheet()
    w.subjective = w.subjective.slice(0, 3)
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })

  it('rejects vocabulary below 6 or above 20', () => {
    const w = validWorksheet()
    w.vocabulary = w.vocabulary.slice(0, 5)
    expect(worksheetSchema.safeParse(w).success).toBe(false)
    const w2 = validWorksheet()
    w2.vocabulary = Array.from({ length: 21 }, () => ({ word: 'x', pos: 'n.', meaning: '뜻' }))
    expect(worksheetSchema.safeParse(w2).success).toBe(false)
  })

  it('accepts up to 20 vocabulary items', () => {
    const w = validWorksheet()
    w.vocabulary = Array.from({ length: 20 }, () => ({ word: 'x', pos: 'n.', meaning: '뜻' }))
    expect(worksheetSchema.safeParse(w).success).toBe(true)
  })

  it('rejects when story_ko paragraph count differs from story', () => {
    const w = validWorksheet()
    w.story_ko = ['문단 하나.']
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })

  it('rejects empty strings in required fields', () => {
    const w = validWorksheet()
    w.title = '   '
    expect(worksheetSchema.safeParse(w).success).toBe(false)
  })
})
