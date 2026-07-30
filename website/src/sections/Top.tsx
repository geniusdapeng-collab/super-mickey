import { useEffect, useRef, useState } from 'react'
import { type Lang, type Content } from '../i18n'
import type { ModalKind } from './Modal'

type OpenFn = (k: Exclude<ModalKind, null>) => void

export function Nav({ lang, setLang, t, onOpen }: { lang: Lang; setLang: (l: Lang) => void; t: Content; onOpen: OpenFn }) {
  const [open, setOpen] = useState(false)
  const go = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#E4EBD0] bg-[#FBFCF5]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl sm-btn-lime text-base font-black">S</span>
          <span className="text-lg font-black tracking-wide sm-ink">SuperMickey</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium sm-sub lg:flex">
          <button onClick={() => go('personas')} className="hover:text-[#5B8A00] transition-colors">{t.nav.personas}</button>
          <button onClick={() => go('wall')} className="hover:text-[#5B8A00] transition-colors">{t.nav.wall}</button>
          <button onClick={() => go('proof')} className="hover:text-[#5B8A00] transition-colors">{t.nav.proof}</button>
          <button onClick={() => go('agent')} className="hover:text-[#5B8A00] transition-colors">{t.nav.agent}</button>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="rounded-full border border-[#C9DB8E] px-3 py-1 text-xs font-bold text-[#5B8A00] hover:bg-[#EFF7D6] transition-colors">
            {lang === 'zh' ? 'EN' : '中'}
          </button>
          <button onClick={() => onOpen('mail')} className="hidden rounded-full sm-btn-lime px-4 py-1.5 text-sm sm:block">{t.nav.cta}</button>
          <button className="sm-ink lg:hidden" onClick={() => setOpen(!open)} aria-label="menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-[#E4EBD0] bg-[#FBFCF5] px-6 py-4 lg:hidden">
          {[['personas', t.nav.personas], ['wall', t.nav.wall], ['proof', t.nav.proof], ['agent', t.nav.agent]].map(([id, label]) => (
            <button key={id} onClick={() => go(id)} className="block w-full py-2 text-left font-medium sm-sub hover:text-[#5B8A00]">{label}</button>
          ))}
          <button onClick={() => { setOpen(false); onOpen('mail') }} className="mt-2 block w-full rounded-full sm-btn-lime px-4 py-2 text-center text-sm">{t.nav.cta}</button>
        </div>
      )}
    </header>
  )
}

function useTypingCycle(prompts: string[]) {
  const [pi, setPi] = useState(0)
  const [len, setLen] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'hold' | 'deleting'>('typing')
  useEffect(() => {
    const full = prompts[pi]
    let timer: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      if (len < full.length) timer = setTimeout(() => setLen(len + 1), 70)
      else timer = setTimeout(() => setPhase('hold'), 300)
    } else if (phase === 'hold') {
      timer = setTimeout(() => setPhase('deleting'), 2600)
    } else {
      if (len > 0) timer = setTimeout(() => setLen(len - 1), 22)
      else { setPi((pi + 1) % prompts.length); setPhase('typing') }
    }
    return () => clearTimeout(timer)
  }, [pi, len, phase, prompts])
  return prompts[pi].slice(0, len)
}

function usePipelineCycle(stepCount: number) {
  const [active, setActive] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (active < stepCount - 1) setActive(active + 1)
      else if (!done) setDone(true)
      else { setDone(false); setActive(0) }
    }, done ? 2600 : 850)
    return () => clearTimeout(timer)
  }, [active, done, stepCount])
  return { active, done }
}

