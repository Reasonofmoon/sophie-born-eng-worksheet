import { describe, expect, it } from 'vitest'
import { PRESETS } from './presets'
import { worksheetSchema } from './schema'

describe('PRESETS', () => {
  it('ships exactly the three legacy samples', () => {
    expect(PRESETS.map((p) => p.key)).toEqual(['last-seat', 'little-seed', 'night-flight'])
  })

  it.each(PRESETS.map((p) => [p.key, p] as const))(
    'preset "%s" satisfies the worksheet schema',
    (_key, preset) => {
      const result = worksheetSchema.safeParse(preset.worksheet)
      expect(result.success, JSON.stringify(result.success ? {} : result.error.issues[0])).toBe(true)
    },
  )

  it.each(PRESETS.map((p) => [p.key, p] as const))(
    'preset "%s" has aligned story / story_ko paragraph counts',
    (_key, preset) => {
      expect(preset.worksheet.story.length).toBe(preset.worksheet.story_ko.length)
    },
  )
})
