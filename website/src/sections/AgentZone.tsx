import { useState } from 'react'
import { type Content } from '../i18n'

const INPUT_SCHEMA = `{
  "title": "雾岛气泡水 · 小红书种草",
  "narrative_mode": "commercial",
  "target_duration": 60,
  "target_platform": ["xiaohongshu", "douyin"]
}`

const OUTPUT_SCHEMA = `{
  "shot_id": "S01-SH03",
  "shot_size": "MCU", "camera_position": "low",
  "camera_movement": "dolly-in + arc",
  "light_tier": "B", "dialogue": "有些优雅…",
  "target_scores": { "readability": 92, "...": "…" }
}`

export function AgentZone({ t }: { t: Content }) {
  const [copied, setCopied] = useState(false)
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(t.agent.installCmd) } catch {
      const ta = document.createElement('textarea')
      ta.value = t.agent.installCmd
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <section id="agent" className="sm-dark px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#D4F542]">{t.agent.tag}</div>
        <h2 className="text-center text-3xl font-black text-white sm:text-4xl">{t.agent.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-white/60">{t.agent.sub}</p>

        {/* install card */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-[#D4F542]/30 bg-[#D4F542]/5 p-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-[#D4F542]">{t.agent.cardTitle}</h3>
            <span className="rounded-full bg-[#D4F542] px-3 py-1 text-[10px] font-black text-[#1A2408]">MIT · PUBLIC</span>
          </div>
          <p className="mt-3 text-sm text-white/60">{t.agent.cardHint}</p>
          <div className="mt-4 rounded-xl sm-code p-5">
            <p className="font-mono text-sm leading-relaxed text-[#D4F542]/90">{t.agent.installCmd}</p>
          </div>
          <button onClick={doCopy} className="mt-4 rounded-full sm-btn-lime px-6 py-2.5 text-sm">
            {copied ? t.agent.copied : t.agent.copy}
          </button>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* machine files */}
          <div className="rounded-2xl sm-dark-card p-7">
            <h3 className="text-base font-bold text-white">{t.agent.filesTitle}</h3>
            <div className="mt-5 space-y-4">
              {t.agent.files.map((f) => (
                <a key={f.name} href={f.href} target="_blank" rel="noreferrer"
                  className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-[#D4F542]/50">
                  <span className="rounded-lg bg-[#D4F542]/15 px-3 py-2 font-mono text-xs font-bold text-[#D4F542]">{f.name}</span>
                  <span className="text-sm leading-relaxed text-white/60">{f.desc}</span>
                </a>
              ))}
            </div>
            <h3 className="mt-8 text-base font-bold text-white">{t.agent.schemaTitle}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-bold text-white/50">{t.agent.inputLabel}</div>
                <pre className="overflow-x-auto rounded-xl sm-code p-4 font-mono text-[10px] leading-relaxed text-white/70">{INPUT_SCHEMA}</pre>
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-white/50">{t.agent.outputLabel}</div>
                <pre className="overflow-x-auto rounded-xl sm-code p-4 font-mono text-[10px] leading-relaxed text-[#D4F542]/80">{OUTPUT_SCHEMA}</pre>
              </div>
            </div>
          </div>

          {/* human quickstart + security */}
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl sm-dark-card p-7">
              <h3 className="text-base font-bold text-white">{t.agent.startTitle}</h3>
              <div className="mt-5 space-y-4">
                {t.agent.steps.map((s) => (
                  <div key={s.no} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4F542] text-sm font-black text-[#1A2408]">{s.no}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">{s.title}</div>
                      <pre className="mt-2 overflow-x-auto rounded-lg sm-code p-3 font-mono text-[10px] leading-relaxed text-white/70">{s.code}</pre>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/40">{t.agent.foot}</p>
            </div>
            <div className="rounded-2xl border border-[#D4F542]/30 bg-[#D4F542]/5 p-7">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#D4F542]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t.agent.securityTitle}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/70">{t.agent.security}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function SiteFooter({ t, onOpen }: { t: Content; onOpen: (k: 'mail' | 'github') => void }) {
  return (
    <footer className="px-4 pb-10 pt-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-[#C2EE1B] bg-gradient-to-br from-[#F4FBE0] to-[#E9F5C8] px-6 py-16 text-center sm:px-12">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[#D4F542]/40 blur-3xl" />
          <h2 className="relative text-3xl font-black sm-ink sm:text-4xl">
            {t.cta.titleA}<br /><span className="sm-lime-text">{t.cta.titleB}</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-sm leading-relaxed sm-sub sm:text-base">{t.cta.sub}</p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button onClick={() => onOpen('mail')} className="w-full rounded-full sm-btn-lime px-8 py-3.5 text-base sm:w-auto">{t.cta.mail}</button>
            <button onClick={() => onOpen('github')} className="flex w-full items-center justify-center gap-2 rounded-full sm-btn-ghost px-8 py-3.5 text-base sm:w-auto">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
              {t.cta.gh}
            </button>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#E4EBD0] pt-6 text-xs sm-muted sm:flex-row">
          <span className="font-black tracking-wide sm-ink">SuperMickey</span>
          <span>{t.cta.foot}</span>
        </div>
      </div>
    </footer>
  )
}