export function Hero({ t, onOpen }: { t: Content; onOpen: OpenFn }) {
  const typed = useTypingCycle(t.hero.prompts)
  const { active, done } = usePipelineCycle(t.hero.pipeline.length)
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <img src="/images/hero-bg.jpg" alt="" className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FBFCF5]/40 via-[#FBFCF5]/70 to-[#FBFCF5]" />
      </div>
      <div className="relative mx-auto max-w-6xl text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full sm-chip px-4 py-1.5 text-xs sm:text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-[#8FC400] sm-pulse-dot" />
          {t.hero.badge}
        </div>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm-ink sm:text-6xl md:text-7xl">
          {t.hero.titleA}
          <br />
          <span className="sm-lime-text">{t.hero.titleB}</span>
        </h1>
        <p className="mx-auto mt-7 max-w-3xl text-base leading-relaxed sm-sub sm:text-lg">{t.hero.sub}</p>

        {/* magic box */}
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="rounded-2xl sm-card p-3 text-left shadow-lg">
            <div className="flex items-center gap-3 rounded-xl border border-[#E4EBD0] bg-[#FBFCF5] px-4 py-3.5">
              <span className="text-lg">✨</span>
              <span className="flex-1 truncate text-sm sm-ink sm:text-base">
                {typed}<span className="sm-caret text-[#7DA50F]">▍</span>
              </span>
              <span className="hidden rounded-full sm-btn-lime px-3 py-1 text-xs sm:block">⏎</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-1 px-1">
              {t.hero.pipeline.map((step, i) => {
                const lit = done || i <= active
                return (
                  <div key={step} className="flex flex-1 items-center gap-1">
                    <div className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg px-1 py-2 transition-all duration-500 ${lit ? 'bg-[#EFF7D6]' : ''}`}>
                      <span className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${lit ? 'bg-[#8FC400] shadow-[0_0_10px_rgba(143,196,0,0.8)]' : 'bg-[#DDE7C0]'}`} />
                      <span className={`whitespace-nowrap text-[9px] font-semibold sm:text-xs ${lit ? 'text-[#5B8A00]' : 'sm-muted'}`}>{step}</span>
                    </div>
                    {i < t.hero.pipeline.length - 1 && <span className={`h-px w-2 sm:w-4 ${i < active || done ? 'bg-[#8FC400]' : 'bg-[#DDE7C0]'} transition-colors duration-500`} />}
                  </div>
                )
              })}
            </div>
            <div className={`mt-2 overflow-hidden transition-all duration-500 ${done ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="flex items-center gap-3 rounded-xl border border-[#C2EE1B] bg-[#F4FBE0] px-4 py-3">
                <span className="text-xl">🎬</span>
                <span className="text-sm font-bold text-[#4a6b00]">{t.hero.resultTag}</span>
                <span className="ml-auto rounded-full bg-[#1A2408] px-2.5 py-1 text-[10px] font-bold text-[#D4F542]">9:16 · 60s</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button onClick={() => onOpen('mail')} className="w-full rounded-full sm-btn-lime px-8 py-3.5 text-base sm:w-auto">{t.hero.ctaPrimary}</button>
          <button onClick={() => onOpen('github')} className="flex w-full items-center justify-center gap-2 rounded-full sm-btn-ghost px-8 py-3.5 text-base sm:w-auto">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
            {t.hero.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  )
}

export function Compare({ t }: { t: Content }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)
  const move = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)))
  }
  useEffect(() => {
    const up = () => { dragging.current = false }
    const mm = (e: PointerEvent) => { if (dragging.current) move(e.clientX) }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointermove', mm)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointermove', mm) }
  }, [])
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-black sm-ink sm:text-4xl">{t.compare.title}</h2>
        <p className="mt-3 text-center text-sm sm-sub">{t.compare.sub}</p>
        <div ref={ref} className="relative mt-9 aspect-[16/10] select-none overflow-hidden rounded-3xl border border-[#E4EBD0] shadow-xl sm:aspect-[16/8]">
          <img src="/images/aurora-car.jpg" alt="after" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
            <img src="/images/aurora-car.jpg" alt="before" className="absolute inset-0 h-full w-full object-cover" style={{ width: ref.current?.clientWidth || '100%', maxWidth: 'none', filter: 'grayscale(0.5) blur(3px) saturate(0.5) contrast(0.85) brightness(1.1)' }} draggable={false} />
            <div className="absolute inset-0 bg-[#f0f0e8]/30" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)' }} />
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">{t.compare.before}</div>
          <div className="absolute right-3 top-3 rounded-full bg-[#D4F542]/90 px-3 py-1.5 text-xs font-bold text-[#1A2408]">{t.compare.after}</div>
          <div className="sm-compare-handle absolute inset-y-0 z-10" style={{ left: `calc(${pos}% - 18px)`, width: 36 }}
            onPointerDown={(e) => { dragging.current = true; move(e.clientX) }}>
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow" />
            <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-black text-[#1A2408] shadow-lg">⇔</div>
          </div>
        </div>
      </div>
    </section>
  )
}
