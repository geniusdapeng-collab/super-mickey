import { LINKS, type Content } from '../i18n'

export function ThreeSteps({ t }: { t: Content }) {
  const [s1, s2, s3] = t.three.steps
  return (
    <section id="three" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#7DA50F]">{t.three.tag}</div>
        <h2 className="text-center text-3xl font-black sm-ink sm:text-4xl">{t.three.title}</h2>
        <p className="mt-4 text-center text-sm sm-sub">{t.three.sub}</p>

        <div className="relative mt-14 grid gap-10 lg:grid-cols-3 lg:gap-6">
          {/* connector line (desktop) */}
          <div className="absolute left-0 right-0 top-7 hidden border-t-2 border-dashed border-[#C9DB8E] lg:block" style={{ margin: '0 11%' }} />

          {/* Step 1 */}
          <div className="relative flex flex-col rounded-3xl sm-card sm-card-hover p-8">
            <span className="relative z-10 -mt-14 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl sm-btn-lime text-2xl font-black shadow-lg">{s1.no}</span>
            <h3 className="text-xl font-black sm-ink">{s1.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed sm-sub">{s1.desc}</p>
            <a href={LINKS.skillDownload} download className="mt-5 flex items-center justify-center gap-2 rounded-full sm-btn-lime px-6 py-3 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>
              {s1.action} · supermickey-studio.skill
            </a>
            <p className="mt-3 text-center text-[11px] leading-relaxed sm-muted">{s1.note}</p>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col rounded-3xl sm-card sm-card-hover p-8">
            <span className="relative z-10 -mt-14 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl sm-btn-lime text-2xl font-black shadow-lg">{s2.no}</span>
            <h3 className="text-xl font-black sm-ink">{s2.title}</h3>
            <p className="mt-3 text-sm leading-relaxed sm-sub">{s2.desc}</p>
            <div className="mt-5 flex-1">
              <div className="rounded-2xl rounded-bl-md border border-[#C9DB8E] bg-[#F8FCEC] px-4 py-3 text-sm font-medium sm-ink">
                {s2.input}
              </div>
              <div className="my-2 flex justify-center text-[#8FC400]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m0 0l-5-5m5 5l5-5"/></svg>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {(s2.outputs ?? []).map((o) => (
                  <span key={o} className="rounded-full bg-[#1A2408] px-3 py-1.5 text-xs font-bold text-[#D4F542]">{o}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col rounded-3xl sm-card sm-card-hover p-8">
            <span className="relative z-10 -mt-14 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl sm-btn-lime text-2xl font-black shadow-lg">{s3.no}</span>
            <h3 className="text-xl font-black sm-ink">{s3.title}</h3>
            <p className="mt-3 text-sm leading-relaxed sm-sub">{s3.desc}</p>
            <div className="mt-5 flex flex-1 flex-col justify-end">
              <div className="flex flex-wrap gap-2">
                {(s3.tools ?? []).map((tool) => (
                  <span key={tool} className="rounded-full sm-chip px-3.5 py-1.5 text-xs">{tool}</span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#C2EE1B] bg-[#F4FBE0] px-4 py-3">
                <span className="text-lg">🎬</span>
                <span className="text-sm font-black text-[#4a6b00]">FINAL CUT · 成片 ✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* full-auto note */}
        <div className="mt-10 rounded-2xl border border-[#C9DB8E] bg-[#F8FCEC] p-6 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
            <span className="shrink-0 rounded-full sm-btn-lime px-4 py-1.5 text-xs font-black">{t.three.noteTitle}</span>
            <p className="text-sm leading-relaxed sm-sub">{t.three.note}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
