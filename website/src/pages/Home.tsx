import { useState } from 'react'
import { content, type Lang } from '../i18n'
import { Nav, Hero, Compare } from '../sections/Top'
import { Personas, Wall } from '../sections/PersonasWall'
import { ThreeSteps } from '../sections/ThreeSteps'
import { Proof } from '../sections/Proof'
import { AgentZone, SiteFooter } from '../sections/AgentZone'

export default function Home() {
  const [lang, setLang] = useState<Lang>('zh')
  const t = content[lang]

  return (
    <div className="sm-bg min-h-screen font-sans antialiased">
      <Nav lang={lang} setLang={setLang} t={t} />
      <main>
        <Hero t={t} />
        <Compare t={t} />
        <Personas t={t} />
        <ThreeSteps t={t} />
        <Wall t={t} />
        <Proof t={t} />
        <AgentZone t={t} />
      </main>
      <SiteFooter t={t} />
    </div>
  )
}
