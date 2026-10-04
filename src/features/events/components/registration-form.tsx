import { useHydrated } from '@tanstack/react-router'
import { JOB_TITLE_OPTIONS } from '@/server/events/domain/client-rules'
import type { EventView } from '@/server/events/domain/event'
import { REGISTRATION_LIMITS } from '../api/schemas'
import type { RegistrationField } from '@/server/events/domain/client-rules'
import { sessionOptionLabel } from '@/server/events/domain/event'
import { CNPJ_HINT, errorId, type RegistrationFormController } from '../hooks/use-registration-form'
import { openSessions, sessionState } from './session-state'

function FieldError({ form, field }: { form: RegistrationFormController; field: RegistrationField }) {
  return (
    <span className="erro" id={errorId(field)}>
      {form.errors[field] ?? ''}
    </span>
  )
}

export function RegistrationForm({ form, event }: { form: RegistrationFormController; event: EventView }) {
  const hydrated = useHydrated()
  return (
    <div className="cartao">
      <fieldset disabled={!hydrated || form.sending} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div className="campos">
          <div className="campo largo">
            <label htmlFor="cSessao">Qual encontro</label>
            <select
              id="cSessao"
              value={form.form.sessaoId === null ? '' : String(form.form.sessaoId)}
              onChange={(change) => form.set('sessaoId', change.target.value ? Number(change.target.value) : null)}
            >
              <option value="">Selecione…</option>
              {openSessions(event).map((session) => (
                <option key={session.id} value={String(session.id)}>
                  {sessionOptionLabel(session, sessionState(session).badge)}
                </option>
              ))}
            </select>
            <FieldError form={form} field="sessao" />
          </div>
          <div className="campo largo">
            <label htmlFor="cNome">Seu nome</label>
            <input id="cNome" type="text" autoComplete="name" maxLength={REGISTRATION_LIMITS.nome} value={form.form.nome} onChange={(change) => form.set('nome', change.target.value)} />
            <FieldError form={form} field="nome" />
          </div>
          <div className="campo">
            <label htmlFor="cEmail">E-mail</label>
            <input id="cEmail" type="email" autoComplete="email" maxLength={REGISTRATION_LIMITS.email} value={form.form.email} onChange={(change) => form.set('email', change.target.value)} />
            <FieldError form={form} field="email" />
          </div>
          <div className="campo">
            <label htmlFor="cTel">Telefone (WhatsApp)</label>
            <input id="cTel" type="text" inputMode="numeric" maxLength={REGISTRATION_LIMITS.telefone} value={form.form.telefone} onChange={(change) => form.set('telefone', change.target.value)} />
            <FieldError form={form} field="telefone" />
          </div>
          <div className="campo largo">
            <label htmlFor="cCnpj">
              CNPJ da empresa <span style={{ textTransform: 'none' }}>(opcional)</span>
            </label>
            <input
              id="cCnpj"
              className="curto"
              type="text"
              maxLength={REGISTRATION_LIMITS.cnpj}
              value={form.form.cnpj}
              onChange={(change) => form.set('cnpj', change.target.value)}
              onBlur={() => void form.blurCnpj()}
            />
            <div className="aviso-cnpj">{form.cnpjNotice || CNPJ_HINT}</div>
            <FieldError form={form} field="cnpj" />
          </div>
          <div className="campo">
            <label htmlFor="cEmpresa">Empresa</label>
            <input id="cEmpresa" type="text" autoComplete="organization" maxLength={REGISTRATION_LIMITS.empresa} value={form.form.empresa} onChange={(change) => form.set('empresa', change.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="cCargo">Seu cargo</label>
            <select id="cCargo" value={form.form.cargo} onChange={(change) => form.set('cargo', change.target.value)}>
              <option value="">Selecione…</option>
              {JOB_TITLE_OPTIONS.map((job) => (
                <option key={job} value={job}>
                  {job}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="marca">
          <input type="checkbox" checked={form.form.aceite} onChange={(change) => form.set('aceite', change.target.checked)} />
          <span>
            Concordo que a Auster use meus dados para organizar este evento e falar comigo sobre ele. Guardamos por 24 meses; para sair
            ou pedir exclusão, escreva para contato@austercontabil.com.br.
          </span>
        </label>
        <FieldError form={form} field="aceite" />
        <div>
          <button type="button" className="enviar" disabled={form.sending} onClick={() => void form.submit()}>
            {form.sending ? 'Inscrevendo…' : 'Confirmar inscrição'}
          </button>
        </div>
      </fieldset>
      <div className="erro-envio">{form.submitError}</div>
    </div>
  )
}
