import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PrivacyNudge } from './components/PrivacyNudge'
import { WorksheetDoc, type DocMeta } from './components/WorksheetDoc'
import { applyStructure, type StructureOp } from './lib/blocks'
import { buildHwpHtml, copyHtmlToClipboard } from './lib/hwp'
import {
  generateFromPassage,
  generateWorksheet,
  LlmError,
  PROVIDER_IDS,
  PROVIDERS,
  type Provider,
} from './lib/llm'
import { LEVELS, LEVEL_VALUES, STYLE_OPTIONS, type Genre, type LevelValue } from './lib/levels'
import { PRESETS, type Preset } from './lib/presets'
import type { Worksheet } from './lib/schema'
import {
  FONT_CHOICES,
  settingsFrom,
  TEMPLATES,
  templateById,
  type LayoutSettings,
} from './lib/templates'

type PrintMode = 'all' | 'student' | 'answers'
type GenMode = 'generate' | 'passage'

const BLANK = '______________________'
const NO_ILLUSTRATION = new Set(['L3', 'L4', 'L5'])
const keyStorageKey = (p: Provider) => `apikey_${p}`

function defaultMeta(genreLabel: string, levelCode: string): DocMeta {
  return { genreLabel, levelCode, footer: 'Born English', name: BLANK, date: BLANK }
}

