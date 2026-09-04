import { Field } from '#/components/ui/field/field'

import estilos from './choice-group.module.css'

import type { FieldProps } from '#/components/ui/field/field'
import type { Opcao } from '#/components/ui/types'

type Base = Omit<FieldProps, 'children' | 'comLabel'> & {
  opcoes: ReadonlyArray<Opcao>
}

/**
 * Radio e checkbox no mesmo componente.
 *
 * Sao o mesmo cartao clicavel, mudando o `type` e a semantica do valor —
 * separar em dois daria duas copias da mesma folha de estilo, e a que
 * ninguem lembrasse de atualizar ficaria diferente.
 */
type ChoiceGroupProps =
  | (Base & { multiplo?: false; valor: string; onChange: (valor: string) => void })
  | (Base & {
      multiplo: true
      valor: ReadonlyArray<string>
      onChange: (valor: Array<string>) => void
    })

export function ChoiceGroup(props: ChoiceGroupProps) {
  const { opcoes, multiplo, valor, onChange, ...campo } = props

  const marcado = (opcao: string) =>
    multiplo ? valor.includes(opcao) : valor === opcao

  const alternar = (opcao: string) => {
    if (multiplo) {
      onChange(
        valor.includes(opcao)
          ? valor.filter((item) => item !== opcao)
          : [...valor, opcao],
      )
      return
    }
    onChange(opcao)
  }

  return (
    <Field {...campo} comLabel={false}>
      <div className={estilos.grupo} role="group" aria-label={campo.rotulo}>
        {opcoes.map((opcao) => (
          <label
            className={estilos.opcao}
            key={opcao.valor}
            data-marcado={marcado(opcao.valor)}
          >
            <input
              className={estilos.entrada}
              type={multiplo ? 'checkbox' : 'radio'}
              name={campo.nome}
              value={opcao.valor}
              checked={marcado(opcao.valor)}
              onChange={() => alternar(opcao.valor)}
            />
            <span className={estilos.texto}>
              <span className={estilos.titulo}>{opcao.rotulo}</span>
              {opcao.descricao ? (
                <span className={estilos.apoio}>{opcao.descricao}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </Field>
  )
}
