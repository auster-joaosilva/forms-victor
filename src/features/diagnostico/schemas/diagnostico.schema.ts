import { z } from 'zod'

import { cpfCnpjValido } from '../utils/cpf-cnpj'
import { telefoneValido } from '../utils/telefone'

import type { ErrosDiagnostico, ChaveErro } from '../types'

/**
 * ZOD E FONTE UNICA.
 *
 * As mesmas regras validam a tela (etapa por etapa) e a entrada do
 * procedimento oRPC (tudo de uma vez). Duas validacoes divergem em silencio;
 * uma, nao.
 *
 * Os campos aceitam string vazia — o formulario nasce vazio e o rascunho
 * grava assim. Quem exige preenchimento sao as regras de etapa, porque
 * "obrigatorio" aqui depende de outra resposta em quase toda pergunta.
 */

const contato = z.object({
  papel: z.string(),
  nome: z.string(),
  telefone: z.string(),
  email: z.string(),
})

export const campos = z.object({
  email: z.string(),
  nomeSolicitante: z.string(),
  escritorioParceiro: z.string(),
  nomeContribuinte: z.string(),
  cnpjCpf: z.string(),
  telefone: z.string(),
  possuiGrupoWhatsapp: z.string(),
  nomeGrupoWhatsapp: z.string(),
  contatoCliente: contato,
  contatoParceiro: contato,
  tratativa: z.string(),
  procuracaoFeita: z.string(),
  formaAcesso: z.string(),
  faturamentoMensal: z.string(),
  debitosConcentrados: z.array(z.string()),
  valorPassivo: z.string(),
  pendenciaFiscal: z.string(),
  quaisPendencias: z.array(z.string()),
  riscoImediato: z.string(),
  quaisRiscos: z.array(z.string()),
  ondaCalor: z.string(),
  informacoesAdicionais: z.string(),
  anexoSituacaoFiscal: z.string(),
  anexoCDAs: z.string(),
})

export type CamposDiagnostico = z.infer<typeof campos>

type Contexto = z.RefinementCtx<CamposDiagnostico>
type Regra = (valores: CamposDiagnostico, ctx: Contexto) => void

const OBRIGATORIO = 'Obrigatório'

const exigir = (
  ctx: Contexto,
  campo: ChaveErro,
  preenchido: boolean,
  mensagem = OBRIGATORIO,
) => {
  if (preenchido) return
  ctx.addIssue({ code: 'custom', path: [campo], message: mensagem })
}

/** Tem como chamar esta pessoa? Nome sozinho nao serve. */
const contatoUtil = (c: { telefone: string; email: string }): boolean =>
  Boolean(c.telefone.trim() || c.email.trim())

const regrasIdentificacao: Regra = (v, ctx) => {
  exigir(ctx, 'email', Boolean(v.email.trim()))
  if (v.email.trim() && !/\S+@\S+\.\S+/.test(v.email)) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'E-mail inválido' })
  }

  exigir(ctx, 'nomeSolicitante', Boolean(v.nomeSolicitante.trim()))
  exigir(ctx, 'escritorioParceiro', Boolean(v.escritorioParceiro.trim()))
  exigir(ctx, 'nomeContribuinte', Boolean(v.nomeContribuinte.trim()))

  exigir(ctx, 'cnpjCpf', Boolean(v.cnpjCpf.trim()))
  if (v.cnpjCpf.trim() && !cpfCnpjValido(v.cnpjCpf)) {
    ctx.addIssue({
      code: 'custom',
      path: ['cnpjCpf'],
      message: 'Informe 11 dígitos (CPF) ou 14 (CNPJ)',
    })
  }

  // Grupo de WhatsApp OU telefone. Nunca os dois.
  exigir(ctx, 'possuiGrupoWhatsapp', Boolean(v.possuiGrupoWhatsapp))
  if (v.possuiGrupoWhatsapp === 'sim') {
    exigir(ctx, 'nomeGrupoWhatsapp', Boolean(v.nomeGrupoWhatsapp.trim()))
  }
  if (v.possuiGrupoWhatsapp === 'nao') {
    exigir(ctx, 'telefone', Boolean(v.telefone.trim()))
    if (v.telefone.trim() && !telefoneValido(v.telefone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['telefone'],
        message: 'Telefone incompleto',
      })
    }
  }

  // Pede-se os dois lados e exige-se um. Quem preenche costuma ser de um lado
  // so, e travar o envio por causa do outro afasta mais gente do que melhora
  // o cadastro.
  exigir(
    ctx,
    'contatos',
    contatoUtil(v.contatoCliente) || contatoUtil(v.contatoParceiro),
    'Informe telefone ou e-mail de pelo menos um contato.',
  )

  exigir(ctx, 'tratativa', Boolean(v.tratativa))
}