export function App() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<string>(PROVIDERS.gemini.models[0] ?? 'gemini-2.5-flash')

  const [genMode, setGenMode] = useState<GenMode>('generate')
  const [topic, setTopic] = useState('')
  const [passage, setPassage] = useState('')
  const [level, setLevel] = useState<LevelValue>('elementary_5_6')
  const [genre, setGenre] = useState<Genre>('literature')
  const [style, setStyle] = useState('warm')
  const [vocab, setVocab] = useState('')

  const [ws, setWs] = useState<Worksheet | null>(null)
  const [meta, setMeta] = useState<DocMeta>(defaultMeta('문학', 'L3'))
  const [image, setImage] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<PrintMode>('all')
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const [templateId, setTemplateId] = useState('standard')
  const [settings, setSettings] = useState<LayoutSettings>(() => settingsFrom(templateById('standard')))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const providerInfo = PROVIDERS[provider]
  const styles = STYLE_OPTIONS[genre]
  const noIllustration = NO_ILLUSTRATION.has(meta.levelCode)

  useEffect(() => {
    setApiKey(localStorage.getItem(keyStorageKey(provider)) ?? '')
    const first = PROVIDERS[provider].models[0]
    if (first) setModel(first)
  }, [provider])

  useEffect(() => {
    const first = styles[0]
    if (first && !styles.some((s) => s.value === style)) setStyle(first.value)
  }, [styles, style])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const canGenerate = useMemo(() => {
    if (apiKey.trim().length === 0 || loading) return false
    return genMode === 'passage' ? passage.trim().length > 0 : true
  }, [apiKey, loading, genMode, passage])

  const styleVars = useMemo(
    () =>
      ({
        '--ws-font': settings.fontFamily,
        '--ws-font-size': `${settings.fontSizePx}px`,
        '--ws-line': String(settings.lineHeight),
        '--q-gap': `${settings.questionGapPx}px`,
        '--answer-h': `${settings.answerHeightPx}px`,
      }) as CSSProperties,
    [settings],
  )

  function onKeyChange(value: string) {
    setApiKey(value)
    localStorage.setItem(keyStorageKey(provider), value.trim())
  }

  function clearKey() {
    setApiKey('')
    localStorage.removeItem(keyStorageKey(provider))
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    setSettings(settingsFrom(templateById(id)))
  }

  function loadPreset(p: Preset) {
    setWs(structuredClone(p.worksheet))
    setMeta(defaultMeta(p.genre === 'nonfiction' ? '비문학' : '문학', p.levelCode))
    setGenre(p.genre)
    setImage(null)
    setActivePreset(p.key)
    setError(null)
  }

  async function onGenerate() {
    setError(null)
    setLoading(true)
    try {
      const result =
        genMode === 'passage'
          ? await generateFromPassage({ provider, apiKey, model, passage, level, genre })
          : await generateWorksheet({
              provider,
              apiKey,
              model,
              topic: topic.trim() || 'Kindness',
              level,
              genre,
              style,
              requiredVocabulary: vocab,
            })
      setWs(result)
      setMeta(defaultMeta(genre === 'nonfiction' ? '비문학' : '문학', LEVELS[level].code))
      setImage(null)
      setActivePreset(null)
    } catch (err) {
      setError(err instanceof LlmError || err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function updateWorksheet(mutator: (draft: Worksheet) => void) {
    setWs((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      mutator(next)
      return next
    })
  }

  function updateMeta(patch: Partial<DocMeta>) {
    setMeta((prev) => ({ ...prev, ...patch }))
  }

  function updateStructure(op: StructureOp) {
    setWs((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      applyStructure(next, op)
      return next
    })
  }

  async function copyHwp() {
    if (!ws) return
    const html = buildHwpHtml(ws, { genreLabel: meta.genreLabel, levelCode: meta.levelCode, footer: meta.footer }, settings, printMode)
    try {
      const ok = await copyHtmlToClipboard(html)
      if (ok) setNotice('HWP용 HTML을 복사했어요. HWP에서 Ctrl+V로 붙여넣으세요.')
      else setError('이 브라우저에서 클립보드 복사를 지원하지 않습니다.')
    } catch {
      setError('클립보드 접근 권한이 필요합니다.')
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <h1>WorksheetCraft</h1>
        <p className="tagline">초·중등 영어 독해 학습지 생성기 · BYOK</p>

        <div className="section">샘플 학습지 (오프라인)</div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.key} className={`preset ${activePreset === p.key ? 'active' : ''}`} onClick={() => loadPreset(p)}>
              <strong>{p.label}</strong>
              <span>{p.sublabel}</span>
            </button>
          ))}
        </div>

        <div className="section">AI 생성 (온라인)</div>
        <div className="segmented" role="tablist">
          <button className={`seg-btn ${genMode === 'generate' ? 'active' : ''}`} onClick={() => setGenMode('generate')}>
            AI 본문 생성
          </button>
          <button className={`seg-btn ${genMode === 'passage' ? 'active' : ''}`} onClick={() => setGenMode('passage')}>
            내 본문 사용
          </button>
        </div>

        <label>
          AI 제공자
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>{PROVIDERS[id].label}</option>
            ))}
          </select>
        </label>

        <label>
          API Key ({providerInfo.keyHint})
          <input type="password" value={apiKey} onChange={(e) => onKeyChange(e.target.value)} placeholder={`${providerInfo.label} 키`} />
        </label>
        <PrivacyNudge providerLabel={providerInfo.label} consoleUrl={providerInfo.consoleUrl} hasKey={apiKey.trim().length > 0} onClear={clearKey} />

        <label>
          모델
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {providerInfo.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        {genMode === 'passage' ? (
          <label>
            영어 본문 붙여넣기
            <textarea
              className="passage-input"
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder={'여기에 영어 지문을 붙여넣으세요.\n빈 줄로 단락을 구분하면 단락이 그대로 유지됩니다.'}
              rows={8}
            />
            <span className="field-nudge">💡 본문을 다시 만들지 않아 토큰을 아껴요. 문항·해석·어휘만 생성합니다.</span>
          </label>
        ) : (
          <label>
            주제
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 우정, 우주 여행" />
          </label>
        )}

        <label>
          난이도
          <select value={level} onChange={(e) => setLevel(e.target.value as LevelValue)}>
            {LEVEL_VALUES.map((v) => (
              <option key={v} value={v}>{LEVELS[v].labelKo}</option>
            ))}
          </select>
        </label>

        <label>
          장르
          <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>
            <option value="literature">문학</option>
            <option value="nonfiction">비문학</option>
          </select>
        </label>

        {genMode === 'generate' && (
          <>
            <label>
              {genre === 'nonfiction' ? '학습 주제/분야' : '이야기 스타일'}
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                {styles.map((s) => (
                  <option key={s.value} value={s.value}>{s.labelKo}</option>
                ))}
              </select>
            </label>
            <label>
              지정 단어 (선택)
              <input value={vocab} onChange={(e) => setVocab(e.target.value)} placeholder="kindness, brave" />
            </label>
          </>
        )}

        <button className="primary" disabled={!canGenerate} onClick={onGenerate}>
          {loading ? '생성 중…' : genMode === 'passage' ? '내 본문으로 학습지 만들기' : 'AI로 학습지 만들기'}
        </button>

        <div className="section">디자인 / 템플릿</div>
        <p className="field-nudge">🎨 레이아웃은 토큰을 쓰지 않아요 — 자유롭게 바꿔보세요.</p>
        <label>
          템플릿
          <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>
            ))}
          </select>
        </label>
        <label>
          폰트
          <select value={settings.fontFamily} onChange={(e) => setSettings((s) => ({ ...s, fontFamily: e.target.value }))}>
            {FONT_CHOICES.map((f) => (
              <option key={f.label} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>
        <label>
          글자 크기 <span className="val">{settings.fontSizePx}px</span>
          <input type="range" min={10} max={16} step={0.5} value={settings.fontSizePx} onChange={(e) => setSettings((s) => ({ ...s, fontSizePx: Number(e.target.value) }))} />
        </label>
        <label>
          문항 간격 <span className="val">{settings.questionGapPx}px</span>
          <input type="range" min={2} max={24} step={1} value={settings.questionGapPx} onChange={(e) => setSettings((s) => ({ ...s, questionGapPx: Number(e.target.value) }))} />
        </label>
        <label>
          답란 높이 <span className="val">{settings.answerHeightPx}px</span>
          <input type="range" min={28} max={140} step={4} value={settings.answerHeightPx} onChange={(e) => setSettings((s) => ({ ...s, answerHeightPx: Number(e.target.value) }))} />
        </label>

        <div className="section">인쇄 / 내보내기</div>
        <label>
          범위
          <select value={printMode} onChange={(e) => setPrintMode(e.target.value as PrintMode)}>
            <option value="all">학습지 + 답안지 (4페이지)</option>
            <option value="student">학습지만 (2페이지)</option>
            <option value="answers">답안지만 (2페이지)</option>
          </select>
        </label>
        <button className="secondary" disabled={!ws} onClick={() => window.print()}>인쇄 / PDF 저장</button>
        <button className="secondary" disabled={!ws} onClick={copyHwp}>HWP용 HTML 복사</button>

        {error && <p className="error">⚠ {error}</p>}
        {notice && <p className="notice">✓ {notice}</p>}
      </aside>

      <main className={`canvas print-${printMode}`}>
        {ws ? (
          <WorksheetDoc
            worksheet={ws}
            meta={meta}
            image={image}
            noIllustration={noIllustration}
            onWorksheet={updateWorksheet}
            onMeta={updateMeta}
            onImage={setImage}
            onStructure={updateStructure}
            styleVars={styleVars}
          />
        ) : (
          <div className="empty no-print">
            <p>왼쪽에서 샘플을 불러오거나, 키를 입력해 학습지를 생성하세요.</p>
          </div>
        )}
      </main>

      {loading && (
        <div className="overlay no-print">
          <div className="spinner" />
          <p>AI가 학습지를 생성하고 있습니다…</p>
        </div>
      )}
    </div>
  )
}
