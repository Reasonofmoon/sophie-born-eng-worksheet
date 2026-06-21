interface Props {
  src: string | null
  onUpload: (dataUrl: string) => void
}

// P1 — Fix E/F: legacy referenced assets/*.png that didn't exist and fell back
// to an external Pollinations URL. Here the default is a self-contained inline
// SVG placeholder; teachers can click to upload their own image (read as a
// data URL, never sent anywhere).
export function Illustration({ src, onUpload }: Props) {
  function pickFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') onUpload(reader.result)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <button type="button" className="illustration" onClick={pickFile} title="클릭하여 삽화 업로드">
      {src ? (
        <img src={src} alt="삽화" />
      ) : (
        <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="1" y="1" width="198" height="148" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeDasharray="6 4" />
          <circle cx="62" cy="58" r="18" fill="none" stroke="#94a3b8" strokeWidth="3" />
          <path d="M30 120 L80 72 L110 100 L140 70 L172 120 Z" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinejoin="round" />
          <text x="100" y="140" textAnchor="middle" fontSize="11" fill="#94a3b8">클릭하여 삽화 추가</text>
        </svg>
      )}
    </button>
  )
}
