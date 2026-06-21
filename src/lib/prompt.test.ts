import { describe, expect, it } from 'vitest'
import { buildPrompt } from './prompt'

describe('buildPrompt', () => {
  it('embeds the exact paragraph and word target for the level', () => {
    const p = buildPrompt({
      topic: 'Kindness',
      level: 'elementary_5_6',
      genre: 'literature',
      style: 'warm',
    })
    expect(p).toContain('exactly 4 short paragraphs')
    expect(p).toContain('120-140 words')
    expect(p).toContain('warm and touching story')
  })

  it('uses the 10-sentence rule for lower levels', () => {
    const p = buildPrompt({
      topic: 'Honesty',
      level: 'elementary_1_2',
      genre: 'literature',
      style: 'fable',
    })
    expect(p).toContain('exactly 10 representative sentences')
    expect(p).toContain('exactly 3 short paragraphs')
  })

  it('uses the all-sentences rule for higher levels', () => {
    const p = buildPrompt({
      topic: 'Space',
      level: 'middle_2_3',
      genre: 'nonfiction',
      style: 'space',
    })
    expect(p).toContain('ALL sentences from the story')
    expect(p).toContain('160-180 words')
  })

  it('switches genre instruction for non-fiction', () => {
    const p = buildPrompt({
      topic: 'Climate',
      level: 'middle_1_2',
      genre: 'nonfiction',
      style: 'environment',
    })
    expect(p).toContain('informational, explanatory, or argumentative')
    expect(p).toContain('nature and environment informational text')
  })

  it('includes required vocabulary only when provided', () => {
    const withVocab = buildPrompt({
      topic: 'Friendship',
      level: 'elementary_3_4',
      genre: 'literature',
      style: 'warm',
      requiredVocabulary: 'kindness, brave',
    })
    expect(withVocab).toContain('kindness, brave')

    const without = buildPrompt({
      topic: 'Friendship',
      level: 'elementary_3_4',
      genre: 'literature',
      style: 'warm',
    })
    expect(without).not.toContain('Required vocabulary')
  })

  it('falls back to the first style when an unknown style is given', () => {
    const p = buildPrompt({
      topic: 'X',
      level: 'elementary_3_4',
      genre: 'literature',
      style: 'does-not-exist',
    })
    expect(p).toContain('warm and touching story')
  })
})
