import { Link } from '@tanstack/react-router'

import { Callout, Card } from '#/components/ui/card/card'
import { ROTAS_ETAPA } from '#/config/paths'

import { useSolicitacao } from '../api/obter-solicitacao'

import estilos from './comprovante.module.css'

const dataLegivel = (iso: Date | string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Tela de sucesso, por protocolo e nao por estado de memoria: um F5 aqui
 * costuma ser a pessoa querendo guardar o numero, e no monolito isso levava
 * de volta ao formulario vazio.
 */
export function Comprovante({ protocolo }: { protocolo: string }) {
  const { data, isPending, error } = useSolicitacao(protocolo)

  if (isPending) {
    return (
      <div className={estilos.area}>
        <Card>
          <p>Carregando comprovante…</p>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={estilos.area}>
        <Card>
          <Callout tom="erro">
            Não encontramos o protocolo <strong>{protocolo}</strong>. Confira o
            número ou envie a solicitação novamente.
          </Callout>
          <p className={estilos.rodape}>
            <Link className={estilos.link} to={ROTAS_ETAPA.identificacao}>
              Voltar ao formulário
            </Link>
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className={estilos.area}>
      <Card>
        <div className={estilos.miolo}>
          <span className={estilos.selo}>Solicitação enviada</span>

          <h1 className={estilos.titulo}>Recebemos seu diagnóstico</h1>

          <div className={estilos.protocolo}>
            <p className={estilos.chave}>Número do protocolo</p>
            <p className={estilos.numero}>{data.protocolo}</p>
          </div>

          <dl className={estilos.dados}>
            <div className={estilos.linha}>
              <dt className={estilos.chave}>Enviada em</dt>
              <dd className={estilos.valor}>{dataLegivel(data.criadoEm)}</dd>
            </div>
            <div className={estilos.linha}>
              <dt className={estilos.chave}>Previsão de retorno</dt>
              <dd className={estilos.valor}>
                {dataLegivel(data.retornoPrevistoEm)}{' '}
                <span className={estilos.observacao}>
                  ({data.slaHoras} horas úteis)
                </span>
              </dd>
            </div>
          </dl>

          <p className={estilos.texto}>
            A equipe de consultoria da Auster vai analisar a demanda e entrar em
            contato pelo canal informado. Guarde o número do protocolo — é por
            ele que se acompanha a solicitação.
          </p>

          <p className={estilos.rodape}>
            <Link className={estilos.link} to={ROTAS_ETAPA.identificacao}>
              Enviar nova solicitação
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