const regrasProcuracao: Regra = (v, ctx) => {
  exigir(ctx, 'procuracaoFeita', Boolean(v.procuracaoFeita))
  if (v.procuracaoFeita === 'nao') {
    exigir(ctx, 'formaAcesso', Boolean(v.formaAcesso))
  }
}

const regrasSituacao: Regra = (v, ctx) => {
  exigir(ctx, 'faturamentoMensal', Boolean(v.faturamentoMensal))
  exigir(
    ctx,
    'debitosConcentrados',
    v.debitosConcentrados.length > 0,
    'Selecione ao menos uma opção',
  )
  exigir(ctx, 'valorPassivo', Boolean(v.valorPassivo))
}

const regrasPendencias: Regra = (v, ctx) => {
  exigir(ctx, 'pendenciaFiscal', Boolean(v.pendenciaFiscal))
  if (v.pendenciaFiscal === 'sim') {
    exigir(
      ctx,
      'quaisPendencias',
      v.quaisPendencias.length > 0,
      'Selecione ao menos uma opção',
    )
  }
}

const regrasRiscos: Regra = (v, ctx) => {
  exigir(ctx, 'riscoImediato', Boolean(v.riscoImediato))
  if (v.riscoImediato === 'sim') {
    exigir(
      ctx,
      'quaisRiscos',
      v.quaisRiscos.length > 0,
      'Selecione ao menos uma opção',
    )
  }
}

const regrasCalor: Regra = (v, ctx) => {
  exigir(ctx, 'ondaCalor', Boolean(v.ondaCalor))
}

/**
 * Os dois anexos sao barreira de envio: sem Situacao Fiscal e sem Relatorio de
 * CDAs da PGFN nao se avanca. Aqui se checa o NOME registrado, que o campo de
 * arquivo preenche ao escolher.
 */
const regrasAnexos: Regra = (v, ctx) => {
  exigir(
    ctx,
    'anexoSituacaoFiscal',
    Boolean(v.anexoSituacaoFiscal),
    'O anexo da Situação Fiscal é obrigatório para prosseguir.',
  )
  exigir(
    ctx,
    'anexoCDAs',
    Boolean(v.anexoCDAs),
    'O anexo do Relatório de CDAs da PGFN é obrigatório para prosseguir.',
  )
}

const REGRAS: Record<string, Regra> = {
  identificacao: regrasIdentificacao,
  procuracao: regrasProcuracao,
  situacao: regrasSituacao,
  pendencias: regrasPendencias,
  riscos: regrasRiscos,
  calor: regrasCalor,
  anexos: regrasAnexos,
}

/** Uma etapa por vez, para a navegacao. */
export const esquemaDaEtapa = (slug: string) => {
  const regra = REGRAS[slug]
  return regra ? campos.superRefine(regra) : campos
}

/** Tudo de uma vez, para o `.input()` do procedimento oRPC. */
export const esquemaCompleto = campos.superRefine((valores, ctx) => {
  for (const regra of Object.values(REGRAS)) regra(valores, ctx)
})

/**
 * Erros do Zod no formato que a tela consome: uma mensagem por campo, a
 * primeira. Duas mensagens no mesmo campo ao mesmo tempo nao ajudam ninguem.
 */
export const errosDoParse = (
  esquema: z.ZodType<unknown, CamposDiagnostico>,
  valores: CamposDiagnostico,
): ErrosDiagnostico => {
  const resultado = esquema.safeParse(valores)
  if (resultado.success) return {}

  const erros: ErrosDiagnostico = {}
  for (const problema of resultado.error.issues) {
    const chave = problema.path[0] as ChaveErro | undefined
    if (chave && !erros[chave]) erros[chave] = problema.message
  }
  return erros
}
