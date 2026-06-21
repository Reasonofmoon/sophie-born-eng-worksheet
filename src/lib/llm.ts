import {
  BYOT_RESPONSE_SCHEMA,
  buildPassagePrompt,
  buildPrompt,
  GEMINI_RESPONSE_SCHEMA,
  splitPassage,
  type GenerateParams,
} from './prompt'
import { assembleWorksheet, byotOutputSchema, worksheetSchema, type Worksheet } from './schema'
import type { Genre, LevelValue } from './levels'

// Multi-provider BYOK. Each provider is called directly from the browser with
// the user's own key (never proxied). Gemini/OpenAI allow browser CORS;
// Anthropic requires the explicit dangerous-direct-browser-access opt-in.

export type Provider = 'gemini' | 'openai' | 'anthropic'

export interface ProviderInfo {
  id: Provider
  label: string
  keyHint: string
  consoleUrl: string
  models: readonly string[]
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    keyHint: 'AIza…',
    consoleUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'sk-…',
    consoleUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyHint: 'sk-ant-…',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as Provider[]

const DEFAULT_TIMEOUT_MS = 60_000
const MAX_TOKENS = 8192

export class LlmError extends Error {}

interface CallArgs {
  apiKey: string
  model: string
  prompt: string
  signal: AbortSignal
  /** Gemini structured-output schema (ignored by other providers). */
  geminiSchema: object
}

interface ErrorShape {
  error?: { message?: string }
}

async function callGemini({ apiKey, model, prompt, signal, geminiSchema }: CallArgs): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        temperature: 0.8,
      },
    }),
    signal,
  })
  const data = (await res.json().catch(() => ({}))) as ErrorShape & {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  if (!res.ok) throw new LlmError(data.error?.message ?? `Gemini failed (HTTP ${res.status})`)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new LlmError('Gemini returned an empty response.')
  return text
}

async function callOpenAI({ apiKey, model, prompt, signal }: CallArgs): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
    signal,
  })
  const data = (await res.json().catch(() => ({}))) as ErrorShape & {
    choices?: Array<{ message?: { content?: string } }>
  }
  if (!res.ok) throw new LlmError(data.error?.message ?? `OpenAI failed (HTTP ${res.status})`)
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new LlmError('OpenAI returned an empty response.')
  return text
}

async function callAnthropic({ apiKey, model, prompt, signal }: CallArgs): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: `${prompt}\n\nReturn only the JSON object, with no surrounding prose.` }],
    }),
    signal,
  })
  const data = (await res.json().catch(() => ({}))) as ErrorShape & {
    content?: Array<{ type?: string; text?: string }>
  }
  if (!res.ok) throw new LlmError(data.error?.message ?? `Anthropic failed (HTTP ${res.status})`)
  const text = data.content?.find((b) => b.type === 'text')?.text
  if (!text) throw new LlmError('Anthropic returned an empty response.')
  return text
}

const CALLERS: Record<Provider, (args: CallArgs) => Promise<string>> = {
  gemini: callGemini,
  openai: callOpenAI,
  anthropic: callAnthropic,
}

/** Extract the first balanced JSON object, tolerating fences/prose. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    throw new LlmError('Model output was not valid JSON.')
  }
}

interface RunOptions {
  provider: Provider
  apiKey: string
  model: string
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
}

/** Generic call-with-retry. parse() throws LlmError on invalid output. */
async function run<T>(opts: RunOptions, prompt: string, geminiSchema: object, parse: (raw: string) => T): Promise<T> {
  if (!opts.apiKey.trim()) throw new LlmError('API key is required.')
  const caller = CALLERS[opts.provider]
  const maxRetries = opts.maxRetries ?? 1
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout.signal]) : timeout.signal
    try {
      const raw = await caller({ apiKey: opts.apiKey.trim(), model: opts.model, prompt, signal, geminiSchema })
      return parse(raw)
    } catch (err) {
      lastError = err
      if (opts.signal?.aborted) throw new LlmError('Generation cancelled.')
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new LlmError('Generation failed after retries.')
}

function parseWorksheet(raw: string): Worksheet {
  const result = worksheetSchema.safeParse(extractJson(raw))
  if (!result.success) {
    const first = result.error.issues[0]
    throw new LlmError(`Output failed validation: ${first?.path.join('.') || '(root)'} — ${first?.message}`)
  }
  return result.data
}

export interface GenerateOptions extends GenerateParams, RunOptions {}

/** Full generation: the model writes the passage and everything else. */
export function generateWorksheet(opts: GenerateOptions): Promise<Worksheet> {
  return run(opts, buildPrompt(opts), GEMINI_RESPONSE_SCHEMA, parseWorksheet)
}

export interface PassageOptions extends RunOptions {
  passage: string
  level: LevelValue
  genre: Genre
}

/**
 * BYOT generation: use the teacher's passage verbatim and only generate the
 * translation, questions, key sentences and vocabulary. Saves output tokens by
 * not regenerating/echoing the English passage.
 */
export function generateFromPassage(opts: PassageOptions): Promise<Worksheet> {
  const paragraphs = splitPassage(opts.passage)
  if (paragraphs.length === 0) throw new LlmError('붙여넣은 본문이 비어 있습니다.')

  const prompt = buildPassagePrompt({ paragraphs, level: opts.level, genre: opts.genre })
  return run(opts, prompt, BYOT_RESPONSE_SCHEMA, (raw) => {
    const out = byotOutputSchema.safeParse(extractJson(raw))
    if (!out.success) {
      const first = out.error.issues[0]
      throw new LlmError(`Output failed validation: ${first?.path.join('.') || '(root)'} — ${first?.message}`)
    }
    const merged = assembleWorksheet(paragraphs, out.data)
    const full = worksheetSchema.safeParse(merged)
    if (!full.success) {
      const first = full.error.issues[0]
      throw new LlmError(`본문 단락 수와 번역 수가 맞지 않습니다: ${first?.message}`)
    }
    return full.data
  })
}
