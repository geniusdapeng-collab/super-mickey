import { useEffect, useState } from 'react'
import { LINKS, type Content } from '../i18n'

export type ModalKind = 'mail' | 'github' | null

function CopyBtn({ text, t }: { text: string; t: Content }) {
  const [copied, setCopied] = useState(false)
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={doCopy} className="shrink-0 rounded-full sm-btn-lime px-5 py-2.5 text-sm">
      {copied ? t.modal.copied : t.modal.copy}
    </button>
  )
}

export function InfoModal({ kind, onClose, t }: { kind: ModalKind; onClose: () => void; t: Content }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  if (!kind) return null
  const isMail = kind === 'mail'
  const value = isMail ? LINKS.email : LINKS.github
  const title = isMail ? t.modal.mailTitle : t.modal.ghTitle
  const desc = isMail ? t.modal.mailDesc : t.modal.ghDesc
  const icon = isMail ? '📮' : '🐙'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF7D6] text-2xl">{icon}</span>
          <button onClick={onClose} aria-label={t.modal.close} className="rounded-full p-2 sm-muted hover:bg-[#F1F6E3]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <h3 className="mt-5 text-xl font-black sm-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed sm-sub">{desc}</p>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#C9DB8E] bg-[#F8FCEC] px-4 py-3">
          <span className="min-w-0 flex-1 select-all break-all font-mono text-sm font-bold text-[#3d5a00]">{value}</span>
          <CopyBtn text={value} t={t} />
        </div>
        <a
          href={isMail ? LINKS.mailto : LINKS.github}
          target={isMail ? undefined : '_blank'}
          rel="noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full sm-btn-ghost px-6 py-3 text-sm"
        >
          {isMail ? t.modal.openMail : t.modal.openGh}
        </a>
      </div>
    </div>
  )
}
