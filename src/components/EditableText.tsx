import { useEffect, useRef, type ElementType, type FocusEvent, type Ref } from 'react'

type Tag = 'div' | 'span' | 'p' | 'h2' | 'h3'

interface Props {
  value: string
  onChange: (next: string) => void
  as?: Tag
  className?: string
}

/**
 * contentEditable text bound to a single source of truth. Because every page
 * renders from the same worksheet state, editing the title on one page updates
 * all pages (P1 — replaces the legacy manual data-sync DOM mirroring). The DOM
 * is only rewritten when the external value diverges AND the node isn't focused,
 * which prevents caret jumps mid-typing.
 */
export function EditableText({ value, onChange, as = 'div', className }: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.textContent !== value) {
      el.textContent = value
    }
  }, [value])

  // ElementType keeps props loosely typed so the same handler works across the
  // tag union without colliding with SVG/HTML focus-event signatures.
  const Tag = as as ElementType
  return (
    <Tag
      ref={ref as Ref<HTMLElement>}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e: FocusEvent<HTMLElement>) => {
        const next = e.currentTarget.textContent ?? ''
        if (next !== value) onChange(next)
      }}
    >
      {value}
    </Tag>
  )
}
