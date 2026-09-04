import assert from 'node:assert/strict'
import { test } from 'node:test'

import { valoresIniciais } from '../types'
import { errosDoParse, esquemaCompleto, esquemaDaEtapa } from './diagnostico.schema'

const identificacaoOk = () => ({
  ...valoresIniciais(),
  email: 'parceiro@escritorio.com.br',
  nomeSolicitante: 'Victor',
  escritorioParceiro: 'Escritório X',
  nomeContribuinte: 'Empresa Y',
  cnpjCpf: '12.345.678/0001-95',
  possuiGrupoWhatsapp: 'nao',
  telefone: '(34) 99655-6666',
  contatoCliente: {
    papel: 'socio',
    nome: 'Ana',
    telefone: '(34) 99655-6666',
    email: '',
  },
  tratativa: 'direto',
})

test('formulario vazio reprova a identificacao inteira', () => {
  const erros = errosDoParse(esquemaDaEtapa('identificacao'), valoresIniciais())
  assert.equal(erros.email, 'Obrigatório')
  assert.equal(erros.nomeSolicitante, 'Obrigatório')
  assert.equal(erros.cnpjCpf, 'Obrigatório')
  assert.equal(erros.tratativa, 'Obrigatório')
  assert.equal(
    erros.contatos,
    'Informe telefone ou e-mail de pelo menos um contato.',
  )
})

test('identificacao preenchida passa', () => {
  assert.deepEqual(errosDoParse(esquemaDaEtapa('identificacao'), identificacaoOk()), {})
})

test('etapa valida apenas as suas regras', () => {
  // O formulario vazio nao tem onda de calor, mas a etapa de calor nao pode
  // reclamar de e-mail.
  const erros = errosDoParse(esquemaDaEtapa('calor'), valoresIniciais())
  assert.deepEqual(Object.keys(erros), ['ondaCalor'])
})

test('pelo menos um contato: o lado do parceiro tambem serve', () => {
  const valores = {
    ...identificacaoOk(),
    contatoCliente: { papel: '', nome: '', telefone: '', email: '' },
    contatoParceiro: {
      papel: 'parceiro',
      nome: 'Bruno',
      telefone: '',
      email: 'bruno@escritorio.com.br',
    },
  }
  assert.equal(errosDoParse(esquemaDaEtapa('identificacao'), valores).contatos, undefined)
})

test('nome sozinho nao e contato — nao da para ligar para um nome', () => {
  const valores = {
    ...identificacaoOk(),
    contatoCliente: { papel: 'socio', nome: 'Ana', telefone: '', email: '' },
    contatoParceiro: { papel: '', nome: '', telefone: '', email: '' },
  }
  assert.equal(
    errosDoParse(esquemaDaEtapa('identificacao'), valores).contatos,
    'Informe telefone ou e-mail de pelo menos um contato.',
  )
})

test('grupo de WhatsApp exige o nome do grupo, nao o telefone', () => {
  const valores = {
    ...identificacaoOk(),
    possuiGrupoWhatsapp: 'sim',
    telefone: '',
    nomeGrupoWhatsapp: '',
  }
  const erros = errosDoParse(esquemaDaEtapa('identificacao'), valores)
  assert.equal(erros.nomeGrupoWhatsapp, 'Obrigatório')
  assert.equal(erros.telefone, undefined)
})

test('campo condicional so cobra quando a resposta anterior pede', () => {
  const semRisco = { ...valoresIniciais(), riscoImediato: 'nao' }
  assert.deepEqual(errosDoParse(esquemaDaEtapa('riscos'), semRisco), {})

  const comRisco = { ...valoresIniciais(), riscoImediato: 'sim' }
  assert.equal(
    errosDoParse(esquemaDaEtapa('riscos'), comRisco).quaisRiscos,
    'Selecione ao menos uma opção',
  )
})

test('procuracao feita nao cobra forma de acesso', () => {
  const feita = { ...valoresIniciais(), procuracaoFeita: 'sim' }
  assert.deepEqual(errosDoParse(esquemaDaEtapa('procuracao'), feita), {})

  const naoFeita = { ...valoresIniciais(), procuracaoFeita: 'nao' }
  assert.equal(
    errosDoParse(esquemaDaEtapa('procuracao'), naoFeita).formaAcesso,
    'Obrigatório',
  )
})

test('os dois anexos sao barreira de envio', () => {
  const erros = errosDoParse(esquemaDaEtapa('anexos'), valoresIniciais())
  assert.match(erros.anexoSituacaoFiscal ?? '', /Situação Fiscal/)
  assert.match(erros.anexoCDAs ?? '', /CDAs da PGFN/)
})

test('o esquema completo cobra tudo de uma vez — e a fronteira do servidor', () => {
  const erros = errosDoParse(esquemaCompleto, identificacaoOk())
  // Identificacao ok, mas o resto do formulario nao foi preenchido.
  assert.equal(erros.email, undefined)
  assert.equal(erros.procuracaoFeita, 'Obrigatório')
  assert.equal(erros.ondaCalor, 'Obrigatório')
  assert.equal(erros.faturamentoMensal, 'Obrigatório')
})
