import { useEffect, useRef, useState } from 'react'
import type { Content } from '../i18n'

function CountUp({ target, suffix, started }: { target: number; suffix: string; started: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!started) return
    const t0 = performance.now()
    const dur = 1400
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, target])
  return <span>{n.toLocaleString()}{suffix}</span>
}

export function Proof({ t }: { t: Content }) {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true) }, { threshold: 0.3 })
    if (ref.current) ob.observe(ref.current)
    return () => ob.disconnect()
  }, [])
  return (
    <section id="proof" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#7DA50F]">{t.proof.tag}</div>
        <h2 className="text-center text-3xl font-black sm-ink sm:text-4xl">{t.proof.title}</h2>
        <p className="mt-4 text-center text-sm sm-sub">{t.proof.sub}</p>

        <div ref={ref} className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {t.proof.numbers.map((s) => (
            <div key={s.v} className="rounded-2xl sm-card p-6 text-center">
              <div className="text-3xl font-black sm-lime-text sm:text-4xl"><CountUp target={s.k} suffix={s.suffix} started={started} /></div>
              <div className="mt-2 text-xs leading-snug sm-sub">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {t.proof.bullets.map(([h, d]) => (
            <div key={h} className="rounded-2xl sm-card sm-card-hover p-6">
              <h3 className="text-base font-bold sm-ink">{h}</h3>
              <p className="mt-2 text-sm leading-relaxed sm-sub">{d}</p>
            </div>
          ))}
        </div>

        {/* shot card under microscope */}
        <div className="mt-12">
          <h3 className="text-center text-xl font-black sm-ink sm:text-2xl">{t.proof.demoTitle}</h3>
          <p className="mt-2 text-center text-xs sm-muted">{t.proof.demoNote}</p>
          <div className="mt-8 grid gap-5 lg:grid-cols-5">
            <div className="rounded-2xl sm-card p-7 lg:col-span-3">
              <dl className="divide-y divide-[#EFF3E0]">
                {t.proof.cardMeta.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-3 gap-3 py-2.5 sm:grid-cols-4">
                    <dt className="text-xs sm-muted">{k}</dt>
                    <dd className="col-span-2 text-sm sm-ink sm:col-span-3">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col gap-5 lg:col-span-2">
              <div className="rounded-2xl sm-card p-7">
                <h4 className="mb-5 text-sm font-bold sm-ink">{t.proof.scoreTitle}</h4>
                <div className="space-y-4">
                  {t.proof.scores.map(([name, val, w]) => (
                    <div key={name as string}>
                      <div className="mb-1.5 flex items-baseline justify-between text-xs">
                        <span className="sm-sub">{name} <span className="sm-muted">· {w}</span></span>
                        <span className="font-black text-[#5B8A00]">{val}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#EFF3E0]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#C2EE1B] to-[#8FC400]" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-lg border border-[#C2EE1B] bg-[#F4FBE0] px-3 py-2 text-center text-xs font-bold text-[#4a6b00]">{t.proof.scoreTotal}</div>
              </div>
              <div className="flex-1 rounded-2xl sm-code p-6">
                <h4 className="mb-3 text-xs font-bold text-white/50">{t.proof.promptTitle}</h4>
                <p className="font-mono text-[11px] leading-relaxed text-[#D4F542]/80">{t.proof.prompt}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
