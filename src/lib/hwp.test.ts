import { describe, expect, it } from 'vitest'
import { buildHwpHtml, wrapHtmlDocument, type HwpMeta } from './hwp'
import { PRESETS } from './presets'
import { settingsFrom, templateById, TEMPLATES } from './templates'

const ws = PRESETS[0]!.worksheet
const meta: HwpMeta = {
  genreLabel: '문학',
  levelCode: 'L3',
  footer: 'Born English',
  academyName: '본잉글리시',
  logoDataUrl: null,
  readability: 'CEFR A2 · AR 3.0–4.5 · Lexile 400L–700L',
}
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

  it('includes the academy name and readability mapping in the branding bar', () => {
    const html = buildHwpHtml(ws, meta, settings, 'all')
    expect(html).toContain('본잉글리시')
    expect(html).toContain('CEFR A2')
    expect(html).toContain('Lexile 400L–700L')
  })

  it('wrapHtmlDocument produces a complete, charset-tagged document (HWP needs this)', () => {
    const doc = wrapHtmlDocument(buildHwpHtml(ws, meta, settings, 'all'))
    expect(doc.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(doc).toContain('<meta charset="utf-8">')
    expect(doc).toContain('<body>')
    expect(doc.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('omits Korean content when lang is "en"', () => {
    const en = buildHwpHtml(ws, meta, settings, 'all', 'en')
    expect(en).not.toContain('본문 해석')
    expect(en).not.toContain('문장 해석 정답')
    const vocab = ws.vocabulary[0]!
    expect(en).not.toContain(vocab.meaning)
    // English still present
    expect(en).toContain('지문 (Passage)')
  })
})
