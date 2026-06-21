import { describe, expect, it } from 'vitest'
import { buildPassagePrompt, splitPassage } from './prompt'
import { assembleWorksheet, byotOutputSchema, worksheetSchema, type ByotOutput } from './schema'
import { PRESETS } from './presets'

function byotFromPreset(): ByotOutput {
  const w = structuredClone(PRESETS[0]!.worksheet)
  const { story: _story, ...rest } = w
  return rest
}

describe('splitPassage', () => {
  it('splits on blank lines', () => {
    expect(splitPassage('Para one.\n\nPara two.\n\nPara three.')).toEqual(['Para one.', 'Para two.', 'Para three.'])
  })
  it('falls back to single newlines when there are no blank lines', () => {
    expect(splitPassage('Line A.\nLine B.')).toEqual(['Line A.', 'Line B.'])
  })
  it('treats a single block as one paragraph', () => {
    expect(splitPassage('Just one paragraph with. Two sentences.')).toEqual(['Just one paragraph with. Two sentences.'])
  })
  it('normalizes CRLF and trims, dropping empty paragraphs', () => {
    expect(splitPassage('  A.\r\n\r\n\r\n B. \r\n\r\n  ')).toEqual(['A.', 'B.'])
  })
  it('returns empty array for blank input', () => {
    expect(splitPassage('   \n  ')).toEqual([])
  })
})

describe('buildPassagePrompt', () => {
  it('embeds numbered paragraphs and forbids regenerating the passage', () => {
    const p = buildPassagePrompt({ paragraphs: ['First.', 'Second.'], level: 'middle_1_2', genre: 'nonfiction' })
    expect(p).toContain('[1] First.')
    expect(p).toContain('[2] Second.')
    expect(p).toContain('do NOT rewrite')
    expect(p).toContain('exactly 2 entries')
    expect(p).toContain('Do NOT include a "story" field')
  })
})

describe('BYOT output → worksheet', () => {
  it('byotOutputSchema accepts model output without a story field', () => {
    expect(byotOutputSchema.safeParse(byotFromPreset()).success).toBe(true)
  })

  it('rejects output that still lacks 5 MC questions', () => {
    const out = byotFromPreset()
    out.multiple_choice = out.multiple_choice.slice(0, 3)
    expect(byotOutputSchema.safeParse(out).success).toBe(false)
  })

  it('assembleWorksheet injects the teacher paragraphs and passes the full schema', () => {
    const out = byotFromPreset()
    const story = ['My own first paragraph.', 'My own second paragraph.', 'Third.', 'Fourth.', 'Fifth.', 'Sixth.', 'Seventh.']
    // last-seat ships 7 story_ko entries, so a 7-paragraph story aligns.
    const merged = assembleWorksheet(story, out)
    expect(merged.story).toEqual(story)
    expect(worksheetSchema.safeParse(merged).success).toBe(true)
  })

  it('full schema rejects when paragraph count and translation count differ', () => {
    const out = byotFromPreset()
    const merged = assembleWorksheet(['only one paragraph'], out)
    expect(worksheetSchema.safeParse(merged).success).toBe(false)
  })
})
