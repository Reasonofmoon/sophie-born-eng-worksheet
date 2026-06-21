import { useState } from 'react'

interface Props {
  providerLabel: string
  consoleUrl: string
  hasKey: boolean
  onClear: () => void
}

/**
 * Reassurance nudge next to the API key field. Keeps a calm one-liner visible,
 * with progressive disclosure ("어떻게 안전한가요?") instead of a wall of legal
 * text — the gentle-guidance / least-friction nudge pattern.
 */
export function PrivacyNudge({ providerLabel, consoleUrl, hasKey, onClear }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="privacy-nudge">
      <div className="privacy-line">
        <span>🔒 키는 이 브라우저에만 저장돼요.</span>
        <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '접기' : '어떻게 안전한가요?'}
        </button>
      </div>
      {open && (
        <ul className="privacy-detail">
          <li>키는 <b>localStorage</b>에만 보관 — 우리 서버로 전송되지 않습니다.</li>
          <li>요청은 브라우저에서 <b>{providerLabel}</b>로 직접 갑니다 (중개 서버 없음).</li>
          <li>입력한 주제·단어도 {providerLabel} 외 어디에도 저장되지 않습니다.</li>
          <li>
            키는 <a href={consoleUrl} target="_blank" rel="noreferrer">콘솔</a>에서 언제든 회수할 수 있어요.
          </li>
          <li>
            전문은{' '}
            <a href="https://github.com/Reasonofmoon/sophie-born-eng-worksheet/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">
              개인정보 처리방침
            </a>{' '}
            참고.
          </li>
        </ul>
      )}
      {hasKey && (
        <button type="button" className="link-btn danger" onClick={onClear}>
          이 브라우저에서 키 지우기
        </button>
      )}
    </div>
  )
}
