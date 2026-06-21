import type { KeySentence, VocabularyItem, Worksheet } from './schema'

// Schema-derived bounds, surfaced so the UI can *nudge* (soft-disable + hint)
// instead of letting an edit fail validation.
export const VOCAB_MIN = 6
export const VOCAB_MAX = 8
export const SENTENCE_MIN = 1

const NEW_VOCAB: VocabularyItem = { word: 'word', pos: 'n.', meaning: '뜻' }
const NEW_SENTENCE: KeySentence = { english: 'New sentence.', korean: '해석' }

// Every editable piece of a worksheet is addressed as a discrete block object
// (stem, option, explanation, passage paragraph, vocab field, sentence…).
// Treating fields as objects lets the print layer slice content on block
// boundaries (break-inside: avoid) and keeps all mutation + display-prefix
// normalization in one tested place instead of scattered inline closures.

export type EditableField =
  | { kind: 'index' }
  | { kind: 'title' }
  | { kind: 'storyPara'; i: number; lang: 'en' | 'ko' }
  | { kind: 'mcStem'; i: number }
  | { kind: 'mcOption'; i: number; oi: number }
  | { kind: 'mcExplanation'; i: number }
  | { kind: 'subStem'; i: number }
  | { kind: 'subAnswer'; i: number }
  | { kind: 'vocabWord'; i: number }
  | { kind: 'vocabPos'; i: number }
  | { kind: 'vocabMeaning'; i: number }
  | { kind: 'sentenceEn'; i: number }
  | { kind: 'sentenceKo'; i: number }

// Display-prefix strippers — the UI shows "1. ", "② ", "(n.)", "해설: " etc.,
// but only the raw field value is written back to state.
export function stripNum(v: string): string {
  return v.replace(/^\s*\d+\.\s*/, '').trim()
}
export function stripCircle(v: string): string {
  return v.replace(/^\s*[①②③④⑤]\s*/, '').trim()
}
export function stripParen(v: string): string {
  return v.replace(/^\s*\(/, '').replace(/\)\s*$/, '').trim()
}
export function stripLabel(v: string, label: string): string {
  const t = v.trim()
  return t.startsWith(label) ? t.slice(label.length).trim() : t
}

// Structure operations add/remove whole blocks. Like applyEdit they treat the
// worksheet as a collection of block objects.
export type StructureOp =
  | { kind: 'addVocab'; afterIndex: number }
  | { kind: 'removeVocab'; i: number }
  | { kind: 'addSentence'; afterIndex: number }
  | { kind: 'removeSentence'; i: number }

/** Whether an op keeps the worksheet within schema bounds (drives nudges). */
export function canApplyStructure(d: Worksheet, op: StructureOp): boolean {
  switch (op.kind) {
    case 'addVocab':
      return d.vocabulary.length < VOCAB_MAX
    case 'removeVocab':
      return d.vocabulary.length > VOCAB_MIN
    case 'addSentence':
      return true
    case 'removeSentence':
      return d.key_sentences.length > SENTENCE_MIN
  }
}

/** Apply a structure op in place. No-ops (returns false) if out of bounds. */
export function applyStructure(d: Worksheet, op: StructureOp): boolean {
  if (!canApplyStructure(d, op)) return false
  switch (op.kind) {
    case 'addVocab':
      d.vocabulary.splice(op.afterIndex + 1, 0, { ...NEW_VOCAB })
      return true
    case 'removeVocab':
      if (d.vocabulary[op.i] === undefined) return false
      d.vocabulary.splice(op.i, 1)
      return true
    case 'addSentence':
      d.key_sentences.splice(op.afterIndex + 1, 0, { ...NEW_SENTENCE })
      return true
    case 'removeSentence':
      if (d.key_sentences[op.i] === undefined) return false
      d.key_sentences.splice(op.i, 1)
      return true
  }
}

/**
 * Apply an edit to the worksheet draft. Out-of-range indices are ignored so a
 * stale handler can never throw. Returns nothing; mutates the draft in place
 * (callers pass a structuredClone copy).
 */
export function applyEdit(d: Worksheet, field: EditableField, raw: string): void {
  switch (field.kind) {
    case 'index':
      d.index = raw.trim()
      return
    case 'title':
      d.title = raw.trim()
      return
    case 'storyPara': {
      const arr = field.lang === 'en' ? d.story : d.story_ko
      if (arr[field.i] !== undefined) arr[field.i] = raw.trim()
      return
    }
    case 'mcStem': {
      const t = d.multiple_choice[field.i]
      if (t) t.question = stripNum(raw)
      return
    }
    case 'mcOption': {
      const t = d.multiple_choice[field.i]
      if (t && t.options[field.oi] !== undefined) t.options[field.oi] = stripCircle(raw)
      return
    }
    case 'mcExplanation': {
      const t = d.multiple_choice[field.i]
      if (t) t.explanation = stripLabel(raw, '해설:')
      return
    }
    case 'subStem': {
      const t = d.subjective[field.i]
      if (t) t.question = stripNum(raw)
      return
    }
    case 'subAnswer': {
      const t = d.subjective[field.i]
      if (t) t.answer = raw.trim()
      return
    }
    case 'vocabWord': {
      const t = d.vocabulary[field.i]
      if (t) t.word = raw.trim()
      return
    }
    case 'vocabPos': {
      const t = d.vocabulary[field.i]
      if (t) t.pos = stripParen(raw)
      return
    }
    case 'vocabMeaning': {
      const t = d.vocabulary[field.i]
      if (t) t.meaning = raw.trim()
      return
    }
    case 'sentenceEn': {
      const t = d.key_sentences[field.i]
      if (t) t.english = stripNum(raw)
      return
    }
    case 'sentenceKo': {
      const t = d.key_sentences[field.i]
      if (t) t.korean = stripLabel(raw, '답:')
      return
    }
  }
}
