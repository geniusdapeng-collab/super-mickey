import { useState } from 'react'
import { content, type Lang } from '../i18n'
import { Nav, Hero, Compare } from '../sections/Top'
import { Personas, Wall } from '../sections/PersonasWall'
import { ThreeSteps } from '../sections/ThreeSteps'
import { Proof } from '../sections/Proof'
import { Architecture } from '../sections/Architecture'
import { AgentZone, SiteFooter } from '../sections/AgentZone'
import { InfoModal, type ModalKind } from '../sections/Modal'

export default function Home() {
  const [lang, setLang] = useState<Lang>('zh')
  const [modal, setModal] = useState<ModalKind>(null)
  const t = content[lang]
  const openModal = (k: Exclude<ModalKind, null>) => setModal(k)

  return (
    <div className="sm-bg min-h-screen font-sans antialiased">
      <Nav lang={lang} setLang={setLang} t={t} onOpen={openModal} />
      <main>
        <Hero t={t} onOpen={openModal} />
        <Compare t={t} />
        <Personas t={t} />
        <ThreeSteps t={t} />
        <Wall t={t} />
        <Proof t={t} />
        <Architecture t={t} />
        <AgentZone t={t} />
      </main>
      <SiteFooter t={t} onOpen={openModal} />
      <InfoModal kind={modal} onClose={() => setModal(null)} t={t} />
    </div>
  )
}
