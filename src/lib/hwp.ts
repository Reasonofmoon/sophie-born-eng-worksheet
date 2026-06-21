import type { LayoutSettings } from './templates'
import type { Worksheet } from './schema'

// Build a self-contained, inline-styled HTML fragment that pastes cleanly into
// HWP / HWPX. HWP ignores external stylesheets and CSS classes, so every block
// carries its own inline style derived from the chosen layout template.

const CIRCLE = ['①', '②', '③', '④', '⑤'] as const

export type ExportMode = 'all' | 'student' | 'answers'
export type ExportLang = 'both' | 'en'

export interface HwpMeta {
  genreLabel: string
  levelCode: string
  footer: string
  academyName: string
  logoDataUrl: string | null
  readability: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildHwpHtml(ws: Worksheet, meta: HwpMeta, s: LayoutSettings, mode: ExportMode, lang: ExportLang = 'both'): string {
  const base = `font-family:${s.fontFamily};font-size:${s.bodyPt}pt;line-height:${s.lineHeight};`
  const gap = `margin:0 0 ${s.blockGapPt}pt 0;`
  const titlePt = s.bodyPt + 5
  const showKo = lang === 'both'

  const p = (text: string, extra = '') => `<p style="${base}${gap}${extra}">${text}</p>`
  const h = (text: string) =>
    `<p style="${base}margin:14pt 0 6pt 0;font-weight:bold;border-bottom:1px solid #333;">${esc(text)}</p>`
  // Empty writing box for students to fill in (height derived from layout).
  const answerPt = Math.max(20, Math.round(s.answerHeightPx * 0.75))
  const box = (hpt: number) =>
    `<div style="border:1px solid #999;border-radius:3px;height:${hpt}pt;margin:3pt 0 ${s.blockGapPt}pt 0;"></div>`

  const title = `${esc(ws.title)} (${esc(meta.levelCode)})`
  const parts: string[] = []

  // Branding bar: logo + academy name + readability mapping.
  const brandBits: string[] = []
  if (meta.logoDataUrl) brandBits.push(`<img src="${meta.logoDataUrl}" style="height:24pt;vertical-align:middle;" alt="logo" />`)
  if (meta.academyName.trim()) brandBits.push(`<b>${esc(meta.academyName)}</b>`)
  if (meta.readability.trim()) brandBits.push(`<span style="color:#555;">${esc(meta.readability)}</span>`)
  if (brandBits.length) {
    parts.push(`<p style="${base}margin:0 0 6pt 0;">${brandBits.join('&nbsp;&nbsp;')}</p>`)
  }

  parts.push(
    `<p style="${base}font-size:${titlePt}pt;font-weight:bold;margin:0 0 4pt 0;">${esc(ws.index)}. ${title} [${esc(meta.genreLabel)}]</p>`,
  )

  const wantsStudent = mode === 'all' || mode === 'student'
  const wantsAnswers = mode === 'all' || mode === 'answers'

  if (wantsStudent) {
    parts.push(p('Name: ______________   Date: ______________', 'color:#555;'))
    parts.push(h('지문 (Passage)'))
    for (const para of ws.story) parts.push(p(esc(para)))

    parts.push(h('핵심 단어 (Vocabulary)'))
    for (const v of ws.vocabulary) {
      const meaning = showKo ? ` — ${esc(v.meaning)}` : ''
      parts.push(p(`<b>${esc(v.word)}</b> (${esc(v.pos)})${meaning}`))
    }

    parts.push(h('독해 문제 (Comprehension)'))
    ws.multiple_choice.forEach((mc, i) => {
      const opts = mc.options.map((o, oi) => `${CIRCLE[oi]} ${esc(o)}`).join('&nbsp;&nbsp;&nbsp;')
      parts.push(p(`<b>${i + 1}.</b> ${esc(mc.question)}<br>${opts}`))
    })
    ws.subjective.forEach((sub, i) => {
      parts.push(p(`<b>${i + 6}.</b> ${esc(sub.question)}`))
      parts.push(box(answerPt))
    })

    parts.push(h('문장 해석 연습 (Sentence Translation)'))
    ws.key_sentences.forEach((ks, i) => {
      parts.push(p(`${i + 1}. ${esc(ks.english)}`))
      parts.push(box(Math.round(answerPt * 0.62)))
    })
  }

  if (wantsAnswers) {
    if (showKo) {
      parts.push(h('● 정답 및 해설 — 본문 해석 (Korean Translation)'))
      for (const para of ws.story_ko) parts.push(p(esc(para)))
    }

    parts.push(h('● 객관식 정답 (Multiple Choice)'))
    ws.multiple_choice.forEach((mc, i) => {
      const opts = mc.options
        .map((o, oi) => (mc.answer === oi + 1 ? `<b>${CIRCLE[oi]} ${esc(o)}</b>` : `${CIRCLE[oi]} ${esc(o)}`))
        .join('&nbsp;&nbsp;&nbsp;')
      const ko = showKo ? ` (${esc(mc.question_ko)})` : ''
      parts.push(
        p(
          `<b>${i + 1}.</b> ${esc(mc.question)}${ko}<br>${opts}<br>` +
            `<span style="color:#b91c1c;">정답: ${CIRCLE[mc.answer - 1]} · 해설: ${esc(mc.explanation)}</span>`,
        ),
      )
    })

    parts.push(h('● 서술형 정답 (Q6-10)'))
    ws.subjective.forEach((sub, i) => {
      const ko = showKo ? ` (${esc(sub.question_ko)})` : ''
      parts.push(
        p(`<b>${i + 6}.</b> ${esc(sub.question)}${ko}<br><span style="color:#b91c1c;">${esc(sub.answer)}</span>`),
      )
    })

    if (showKo) {
      parts.push(h('● 문장 해석 정답'))
      ws.key_sentences.forEach((ks, i) =>
        parts.push(p(`${i + 1}. ${esc(ks.english)}<br><span style="color:#0d9488;">답: ${esc(ks.korean)}</span>`)),
      )
    }
  }

  if (meta.footer.trim()) parts.push(p(esc(meta.footer), 'text-align:center;color:#888;margin-top:14pt;'))

  return `<div style="${base}">${parts.join('')}</div>`
}

/**
 * Wrap the fragment in a complete HTML document. HWP/한글 only treats clipboard
 * content as rich text when it's a full, well-formed document with a charset —
 * a bare fragment gets pasted as literal source code.
 */
export function wrapHtmlDocument(fragment: string, title = 'Worksheet'): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${title.replace(/[<>&]/g, '')}</title>`,
    '</head>',
    `<body>${fragment}</body>`,
    '</html>',
  ].join('')
}

/** Strip tags for the plain-text clipboard fallback. */
function toPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Copy HTML to the clipboard as both text/html (for HWP paste) and text/plain
 * (fallback). Returns true on success.
 */
export async function copyHtmlToClipboard(fragment: string): Promise<boolean> {
  const doc = wrapHtmlDocument(fragment)
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      'text/html': new Blob([doc], { type: 'text/html' }),
      'text/plain': new Blob([toPlain(fragment)], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    return true
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(toPlain(fragment))
    return true
  }
  return false
}

/**
 * Download the worksheet as a standalone .html file. The most reliable path for
 * HWP: open 한글 → 불러오기 → select the .html (한글 converts it to HWP), or open
 * it in a browser and copy the rendered selection.
 */
export function downloadHtmlFile(fragment: string, filename: string): void {
  const blob = new Blob([wrapHtmlDocument(fragment, filename)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
