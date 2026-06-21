import { describe, expect, it } from 'vitest'
import { buildHwpHtml, type HwpMeta } from './hwp'
import { PRESETS } from './presets'
import { settingsFrom, templateById, TEMPLATES } from './templates'

const ws = PRESETS[0]!.worksheet
const meta: HwpMeta = { genreLabel: '문학', levelCode: 'L3', footer: 'Born English' }
const settings = settingsFrom(templateById('standard'))

describe('templates', () => {
  it('templateById falls back to the first template for unknown ids', () => {
    expect(templateById('nope').id).toBe(TEMPLATES[0]!.id)
  })
  it('every template provides both screen px and HWP pt sizes', () => {
    for (const t of TEMPLATES) {
      expect(t.fontSizePx).toBeGreaterThan(0)
      expect(t.bodyPt).toBeGreaterThan(0)
      expect(t.fontFamily).toContain(',')
    }
  })
})

describe('buildHwpHtml', () => {
  it('uses inline styles with the template font (no CSS classes)', () => {
    const html = buildHwpHtml(ws, meta, settings, 'all')
    expect(html).toContain('font-family:')
    expect(html).toContain('pt;')
    expect(html).not.toContain('class=')
  })

  it('student mode includes the passage and questions but not answers', () => {
    const html = buildHwpHtml(ws, meta, settings, 'student')
    expect(html).toContain('지문 (Passage)')
    expect(html).toContain('독해 문제')
    expect(html).not.toContain('정답 및 해설')
  })

  it('answers mode includes the answer key and the correct option in bold', () => {
    const html = buildHwpHtml(ws, meta, settings, 'answers')
    expect(html).toContain('정답 및 해설')
    expect(html).toContain('정답:')
    expect(html).not.toContain('지문 (Passage)')
  })

  it('all mode includes both student and answer sections', () => {
    const html = buildHwpHtml(ws, meta, settings, 'all')
    expect(html).toContain('지문 (Passage)')
    expect(html).toContain('정답 및 해설')
  })

  it('escapes HTML-special characters from content', () => {
    const tricky = structuredClone(ws)
    tricky.story[0] = 'Tom & Jerry <said> "hi"'
    const html = buildHwpHtml(tricky, meta, settings, 'student')
    expect(html).toContain('Tom &amp; Jerry &lt;said&gt;')
    expect(html).not.toContain('<said>')
  })
})
