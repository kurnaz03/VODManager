import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface FullscreenModalProps {
  children: ReactNode
  onClose: () => void
}

export default function FullscreenModal({ children, onClose }: FullscreenModalProps) {
  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors shadow"
        title="Tam ekrandan çık (ESC)"
      >
        <X size={20} className="text-slate-600" />
      </button>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}
