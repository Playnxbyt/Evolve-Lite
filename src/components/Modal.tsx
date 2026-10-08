import { useEffect, type ReactNode } from 'react'

export default function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className="modal-scrim absolute inset-0 bg-black/55 backdrop-blur-sm" onMouseDown={onClose} />
      <div className="card modal-panel glass relative w-full max-w-md rounded-3xl p-5 shadow-2xl">
        {children}
      </div>
    </div>
  )
}
