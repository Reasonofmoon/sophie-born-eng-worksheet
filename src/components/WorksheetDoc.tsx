import type { CSSProperties } from 'react'
import { applyEdit, SENTENCE_MIN, VOCAB_MAX, VOCAB_MIN, type EditableField, type StructureOp } from '../lib/blocks'
import type { Worksheet } from '../lib/schema'
import { EditableText } from './EditableText'
import { Illustration } from './Illustration'

const CIRCLE = ['①', '②', '③', '④', '⑤'] as const

export type LangMode = 'both' | 'en'

export interface DocMeta {
  genreLabel: string
  levelCode: string
  footer: string
  name: string
  date: string
  academyName: string
  logoDataUrl: string | null
  /** "CEFR A2 · AR 3.0–4.5 · Lexile 400L–700L". */
  readability: string
}

interface Props {
  worksheet: Worksheet
  meta: DocMeta
  image: string | null
  noIllustration: boolean
  langMode: LangMode
  onWorksheet: (mutator: (draft: Worksheet) => void) => void
  onMeta: (patch: Partial<DocMeta>) => void
  onImage: (dataUrl: string) => void
  onStructure: (op: StructureOp) => void
  styleVars?: CSSProperties
}

export function WorksheetDoc({ worksheet: ws, meta, image, noIllustration, langMode, onWorksheet, onMeta, onImage, onStructure, styleVars }: Props) {
  const titleSuffix = ` (${meta.levelCode})`

  // Bind an EditableField object to a worksheet mutation. Each editable block
  // is addressed by its field object, so editing routes through one tested path.
  const edit = (field: EditableField) => (v: string) => onWorksheet((d) => applyEdit(d, field, v))

  const vocabCount = ws.vocabulary.length
  const sentenceCount = ws.key_sentences.length
  const canAddVocab = vocabCount < VOCAB_MAX
  const canRemoveVocab = vocabCount > VOCAB_MIN
  const canRemoveSentence = sentenceCount > SENTENCE_MIN
  const vocabAtEdge = !canAddVocab || !canRemoveVocab

  function Header({ badge, teacher, first }: { badge?: { text: string; tone?: 'answer' | 'answer2' | 'trans' }; teacher?: string; first?: boolean }) {
    // After the first page, show only a slim section label — the full branding /
    // name-date / title header appears once at the very top.
    if (!first) {
      return (
        <header className="ws-header slim">
          {teacher && <span className="teacher">{teacher}</span>}
          {badge && <span className={`badge ${badge.tone ?? 'answer'}`}>{badge.text}</span>}
        </header>
      )
    }
    return (
      <header className="ws-header">
        <div className="ws-brand">
          {meta.logoDataUrl && <img className="ws-logo" src={meta.logoDataUrl} alt="academy logo" />}
          <EditableText as="span" className="ws-academy" value={meta.academyName} onChange={(v) => onMeta({ academyName: v })} />
          {meta.readability && <span className="ws-readability">{meta.readability}</span>}
        </div>
        <div className="ws-meta">
          {teacher ? (
            <span className="teacher">{teacher}</span>
          ) : (
            <>
              <span>Name: <EditableText as="span" value={meta.name} onChange={(v) => onMeta({ name: v })} /></span>
              <span>Date: <EditableText as="span" value={meta.date} onChange={(v) => onMeta({ date: v })} /></span>
            </>
          )}
        </div>
        <div className="ws-title-row">
          <EditableText as="span" className="ws-index" value={ws.index} onChange={edit({ kind: 'index' })} />
          <EditableText as="h2" className="ws-title" value={ws.title} onChange={edit({ kind: 'title' })} />
          <span className="ws-level">{titleSuffix}</span>
          <EditableText as="span" className="badge genre" value={meta.genreLabel} onChange={(v) => onMeta({ genreLabel: v })} />
          {badge && <span className={`badge ${badge.tone ?? 'answer'}`}>{badge.text}</span>}
        </div>
      </header>
    )
  }

  function Footer() {
    return (
      <footer className="ws-footer">
        <EditableText as="p" value={meta.footer} onChange={(v) => onMeta({ footer: v })} />
      </footer>
    )
  }

  return (
    <div className={`doc lang-${langMode}`} style={styleVars}>
      {/* ---- PAGE 1 — student worksheet ---- */}
      <article className="page" data-page="student">
        <Header first />
        <section className={`story-row ${noIllustration ? 'no-illustration' : ''}`}>
          <div className="story">
            {ws.story.map((p, i) => (
              <EditableText as="p" className="print-block" key={i} value={p} onChange={edit({ kind: 'storyPara', i, lang: 'en' })} />
            ))}
          </div>
          {!noIllustration && <Illustration src={image} onUpload={onImage} />}
        </section>
        <section className="vocab-panel">
          <div className="instruction">
            ★ 핵심 단어 정리
            <span className={`count-nudge ${vocabAtEdge ? 'edge' : 'ok'} no-print`}>{vocabCount} / {VOCAB_MIN}–{VOCAB_MAX}</span>
          </div>
          <div className="vocab-grid">
            {ws.vocabulary.map((vEntry, i) => (
              <div className="vocab-item print-block" key={i}>
                <button
                  type="button"
                  className="item-del no-print"
                  disabled={!canRemoveVocab}
                  title={canRemoveVocab ? '이 단어 삭제' : `핵심 단어는 최소 ${VOCAB_MIN}개를 권장해요`}
                  onClick={() => onStructure({ kind: 'removeVocab', i })}
                  aria-label="단어 삭제"
                >
                  ×
                </button>
                <div className="vocab-word">
                  <EditableText as="span" value={vEntry.word} onChange={edit({ kind: 'vocabWord', i })} />
                  <EditableText as="span" className="pos" value={`(${vEntry.pos})`} onChange={edit({ kind: 'vocabPos', i })} />
                </div>
                <EditableText className="vocab-meaning" value={vEntry.meaning} onChange={edit({ kind: 'vocabMeaning', i })} />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="add-nudge no-print"
            disabled={!canAddVocab}
            title={canAddVocab ? '단어 추가' : `핵심 단어는 ${VOCAB_MAX}개까지 권장해요`}
            onClick={() => onStructure({ kind: 'addVocab', afterIndex: vocabCount - 1 })}
          >
            + 단어 추가 {!canAddVocab && '(최대)'}
          </button>
        </section>
        <section className="questions">
          {ws.multiple_choice.map((mc, i) => (
            <div className="q print-block" key={`mc-${i}`}>
              <EditableText className="q-text" value={`${i + 1}. ${mc.question}`} onChange={edit({ kind: 'mcStem', i })} />
              <div className="opts">
                {mc.options.map((opt, oi) => (
                  <EditableText as="span" className="opt" key={oi} value={`${CIRCLE[oi]} ${opt}`} onChange={edit({ kind: 'mcOption', i, oi })} />
                ))}
              </div>
            </div>
          ))}
          {ws.subjective.map((sub, i) => (
            <div className="q print-block" key={`sub-${i}`}>
              <EditableText className="q-text" value={`${i + 6}. ${sub.question}`} onChange={edit({ kind: 'subStem', i })} />
              <div className="write-box answer-area" aria-hidden="true" />
            </div>
          ))}
        </section>
        <Footer />
      </article>

      {/* ---- PAGE 2 — translation practice ---- */}
      <article className="page" data-page="student">
        <Header badge={{ text: '구문 해석 연습', tone: 'trans' }} />
        <section className="trans-single">
          <div className="instruction">
            ★ 다음 중요 문장을 읽고, 빈칸에 알맞은 한글 해석을 써 봅시다.
            <span className="count-nudge ok no-print">{sentenceCount}문장</span>
          </div>
          {ws.key_sentences.map((ks, i) => (
            <div className="trans-item print-block" key={i}>
              <button
                type="button"
                className="item-del no-print"
                disabled={!canRemoveSentence}
                title={canRemoveSentence ? '이 문장 삭제' : '문장은 최소 1개가 필요해요'}
                onClick={() => onStructure({ kind: 'removeSentence', i })}
                aria-label="문장 삭제"
              >
                ×
              </button>
              <EditableText className="trans-en" value={`${i + 1}. ${ks.english}`} onChange={edit({ kind: 'sentenceEn', i })} />
              <div className="write-box trans-area" aria-hidden="true" />
            </div>
          ))}
          <button
            type="button"
            className="add-nudge no-print"
            onClick={() => onStructure({ kind: 'addSentence', afterIndex: sentenceCount - 1 })}
          >
            + 문장 추가
          </button>
        </section>
        <Footer />
      </article>

      {/* ---- PAGE 3 — answer key 1 (translation + MC answers) ---- */}
      <article className="page answer-key" data-page="answers">
        <Header teacher="Teacher's Copy (정답 ①)" badge={{ text: '정답 및 해설 ①', tone: 'answer' }} />
        <section className={`story-row ko-only ${noIllustration ? 'no-illustration' : ''}`}>
          <div className="story">
            {ws.story_ko.map((p, i) => (
              <EditableText as="p" className="print-block" key={i} value={p} onChange={edit({ kind: 'storyPara', i, lang: 'ko' })} />
            ))}
          </div>
          {!noIllustration && <Illustration src={image} onUpload={onImage} />}
        </section>
        <section className="questions">
          {ws.multiple_choice.map((mc, i) => (
            <div className="q print-block" key={`mck-${i}`}>
              <div className="q-text">
                {i + 1}. {mc.question} <span className="q-ko">({mc.question_ko})</span>
              </div>
              <div className="opts">
                {mc.options.map((opt, oi) => (
                  <span className={`opt ${mc.answer === oi + 1 ? 'correct' : ''}`} key={oi}>
                    {CIRCLE[oi]} {opt}
                  </span>
                ))}
              </div>
              <div className="answer">정답: {CIRCLE[mc.answer - 1]}</div>
              <EditableText className="explanation" value={`해설: ${mc.explanation}`} onChange={edit({ kind: 'mcExplanation', i })} />
            </div>
          ))}
        </section>
        <Footer />
      </article>

      {/* ---- PAGE 4 — answer key 2 (subjective + sentence answers) ---- */}
      <article className="page answer-key" data-page="answers">
        <Header teacher="Teacher's Copy (정답 ②)" badge={{ text: '정답 및 해설 ②', tone: 'answer2' }} />
        <section className="questions">
          <div className="instruction">★ 서술형 질문 정답 (Q6-10)</div>
          {ws.subjective.map((sub, i) => (
            <div className="q print-block" key={`subk-${i}`}>
              <div className="q-text">
                {i + 6}. {sub.question} <span className="q-ko">({sub.question_ko})</span>
              </div>
              <EditableText className="answer" value={sub.answer} onChange={edit({ kind: 'subAnswer', i })} />
            </div>
          ))}
        </section>
        <section className="trans-key">
          <div className="instruction">★ 중요 문장 해석 정답</div>
          {ws.key_sentences.map((ks, i) => (
            <div className="trans-key-item print-block" key={i}>
              <div className="trans-en">{i + 1}. {ks.english}</div>
              <EditableText className="trans-ko" value={`답: ${ks.korean}`} onChange={edit({ kind: 'sentenceKo', i })} />
            </div>
          ))}
        </section>
        <Footer />
      </article>
    </div>
  )
}
