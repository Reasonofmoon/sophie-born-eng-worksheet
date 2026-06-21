import { describe, expect, it } from 'vitest'
import {
  applyEdit,
  applyStructure,
  canApplyStructure,
  stripCircle,
  stripLabel,
  stripNum,
  stripParen,
  VOCAB_MAX,
  VOCAB_MIN,
  type EditableField,
} from './blocks'
import { PRESETS } from './presets'
import type { Worksheet } from './schema'

function sample(): Worksheet {
  // structuredClone keeps each test isolated from the shared preset object.
  return structuredClone(PRESETS[0]!.worksheet)
}

describe('display-prefix strippers', () => {
  it('removes a leading question number', () => {
    expect(stripNum('1. Why was Emma tired?')).toBe('Why was Emma tired?')
    expect(stripNum('10.   trailing')).toBe('trailing')
  })
  it('removes a leading circle marker', () => {
    expect(stripCircle('② Option text')).toBe('Option text')
  })
  it('removes wrapping parentheses', () => {
    expect(stripParen('(n.)')).toBe('n.')
  })
  it('removes a known label only when present', () => {
    expect(stripLabel('해설: 이유', '해설:')).toBe('이유')
    expect(stripLabel('답: 정답', '답:')).toBe('정답')
    expect(stripLabel('no label here', '해설:')).toBe('no label here')
  })
})

describe('applyEdit', () => {
  it('updates title and index', () => {
    const d = sample()
    applyEdit(d, { kind: 'title' }, '  New Title  ')
    applyEdit(d, { kind: 'index' }, ' 9 ')
    expect(d.title).toBe('New Title')
    expect(d.index).toBe('9')
  })

  it('updates a story paragraph by language', () => {
    const d = sample()
    applyEdit(d, { kind: 'storyPara', i: 0, lang: 'en' }, 'Rewritten para.')
    applyEdit(d, { kind: 'storyPara', i: 0, lang: 'ko' }, '새 단락.')
    expect(d.story[0]).toBe('Rewritten para.')
    expect(d.story_ko[0]).toBe('새 단락.')
  })

  it('strips the number prefix when editing an MC stem', () => {
    const d = sample()
    applyEdit(d, { kind: 'mcStem', i: 1 }, '2. Brand new stem?')
    expect(d.multiple_choice[1]!.question).toBe('Brand new stem?')
  })

  it('strips the circle prefix when editing an MC option', () => {
    const d = sample()
    applyEdit(d, { kind: 'mcOption', i: 0, oi: 2 }, '③ replaced option')
    expect(d.multiple_choice[0]!.options[2]).toBe('replaced option')
  })

  it('strips the 해설: label on explanation', () => {
    const d = sample()
    applyEdit(d, { kind: 'mcExplanation', i: 0 }, '해설: 새로운 해설')
    expect(d.multiple_choice[0]!.explanation).toBe('새로운 해설')
  })

  it('strips parentheses on vocab pos', () => {
    const d = sample()
    applyEdit(d, { kind: 'vocabPos', i: 0 }, '(adj.)')
    expect(d.vocabulary[0]!.pos).toBe('adj.')
  })

  it('strips the 답: label on sentence translation', () => {
    const d = sample()
    applyEdit(d, { kind: 'sentenceKo', i: 0 }, '답: 새 해석')
    expect(d.key_sentences[0]!.korean).toBe('새 해석')
  })

  it('ignores out-of-range indices without throwing', () => {
    const d = sample()
    const before = JSON.stringify(d)
    const stale: EditableField = { kind: 'mcOption', i: 99, oi: 99 }
    expect(() => applyEdit(d, stale, 'x')).not.toThrow()
    applyEdit(d, { kind: 'storyPara', i: 99, lang: 'en' }, 'x')
    applyEdit(d, { kind: 'vocabWord', i: 99 }, 'x')
    expect(JSON.stringify(d)).toBe(before)
  })

  it('still satisfies the schema after edits', () => {
    const d = sample()
    applyEdit(d, { kind: 'title' }, 'Edited')
    applyEdit(d, { kind: 'mcStem', i: 0 }, '1. Edited stem?')
    expect(d.multiple_choice).toHaveLength(5)
    expect(d.vocabulary.length).toBeGreaterThanOrEqual(6)
  })
})

describe('applyStructure (add/remove blocks)', () => {
  it('adds a vocab item after the given index, up to the max', () => {
    const d = sample()
    const start = d.vocabulary.length // last-seat ships 8 (== max)
    expect(canApplyStructure(d, { kind: 'addVocab', afterIndex: 0 })).toBe(false)
    // Trim to min, then we can add back toward the max.
    d.vocabulary = d.vocabulary.slice(0, VOCAB_MIN)
    expect(applyStructure(d, { kind: 'addVocab', afterIndex: 0 })).toBe(true)
    expect(d.vocabulary.length).toBe(VOCAB_MIN + 1)
    expect(start).toBe(VOCAB_MAX)
  })

  it('refuses to remove a vocab item below the minimum', () => {
    const d = sample()
    d.vocabulary = d.vocabulary.slice(0, VOCAB_MIN)
    expect(canApplyStructure(d, { kind: 'removeVocab', i: 0 })).toBe(false)
    expect(applyStructure(d, { kind: 'removeVocab', i: 0 })).toBe(false)
    expect(d.vocabulary.length).toBe(VOCAB_MIN)
  })

  it('removes a vocab item when above the minimum', () => {
    const d = sample()
    const before = d.vocabulary.length
    const firstWord = d.vocabulary[0]!.word
    expect(applyStructure(d, { kind: 'removeVocab', i: 0 })).toBe(true)
    expect(d.vocabulary.length).toBe(before - 1)
    expect(d.vocabulary[0]!.word).not.toBe(firstWord)
  })

  it('adds and removes sentences down to a floor of 1', () => {
    const d = sample()
    const before = d.key_sentences.length
    expect(applyStructure(d, { kind: 'addSentence', afterIndex: before - 1 })).toBe(true)
    expect(d.key_sentences.length).toBe(before + 1)
    d.key_sentences = d.key_sentences.slice(0, 1)
    expect(canApplyStructure(d, { kind: 'removeSentence', i: 0 })).toBe(false)
    expect(applyStructure(d, { kind: 'removeSentence', i: 0 })).toBe(false)
    expect(d.key_sentences.length).toBe(1)
  })
})
