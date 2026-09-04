import { useRef } from 'react'

import { Field } from '#/components/ui/field/field'
import { formatarTamanho } from '#/lib/arquivos'

import estilos from './file-input.module.css'

import type { FieldProps } from '#/components/ui/field/field'

type FileInputProps = Omit<FieldProps, 'children' | 'comLabel'> & {
  arquivos: ReadonlyArray<File>
  onChange: (arquivos: Array<File>) => void
  multiplo?: boolean
  accept?: string
}

/**
 * Escolha de arquivo com lista do que ja foi escolhido e remocao.
 *
 * Nao sobe nada — quem sobe e `features/diagnostico/api/upload-anexos`. Este
 * componente so segura `File`, porque um campo que sobe sozinho perde o
 * arquivo quando a etapa desmonta na troca de rota.
 */
export function FileInput({
  arquivos,
  onChange,
  multiplo = false,
  accept,
  ...campo
}: FileInputProps) {
  const entrada = useRef<HTMLInputElement>(null)

  const escolher = (lista: FileList | null) => {
    const escolhidos = lista ? Array.from(lista) : []
    if (escolhidos.length === 0) return
    onChange(multiplo ? [...arquivos, ...escolhidos] : escolhidos.slice(0, 1))
    // Limpa o input para que escolher o MESMO arquivo de novo dispare change.
    if (entrada.current) entrada.current.value = ''
  }

  const remover = (indice: number) => {
    onChange(arquivos.filter((_, i) => i !== indice))
  }

  return (
    <Field {...campo}>
      <div className={estilos.area}>
        <input
          className={estilos.oculto}
          ref={entrada}
          id={campo.nome}
          name={campo.nome}
          type="file"
          multiple={multiplo}
          accept={accept}
          onChange={(evento) => escolher(evento.target.files)}
        />
        <label className={estilos.gatilho} htmlFor={campo.nome}>
          {multiplo ? 'Escolher arquivos' : 'Escolher arquivo'}
        </label>

        {arquivos.length > 0 ? (
          <ul className={estilos.lista}>
            {arquivos.map((arquivo, indice) => (
              <li className={estilos.item} key={`${arquivo.name}-${indice}`}>
                <span className={estilos.nome}>{arquivo.name}</span>
                <span className={estilos.tamanho}>
                  {formatarTamanho(arquivo.size)}
                </span>
                <button
                  className={estilos.remover}
                  type="button"
                  onClick={() => remover(indice)}
                  aria-label={`Remover ${arquivo.name}`}
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={estilos.vazio}>Nenhum arquivo escolhido.</p>
        )}
      </div>
    </Field>
  )
}
