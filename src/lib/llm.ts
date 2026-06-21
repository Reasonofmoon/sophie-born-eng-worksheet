import { buildPrompt, GEMINI_RESPONSE_SCHEMA, type GenerateParams } from './prompt'
import { worksheetSchema, type Worksheet } from './schema'

// P1 — multi-provider BYOK. Each provider is called directly from the browser
// with the user's own key (never proxied). Gemini/OpenAI allow browser CORS;
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
}

interface ErrorShape {
  error?: { message?: string }
}

async function callGemini({ apiKey, model, prompt, signal }: CallArgs): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
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

function parseWorksheet(raw: string): Worksheet {
  // Tolerate fenced/extra prose from providers without native JSON mode.
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
  let json: unknown
  try {
    json = JSON.parse(candidate)
  } catch {
    throw new LlmError('Model output was not valid JSON.')
  }
  const result = worksheetSchema.safeParse(json)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new LlmError(`Output failed validation: ${first?.path.join('.') || '(root)'} — ${first?.message}`)
  }
  return result.data
}

export interface GenerateOptions extends GenerateParams {
  provider: Provider
  apiKey: string
  model: string
  signal?: AbortSignal
  timeoutMs?: number
  maxRetries?: number
}

/**
 * Generate a fully-validated worksheet from the chosen provider. Always returns
 * a well-formed Worksheet or throws LlmError — never a half-shaped object.
 */
export async function generateWorksheet(opts: GenerateOptions): Promise<Worksheet> {
  if (!opts.apiKey.trim()) throw new LlmError('API key is required.')
  const caller = CALLERS[opts.provider]
  const prompt = buildPrompt(opts)
  const maxRetries = opts.maxRetries ?? 1
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout.signal]) : timeout.signal
    try {
      const raw = await caller({ apiKey: opts.apiKey.trim(), model: opts.model, prompt, signal })
      return parseWorksheet(raw)
    } catch (err) {
      lastError = err
      if (opts.signal?.aborted) throw new LlmError('Generation cancelled.')
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new LlmError('Generation failed after retries.')
}
