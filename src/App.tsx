import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PrivacyNudge } from './components/PrivacyNudge'
import { WorksheetDoc, type DocMeta, type LangMode } from './components/WorksheetDoc'
import { applyStructure, type StructureOp } from './lib/blocks'
import { buildHwpHtml, copyHtmlToClipboard, downloadHtmlFile } from './lib/hwp'
import {
  generateFromPassage,
  generateWorksheet,
  LlmError,
  PROVIDER_IDS,
  PROVIDERS,
  type Provider,
} from './lib/llm'
import {
  LEVELS,
  LEVEL_VALUES,
  levelByCode,
  readabilityLabel,
  STYLE_OPTIONS,
  type Genre,
  type LevelValue,
} from './lib/levels'
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

interface Branding {
  academyName: string
  logoDataUrl: string | null
}

function readabilityForCode(levelCode: string): string {
  const cfg = levelByCode(levelCode)
  return cfg ? readabilityLabel(cfg) : ''
}

function defaultMeta(genreLabel: string, levelCode: string, branding: Branding): DocMeta {
  return {
    genreLabel,
    levelCode,
    footer: branding.academyName || 'Born English',
    name: BLANK,
    date: BLANK,
    academyName: branding.academyName,
    logoDataUrl: branding.logoDataUrl,
    readability: readabilityForCode(levelCode),
  }
}

