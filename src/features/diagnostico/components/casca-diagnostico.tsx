import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Callout, Card } from '#/components/ui/card/card'
import { paths } from '#/config/paths'

import {
  ETAPA_REVISAO,
  indiceDaEtapa,
  rotuloDaEtapa,
  TOTAL_ETAPAS,
} from '../config/etapas'
import { useEnviarDiagnostico } from '../api/enviar-diagnostico'
import { useNavegacaoEtapas } from '../hooks/use-navegacao-etapas'
import { useDiagnostico } from '../stores/diagnostico-store'
import { BarraEtapas } from './barra-etapas'
import { NavegacaoEtapa } from './navegacao-etapa'

import estilos from './casca-diagnostico.module.css'

import type { ReactNode } from 'react'
import type { SlugEtapa } from '../config/etapas'

/**
 * A moldura de toda etapa: barra de etapas, titulo, indicador de rascunho,
 * cartao do formulario e os botoes.
 *
 * As rotas de etapa nao repetem nada disto — cada uma renderiza so o seu
 * formulario aqui dentro. E este e o unico arquivo que sabe que a sequencia
 * termina em envio.
 */
export function CascaDiagnostico({
  etapa,
  children,
}: {
  etapa: SlugEtapa
  children: ReactNode
}) {
  const navigate = useNavigate()
  const {
    valores,
    arquivos,
    rascunhoSalvo,
    primeiraEtapaInvalidaAntesDe,
    limpar,
  } = useDiagnostico()
  const { irPara, voltar, avancar } = useNavegacaoEtapas(etapa)
  const enviarDiagnostico = useEnviarDiagnostico()

  const [barrada, setBarrada] = useState<SlugEtapa | null>(null)

  const submeter = () => {
    if (etapa !== ETAPA_REVISAO) {
      avancar()
      return
    }

    // Ultima trava antes do envio: a revisao nao tem regra propria, entao
    // revalida-se tudo o que vem antes dela. `irPara` nao serve aqui — ja
    // estamos NA revisao, e ele devolve cedo quando destino e a etapa atual.
    const invalida = primeiraEtapaInvalidaAntesDe(ETAPA_REVISAO)
    if (invalida) {
      setBarrada(invalida)
      irPara(invalida)
      return
    }

    enviarDiagnostico.mutate(
      { valores, arquivos },
      {
        onSuccess: (solicitacao) => {
          limpar()
          void navigate({
            to: paths.diagnostico.enviado,
            params: { protocolo: solicitacao.protocolo },
          })
        },
        // Sem onError silencioso: o erro aparece na tela, abaixo, e os dados
        // ficam onde estao para a pessoa tentar de novo.
      },
    )
  }

  return (
    <div className={estilos.casca}>
      <BarraEtapas
        atual={etapa}
        onEscolher={(destino) => setBarrada(irPara(destino))}
      />

      <main className={estilos.conteudo}>
        <div className={estilos.miolo}>
          <header className={estilos.cabecalho}>
            <div>
              <h1 className={estilos.titulo}>{rotuloDaEtapa(etapa)}</h1>
              <p className={estilos.subtitulo} aria-live="polite">
                Etapa {indiceDaEtapa(etapa) + 1} de {TOTAL_ETAPAS} —{' '}
                {etapa === ETAPA_REVISAO
                  ? 'revise as informações antes de enviar'
                  : 'preencha os campos abaixo'}
              </p>
            </div>
            <span className={estilos.rascunho} data-visivel={rascunhoSalvo}>
              Rascunho salvo
            </span>
          </header>

          {barrada ? (
            <Callout tom="erro">
              Faltam campos obrigatórios em “{rotuloDaEtapa(barrada)}”.
            </Callout>
          ) : null}

          {enviarDiagnostico.isError ? (
            <Callout tom="erro">
              {enviarDiagnostico.error instanceof Error
                ? enviarDiagnostico.error.message
                : 'Não foi possível enviar sua solicitação. Seus dados foram mantidos; tente novamente.'}
            </Callout>
          ) : null}

          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              submeter()
            }}
            noValidate
          >
            <Card>
              {children}

              <NavegacaoEtapa
                etapa={etapa}
                enviando={enviarDiagnostico.isPending}
                onVoltar={voltar}
              />
            </Card>
          </form>
        </div>
      </main>
    </div>
  )
}
