import type { EventView } from '@/server/events/domain/event'

export function RegistrationClosed({ event }: { event: EventView }) {
  return (
    <section id="inscricao" className="rev">
      <span className="olho">inscrição</span>
      <h2>As inscrições estão encerradas</h2>
      <div className="regua" />
      <div className="encerrado">{event.content.aposEncerrar || 'Se quiser ser avisado do próximo encontro, fale com a Auster.'}</div>
    </section>
  )
}

export function RegistrationFull() {
  return (
    <section id="inscricao" className="rev">
      <span className="olho">inscrição</span>
      <h2>Todas as vagas foram preenchidas</h2>
      <div className="regua" />
      <div className="encerrado">Fale com a Auster para entrar na lista de espera.</div>
    </section>
  )
}
