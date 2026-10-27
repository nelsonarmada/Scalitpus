import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export default function Dialog({
  titleId,
  children,
  onClose,
  busy = false,
}: {
  titleId: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const current = useRef({ onClose, busy })
  current.current = { onClose, busy }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTarget =
      ref.current?.querySelector<HTMLElement>('input,select,textarea') ||
      ref.current?.querySelector<HTMLElement>('button')
    focusTarget?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !current.current.busy) current.current.onClose()
      if (e.key !== 'Tab') return
      const items = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea',
        ) || []),
      ]
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault()
        items.at(-1)?.focus()
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault()
        items[0]?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          className="modal-close icon-button"
          aria-label="Fechar janela"
          disabled={busy}
          onClick={onClose}
        >
          <X size={21} />
        </button>
        {children}
      </section>
    </div>
  )
}
