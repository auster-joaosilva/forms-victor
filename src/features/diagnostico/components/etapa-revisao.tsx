import { Button } from '#/components/ui/button/button'

import { useNavegacaoEtapas } from '../hooks/use-navegacao-etapas'
import { useDiagnostico } from '../stores/diagnostico-store'
import { resumoContato, rotuloDe, rotulosDe } from '../utils/rotulos'

import estilos from './etapa-revisao.module.css'
import layout from './etapa.module.css'

import type { SlugEtapa } from '../config/etapas'
import type { DiagnosticoValores } from '../types'

type Secao = {
  titulo: string
  etapa: SlugEtapa
  itens: Array<{ rotulo: string; valor: string }>
}

/**
 * O resumo e MONTADO dos valores, com os rotulos vindos das mesmas listas de
 * opcoes dos campos. Escrever o resumo a mao era o que fazia a revisao mostrar
 * `parcelamento_rescindido` para o cliente ler.
 */
const montarSecoes = (v: DiagnosticoValores): Array<Secao> => [
  {
    titulo: 'Empresa e contribuinte',
    etapa: 'identificacao',
    itens: [
      { rotulo: 'E-mail', valor: v.email },
      { rotulo: 'Solicitante', valor: v.nomeSolicitante },
      { rotulo: 'Escritório parceiro', valor: v.escritorioParceiro },
      { rotulo: 'Contribuinte', valor: v.nomeContribuinte },
      { rotulo: 'CNPJ/CPF', valor: v.cnpjCpf },
    ],
  },
  {
    titulo: 'Contato',
    etapa: 'identificacao',
    itens: [
      v.possuiGrupoWhatsapp === 'sim'
        ? { rotulo: 'Grupo no WhatsApp', valor: v.nomeGrupoWhatsapp }
        : { rotulo: 'Telefone', valor: v.telefone },
      { rotulo: 'Contato do cliente', valor: resumoContato(v.contatoCliente) },
      { rotulo: 'Contato do parceiro', valor: resumoContato(v.contatoParceiro) },
      { rotulo: 'Tratativa', valor: rotuloDe(v.tratativa) },
    ],
  },
  {
    titulo: 'Procuração',
    etapa: 'procuracao',
    itens: [
      { rotulo: 'Procuração feita', valor: rotuloDe(v.procuracaoFeita) },
      ...(v.procuracaoFeita === 'nao'
        ? [{ rotulo: 'Forma de acesso', valor: rotuloDe(v.formaAcesso) }]
        : []),
    ],
  },
  {
    titulo: 'Diagnóstico solicitado',
    etapa: 'situacao',
    itens: [
      { rotulo: 'Faturamento mensal', valor: rotuloDe(v.faturamentoMensal) },
      { rotulo: 'Débitos concentrados', valor: rotulosDe(v.debitosConcentrados) },
      { rotulo: 'Valor do passivo', valor: rotuloDe(v.valorPassivo) },
    ],
  },
  {
    titulo: 'Pendências',
    etapa: 'pendencias',
    itens: [
      { rotulo: 'Possui pendência', valor: rotuloDe(v.pendenciaFiscal) },
      ...(v.pendenciaFiscal === 'sim'
        ? [{ rotulo: 'Quais', valor: rotulosDe(v.quaisPendencias) }]
        : []),
    ],
  },
  {
    titulo: 'Riscos fiscais',
    etapa: 'riscos',
    itens: [
      { rotulo: 'Risco imediato', valor: rotuloDe(v.riscoImediato) },
      ...(v.riscoImediato === 'sim'
        ? [{ rotulo: 'Quais', valor: rotulosDe(v.quaisRiscos) }]
        : []),
    ],
  },
  {
    titulo: 'Calor do cliente',
    etapa: 'calor',
    itens: [{ rotulo: 'Nível de interesse', valor: rotuloDe(v.ondaCalor) }],
  },
  {
    titulo: 'Anexos e informações adicionais',
    etapa: 'anexos',
    itens: [
      {
        rotulo: 'Situação Fiscal',
        valor: v.anexoSituacaoFiscal || 'Não anexado',
      },
      { rotulo: 'Relatório de CDAs', valor: v.anexoCDAs || 'Não anexado' },
      { rotulo: 'Observações', valor: v.informacoesAdicionais || 'Nenhuma' },
    ],
  },
]

export function EtapaRevisao() {
  const { valores } = useDiagnostico()
  const { ir } = useNavegacaoEtapas('revisao')

  return (
    <div className={layout.pilha}>
      <p className={layout.apoio}>
        Revise todas as informações antes de enviar. Clique em “Editar” para
        corrigir algum dado.
      </p>

      {montarSecoes(valores).map((secao) => (
        <section className={estilos.secao} key={secao.titulo}>
          <header className={estilos.cabecalho}>
            <h2 className={estilos.titulo}>{secao.titulo}</h2>
            <Button variante="sutil" onClick={() => ir(secao.etapa)}>
              Editar
            </Button>
          </header>
          <dl className={estilos.itens}>
            {secao.itens.map((item) => (
              <div className={estilos.item} key={item.rotulo}>
                <dt className={estilos.chave}>{item.rotulo}</dt>
                <dd className={estilos.valor}>{item.valor || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
