import { useState } from 'react'
import type { Content } from '../i18n'

export function Personas({ t }: { t: Content }) {
  const [idx, setIdx] = useState(0)
  const p = t.personas.items[idx]
  return (
    <section id="personas" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#7DA50F]">{t.personas.tag}</div>
        <h2 className="text-center text-3xl font-black sm-ink sm:text-4xl">{t.personas.title}</h2>
        <p className="mt-4 text-center text-sm sm-sub">{t.personas.sub}</p>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {t.personas.items.map((it, i) => (
            <button key={it.tab} onClick={() => setIdx(i)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${i === idx ? 'sm-btn-lime' : 'border border-[#C9DB8E] bg-white sm-sub hover:bg-[#EFF7D6]'}`}>
              {it.tab}
            </button>
          ))}
        </div>

        <div key={idx} className="mt-8 grid gap-6 rounded-3xl sm-card p-6 sm:p-10 lg:grid-cols-5 sm-pop">
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl">
              <img src={`/images/${p.img}`} alt={p.name} className="aspect-[2/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#D4F542]">{t.personas.labels.case}</div>
                <div className="mt-1 text-lg font-black text-white">{p.name}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#E4EBD0] bg-[#FBFCF5] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest sm-muted">Before</div>
                <div className="mt-1.5 text-sm font-bold leading-snug sm-ink">{p.before}</div>
              </div>
              <div className="rounded-xl border border-[#C2EE1B] bg-[#F4FBE0] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#7DA50F]">After</div>
                <div className="mt-1.5 text-sm font-black leading-snug text-[#4a6b00]">{p.after}</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#7DA50F]">{t.personas.labels.scene}</div>
              <p className="mt-2 text-base font-semibold leading-relaxed sm-ink">{p.scene}</p>
            </div>
            <div className="mt-6">
              <div className="text-xs font-bold uppercase tracking-widest text-[#c0564a]">{t.personas.labels.pain}</div>
              <ul className="mt-2 space-y-2">
                {p.pains.map((x) => (
                  <li key={x} className="flex items-start gap-2 text-sm sm-sub">
                    <span className="mt-0.5 text-[#c0564a]">✗</span>{x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 rounded-xl border-l-4 border-[#C2EE1B] bg-[#F8FCEC] p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[#7DA50F]">{t.personas.labels.case}</div>
              <p className="mt-2 text-sm font-medium leading-relaxed sm-ink">{p.caseDesc}</p>
            </div>
            <div className="mt-6">
              <div className="text-xs font-bold uppercase tracking-widest text-[#7DA50F]">{t.personas.labels.how}</div>
              <ul className="mt-2 space-y-2.5">
                {p.how.map((x, i) => (
                  <li key={x} className="flex items-start gap-3 text-sm sm-sub">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4F542] text-[10px] font-black text-[#1A2408]">{i + 1}</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Wall({ t }: { t: Content }) {
  return (
    <section id="wall" className="sm-dark px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#D4F542]">{t.wall.tag}</div>
        <h2 className="text-center text-3xl font-black text-white sm:text-4xl">{t.wall.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-white/60">{t.wall.sub}</p>
        <div className="mt-12 columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
          {t.wall.tiles.map((tile) => (
            <div key={tile.label} className="group relative break-inside-avoid overflow-hidden rounded-2xl sm-dark-card">
              <img src={`/images/${tile.img}`} alt={tile.label} loading="lazy" className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="rounded-full bg-[#D4F542]/90 px-2.5 py-0.5 text-[10px] font-bold text-[#1A2408]">{tile.tag}</span>
                <div className="mt-1.5 text-sm font-bold text-white">{tile.label}</div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D4F542] text-xl text-[#1A2408] shadow-[0_0_30px_rgba(212,245,66,0.6)]">▶</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
