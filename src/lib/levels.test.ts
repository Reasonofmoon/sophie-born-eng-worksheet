import { describe, expect, it } from 'vitest'
import { LEVELS, LEVEL_VALUES, levelByCode, readabilityLabel } from './levels'

describe('level readability mapping', () => {
  it('every level defines CEFR / AR / Lexile bands', () => {
    for (const v of LEVEL_VALUES) {
      const cfg = LEVELS[v]
      expect(cfg.cefr).toBeTruthy()
      expect(cfg.ar).toMatch(/\d/)
      expect(cfg.lexile).toMatch(/L|BR/)
    }
  })

  it('readabilityLabel composes the three scales', () => {
    expect(readabilityLabel(LEVELS.elementary_5_6)).toBe('CEFR A2 · AR 3.0–4.5 · Lexile 400L–700L')
  })

  it('levelByCode resolves preset codes back to their config', () => {
    expect(levelByCode('L3')?.value).toBe('elementary_5_6')
    expect(levelByCode('L1')?.cefr).toBe('Pre-A1')
    expect(levelByCode('L9')).toBeUndefined()
  })

  it('codes are unique across levels', () => {
    const codes = LEVEL_VALUES.map((v) => LEVELS[v].code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
