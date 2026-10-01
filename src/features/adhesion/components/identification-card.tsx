import { ROLE_OPTIONS } from '@/server/adhesion/domain/client-rules'
import type { AdhesionCompany } from '@/server/adhesion/domain/adhesion'
import type { ClientField } from '@/server/adhesion/domain/client-rules'
import { CNPJ_HINT, errorId, type AdhesionFormController } from '../hooks/use-adhesion-form'

function FieldError({ form, field }: { form: AdhesionFormController; field: ClientField }) {
  return (
    <span className="ad-error" id={errorId(field)}>
      {form.errors[field] ?? ''}
    </span>
  )
}

function TextField({
  form,
  field,
  id,
  label,
  wide = false,
  ...input
}: {
  form: AdhesionFormController
  field: keyof AdhesionCompany
  id: string
  label: string
  wide?: boolean
} & Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'autoComplete' | 'inputMode' | 'className' | 'onBlur'
>) {
  return (
    <div className={wide ? 'ad-field is-wide' : 'ad-field'}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={input.type ?? 'text'}
        value={form.form.empresa[field]}
        onChange={(event) => form.setCompany(field, event.target.value)}
        {...input}
      />
      <FieldError form={form} field={field} />
    </div>
  )
}

export function IdentificationCard({ form }: { form: AdhesionFormController }) {
  return (
    <div className="ad-card">
      <h2>Identificação da empresa</h2>
      <p className="ad-note ad-note-lead">
        Quem confirma precisa ser o representante legal da empresa, ou ter poderes para decidir por ela.
      </p>
      <div className="ad-fields">
        <div className="ad-field is-wide">
          <label htmlFor="adhesion-cnpj">CNPJ</label>
          <input
            id="adhesion-cnpj"
            className="is-short"
            type="text"
            value={form.form.empresa.cnpj}
            onChange={(event) => form.setCompany('cnpj', event.target.value)}
            onBlur={() => void form.blurCnpj()}
          />
          <FieldError form={form} field="cnpj" />
          <div className="ad-cnpj-notice">{form.cnpjNotice || CNPJ_HINT}</div>
        </div>
        <TextField
          form={form}
          field="nomeEmpresa"
          id="adhesion-company"
          label="Razão social"
          autoComplete="organization"
          wide
        />
        <TextField
          form={form}
          field="representante"
          id="adhesion-representative"
          label="Nome do representante legal"
          autoComplete="name"
        />
        <div className="ad-field">
          <label htmlFor="adhesion-role">Cargo de quem confirma</label>
          <select
            id="adhesion-role"
            value={form.form.empresa.cargo}
            onChange={(event) => form.setCompany('cargo', event.target.value)}
          >
            <option value="">Selecione…</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <FieldError form={form} field="cargo" />
        </div>
        <TextField
          form={form}
          field="cpf"
          id="adhesion-cpf"
          label="CPF do representante"
          inputMode="numeric"
          onBlur={form.blurCpf}
        />
        <TextField
          form={form}
          field="email"
          id="adhesion-email"
          label="E-mail"
          type="email"
          autoComplete="email"
        />
        <TextField form={form} field="telefone" id="adhesion-phone" label="Telefone" inputMode="numeric" />
      </div>
    </div>
  )
}
