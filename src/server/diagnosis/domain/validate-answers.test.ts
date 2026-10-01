import { describe, expect, it } from 'vitest'
import { VALIDATORS } from '../../shared/domain/validation'
import { fieldProblem, stepProblems, validateAnswers } from './validate-answers'

describe('validateAnswers', () => {
  it('asks for every required field of step 1', () => {
    const problems = stepProblems({}, 1)
    for (const key of ['versaoFormulario', 'cnpj', 'nomeEmpresa', 'regimeAtual', 'ehSimei', 'solicitante', 'email', 'telefone', 'jaClienteAuster', 'segmento', 'aceiteLgpd']) {
      expect(problems[key]).toBe('Obrigatório')
    }
    expect(problems.expectativa).toBeUndefined()
  })

  it('uses the validator message for a malformed value', () => {
    expect(stepProblems({ cnpj: '11.111.111/1111-11' }, 1).cnpj).toBe(VALIDATORS.cnpj.error)
    expect(fieldProblem({ telefone: '(34) 1234' }, 'telefone')).toBe(VALIDATORS.phone.error)
    expect(fieldProblem({ telefone: '' }, 'telefone')).toBeNull()
    expect(fieldProblem({ segmento: 'comercio' }, 'segmento')).toBeNull()
  })

  it('requires every row of the customer matrix', () => {
    expect(stepProblems({ receitaPorCliente: { pessoa_fisica: 'zero' } }, 3).receitaPorCliente).toBe('Responda todas as linhas.')
  })

  it('joins the five steps', () => {
    const all = validateAnswers({})
    expect(all.versaoFormulario).toBe('Obrigatório')
    expect(all.receitaPorCliente).toBe('Responda todas as linhas.')
  })
})
