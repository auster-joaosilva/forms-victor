import { TIME_ZONE } from '@/server/diagnosis/domain/dates'
import type { Resumable } from '../hooks/form-state'

function savedWhen(savedAt: string): string {
  const when = new Date(savedAt)
  if (Number.isNaN(when.getTime())) return ''
  const date = when.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })
  const time = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE })
  return ` de ${date} às ${time}`
}

export function ResumeBanner({ resumable, onResume, onStartOver }: { resumable: Resumable; onResume(): void; onStartOver(): void }) {
  const name = resumable.answers.nomeEmpresa
  return (
    <div className="dx-resume">
      <div>
        <b>
          Você tem um preenchimento começado{savedWhen(resumable.savedAt)}
          {typeof name === 'string' && name ? `, de ${name}` : ''}.
        </b>
        <span>Fica guardado só neste navegador — nada foi enviado.</span>
      </div>
      <div className="dx-resume-actions">
        <button type="button" className="dx-button is-primary" onClick={onResume}>
          Retomar
        </button>
        <button type="button" className="dx-button is-secondary" onClick={onStartOver}>
          Começar de novo
        </button>
      </div>
    </div>
  )
}
