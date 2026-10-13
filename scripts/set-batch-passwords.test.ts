import { describe, expect, it } from 'vitest'
import { planBatchPasswords } from './set-batch-passwords'

describe('planBatchPasswords', () => {
  it('builds FirstName+suffix for every active, non-e2e user', () => {
    const plan = planBatchPasswords(
      [
        { username: 'sara.vinhais', active: true },
        { username: 'ex.funcionario', active: false },
        { username: 'e2e-operator', active: true },
      ],
      '246!!!',
    )
    expect(plan).toEqual([{ username: 'sara.vinhais', password: 'Sara246!!!' }])
  })
})