export function App() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<string>(PROVIDERS.gemini.models[0] ?? 'gemini-3.5-flash')

  const [genMode, setGenMode] = useState<GenMode>('generate')
  const [topic, setTopic] = useState('')
  const [passage, setPassage] = useState('')
  const [level, setLevel] = useState<LevelValue>('elementary_5_6')
  const [genre, setGenre] = useState<Genre>('literature')
  const [style, setStyle] = useState('warm')
  const [vocab, setVocab] = useState('')

  const [ws, setWs] = useState<Worksheet | null>(null)
  const [branding, setBranding] = useState<Branding>({ academyName: '', logoDataUrl: null })
  const [langMode, setLangMode] = useState<LangMode>('both')
  const [meta, setMeta] = useState<DocMeta>(defaultMeta('문학', 'L3', { academyName: '', logoDataUrl: null }))
  const [image, setImage] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<PrintMode>('all')
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const [templateId, setTemplateId] = useState('standard')
  const [settings, setSettings] = useState<LayoutSettings>(() => settingsFrom(templateById('standard')))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Paged preview (paged.js) — true A4 pagination on screen so overflow flows
  // onto page 5, 6, … instead of one box growing past the sheet.
  const [previewPaged, setPreviewPaged] = useState(false)
  const [paging, setPaging] = useState(false)
  const [estPages, setEstPages] = useState(0) // auto-detected page count
  const sourceRef = useRef<HTMLDivElement>(null)
  const pagedRef = useRef<HTMLDivElement>(null)
  const countHostRef = useRef<HTMLDivElement>(null)

  const providerInfo = PROVIDERS[provider]
  const styles = STYLE_OPTIONS[genre]
  const noIllustration = NO_ILLUSTRATION.has(meta.levelCode)

  // Re-paginate whenever the preview is on and the worksheet/layout changes.
  useEffect(() => {
    if (!previewPaged || !ws) return
    const source = sourceRef.current
    const target = pagedRef.current
    if (!source || !target) return
    let cancelled = false
    setPaging(true)
    const html = source.innerHTML.replace(/contenteditable="true"/g, '')
    target.innerHTML = ''
    void (async () => {
      try {
        const { Previewer } = await import('pagedjs')
        if (cancelled) return
        const result = await new Previewer().preview(html, [], target)
        if (!cancelled) setEstPages(result?.total ?? 0)
      } catch {
        if (!cancelled) setError('페이지 미리보기 생성에 실패했습니다.')
      } finally {
        if (!cancelled) setPaging(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPaged, ws, meta, settings, langMode, image, noIllustration, printMode])

  // Auto-detect the real page count live while editing (background paged.js
  // measurement off-screen), so the count isn't perceived as capped at 4.
  useEffect(() => {
    if (!ws || previewPaged) return
    const source = sourceRef.current
    const host = countHostRef.current
    if (!source || !host) return
    let cancelled = false
    const timer = setTimeout(() => {
      const html = source.innerHTML.replace(/contenteditable="true"/g, '')
      host.innerHTML = ''
      void (async () => {
        try {
          const { Previewer } = await import('pagedjs')
          if (cancelled) return
          const result = await new Previewer().preview(html, [], host)
          if (!cancelled) setEstPages(result?.total ?? 0)
        } catch {
          /* measurement is best-effort */
        } finally {
          if (host) host.innerHTML = ''
        }
      })()
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, meta, settings, langMode, image, noIllustration, printMode, previewPaged])

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

  // Branding (academy name + logo) persists across sessions and worksheets.
  useEffect(() => {
    const loaded: Branding = {
      academyName: localStorage.getItem('academy_name') ?? '',
      logoDataUrl: localStorage.getItem('academy_logo'),
    }
    setBranding(loaded)
    setMeta((prev) => ({ ...prev, academyName: loaded.academyName, logoDataUrl: loaded.logoDataUrl, footer: prev.footer || loaded.academyName || 'Born English' }))
  }, [])

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

  function setAcademyName(name: string) {
    setBranding((b) => ({ ...b, academyName: name }))
    localStorage.setItem('academy_name', name)
    setMeta((prev) => ({ ...prev, academyName: name }))
  }

  function setLogo(dataUrl: string | null) {
    setBranding((b) => ({ ...b, logoDataUrl: dataUrl }))
    if (dataUrl) localStorage.setItem('academy_logo', dataUrl)
    else localStorage.removeItem('academy_logo')
    setMeta((prev) => ({ ...prev, logoDataUrl: dataUrl }))
  }

  function uploadLogo() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') setLogo(reader.result)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    setSettings(settingsFrom(templateById(id)))
  }

  function loadPreset(p: Preset) {
    setWs(structuredClone(p.worksheet))
    setMeta(defaultMeta(p.genre === 'nonfiction' ? '비문학' : '문학', p.levelCode, branding))
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
      setMeta(defaultMeta(genre === 'nonfiction' ? '비문학' : '문학', LEVELS[level].code, branding))
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

  function buildHwp() {
    if (!ws) return null
    return buildHwpHtml(
      ws,
      {
        genreLabel: meta.genreLabel,
        levelCode: meta.levelCode,
        footer: meta.footer,
        academyName: meta.academyName,
        logoDataUrl: meta.logoDataUrl,
        readability: meta.readability,
      },
      settings,
      printMode,
      langMode,
    )
  }

  async function copyHwp() {
    const html = buildHwp()
    if (!html) return
    try {
      const ok = await copyHtmlToClipboard(html)
      if (ok) setNotice('복사 완료. 한글에서 Ctrl+V. 코드로 보이면 골라 붙이기(Ctrl+Alt+V)→HTML, 또는 아래 “HWP 파일 저장” 사용.')
      else setError('이 브라우저에서 클립보드 복사를 지원하지 않습니다. “HWP 파일 저장”을 사용하세요.')
    } catch {
      setError('클립보드 접근 권한이 필요합니다. “HWP 파일 저장”을 사용하세요.')
    }
  }

  function downloadHwp() {
    const html = buildHwp()
    if (!html || !ws) return
    const name = `${ws.title.replace(/[^\w가-힣 -]/g, '').trim() || 'worksheet'}-${meta.levelCode}`
    downloadHtmlFile(html, name)
    setNotice('HTML 파일을 저장했어요. 한글에서 [파일 → 불러오기]로 그 파일을 열면 서식 그대로 들어갑니다.')
  }

  const docEl = ws ? (
    <WorksheetDoc
      worksheet={ws}
      meta={meta}
      image={image}
      noIllustration={noIllustration}
      langMode={langMode}
      onWorksheet={updateWorksheet}
      onMeta={updateMeta}
      onImage={setImage}
      onStructure={updateStructure}
      styleVars={styleVars}
    />
  ) : null

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <h1>WorksheetCraft</h1>
        <p className="tagline">초·중등 영어 독해 학습지 생성기 · BYOK</p>

        <div className="section">학원 브랜딩</div>
        <label>
          학원명
          <input value={branding.academyName} onChange={(e) => setAcademyName(e.target.value)} placeholder="예: 본잉글리시 학원" />
        </label>
        <div className="brand-row">
          <button type="button" className="secondary" onClick={uploadLogo}>로고 업로드</button>
          {branding.logoDataUrl && (
            <>
              <img className="brand-logo-preview" src={branding.logoDataUrl} alt="로고 미리보기" />
              <button type="button" className="link-btn danger" onClick={() => setLogo(null)}>제거</button>
            </>
          )}
        </div>

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
          언어 표시
          <select value={langMode} onChange={(e) => setLangMode(e.target.value as LangMode)}>
            <option value="both">영어 + 한국어 (해석 포함)</option>
            <option value="en">영어만 (해석 숨김)</option>
          </select>
        </label>
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
            <option value="all">학습지 + 답안지</option>
            <option value="student">학습지만</option>
            <option value="answers">답안지만</option>
          </select>
        </label>
        {ws && (
          <p className="field-nudge">📄 자동 감지: 전체 약 <b>{estPages || '…'}</b>페이지 — 내용이 늘면 페이지도 자동으로 늘어납니다(고정 4페이지 아님).</p>
        )}
        <button className="secondary" disabled={!ws} onClick={() => setPreviewPaged((v) => !v)}>
          {previewPaged ? '✎ 편집 모드로' : '⊞ 페이지 미리보기'}{estPages ? ` (${estPages}p)` : ''}
        </button>
        <p className="field-nudge">페이지 미리보기는 실제 A4 분할을 보여줘요 — 내용이 넘치면 다음 장으로 이어집니다.</p>
        <button className="secondary" disabled={!ws} onClick={() => window.print()}>인쇄 / PDF 저장</button>
        <button className="secondary" disabled={!ws} onClick={copyHwp}>HWP용 HTML 복사</button>
        <button className="secondary" disabled={!ws} onClick={downloadHwp}>HWP 파일 저장 (.html)</button>
        <p className="field-nudge">붙여넣기가 코드로 나오면 한글에서 <b>골라 붙이기(Ctrl+Alt+V) → HTML</b>, 또는 저장한 .html을 <b>[파일 → 불러오기]</b>로 여세요.</p>

        {error && <p className="error">⚠ {error}</p>}
        {notice && <p className="notice">✓ {notice}</p>}
      </aside>

      <main className={`canvas print-${printMode}`}>
        {!ws && (
          <div className="empty no-print">
            <p>왼쪽에서 샘플을 불러오거나, 키를 입력해 학습지를 생성하세요.</p>
          </div>
        )}
        {ws && !previewPaged && docEl}
        {ws && previewPaged && (
          <>
            {paging && <div className="empty no-print">페이지 분할 중…</div>}
            <div className="paged-host" ref={pagedRef} />
          </>
        )}
        {/* Always-present hidden source: feeds paged.js for both the preview and
            the live page-count auto-detection. */}
        {ws && (
          <div className="paged-source no-print" ref={sourceRef} aria-hidden="true">
            {docEl}
          </div>
        )}
        {ws && <div className="paged-count-host no-print" ref={countHostRef} aria-hidden="true" />}
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
