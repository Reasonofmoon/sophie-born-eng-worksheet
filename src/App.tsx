import { useEffect, useMemo, useState } from 'react'
import { PrivacyNudge } from './components/PrivacyNudge'
import { WorksheetDoc, type DocMeta } from './components/WorksheetDoc'
import { applyStructure, type StructureOp } from './lib/blocks'
import { generateWorksheet, LlmError, PROVIDER_IDS, PROVIDERS, type Provider } from './lib/llm'
import { LEVELS, LEVEL_VALUES, STYLE_OPTIONS, type Genre, type LevelValue } from './lib/levels'
import { PRESETS, type Preset } from './lib/presets'
import type { Worksheet } from './lib/schema'

type PrintMode = 'all' | 'student' | 'answers'

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

  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState<LevelValue>('elementary_5_6')
  const [genre, setGenre] = useState<Genre>('literature')
  const [style, setStyle] = useState('warm')
  const [vocab, setVocab] = useState('')

  const [ws, setWs] = useState<Worksheet | null>(null)
  const [meta, setMeta] = useState<DocMeta>(defaultMeta('문학', 'L3'))
  const [image, setImage] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<PrintMode>('all')
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const providerInfo = PROVIDERS[provider]
  const styles = STYLE_OPTIONS[genre]
  const noIllustration = NO_ILLUSTRATION.has(meta.levelCode)

  // Load the saved key whenever the provider changes; reset the model to a
  // valid one for that provider. Keys are per-provider, browser-only (BYOK).
  useEffect(() => {
    setApiKey(localStorage.getItem(keyStorageKey(provider)) ?? '')
    const first = PROVIDERS[provider].models[0]
    if (first) setModel(first)
  }, [provider])

  useEffect(() => {
    const first = styles[0]
    if (first && !styles.some((s) => s.value === style)) setStyle(first.value)
  }, [styles, style])

  const canGenerate = useMemo(() => apiKey.trim().length > 0 && !loading, [apiKey, loading])

  function onKeyChange(value: string) {
    setApiKey(value)
    localStorage.setItem(keyStorageKey(provider), value.trim())
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
      const result = await generateWorksheet({
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

  function clearKey() {
    setApiKey('')
    localStorage.removeItem(keyStorageKey(provider))
  }

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <h1>WorksheetCraft</h1>
        <p className="tagline">초·중등 영어 독해 학습지 생성기 · BYOK</p>

        <div className="section">샘플 학습지 (오프라인)</div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`preset ${activePreset === p.key ? 'active' : ''}`}
              onClick={() => loadPreset(p)}
            >
              <strong>{p.label}</strong>
              <span>{p.sublabel}</span>
            </button>
          ))}
        </div>

        <div className="section">AI 생성 (온라인)</div>
        <label>
          AI 제공자
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </label>

        <label>
          API Key ({providerInfo.keyHint})
          <input type="password" value={apiKey} onChange={(e) => onKeyChange(e.target.value)} placeholder={`${providerInfo.label} 키`} />
        </label>
        <PrivacyNudge
          providerLabel={providerInfo.label}
          consoleUrl={providerInfo.consoleUrl}
          hasKey={apiKey.trim().length > 0}
          onClear={clearKey}
        />

        <label>
          모델
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {providerInfo.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <label>
          주제
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 우정, 우주 여행" />
        </label>

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

        <button className="primary" disabled={!canGenerate} onClick={onGenerate}>
          {loading ? '생성 중…' : 'AI로 학습지 만들기'}
        </button>

        <div className="section">인쇄 / 보기</div>
        <label>
          인쇄 범위
          <select value={printMode} onChange={(e) => setPrintMode(e.target.value as PrintMode)}>
            <option value="all">학습지 + 답안지 (4페이지)</option>
            <option value="student">학습지만 (2페이지)</option>
            <option value="answers">답안지만 (2페이지)</option>
          </select>
        </label>
        <button className="secondary" disabled={!ws} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </button>

        {error && <p className="error">⚠ {error}</p>}
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
