import type { Content } from '../i18n'

export function Architecture({ t }: { t: Content }) {
  return (
    <section id="arch" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#7DA50F]">{t.arch.tag}</div>
        <h2 className="text-center text-3xl font-black sm-ink sm:text-4xl">{t.arch.title}</h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed sm-sub">{t.arch.sub}</p>

        <a href="/architecture.html" target="_blank" rel="noreferrer" className="mt-10 block overflow-hidden rounded-3xl sm-card sm-card-hover">
          <img src="/architecture.png" alt="SuperMickey System Architecture · Harness + Skill" className="block w-full" loading="lazy" />
        </a>

        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="text-xs sm-muted">{t.arch.note}</p>
          <a
            href="/architecture.png"
            download="SuperMickey系统架构拓扑图.png"
            className="rounded-full sm-btn-lime px-6 py-2.5 text-sm font-bold"
          >
            {t.arch.download} ↓
          </a>
        </div>
      </div>
    </section>
  )
}
