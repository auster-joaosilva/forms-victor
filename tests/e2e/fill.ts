import { expect, type Page } from '@playwright/test'

export const E2E_ADMIN = { username: 'e2e-admin', password: 'senha-local-do-e2e-1' }

const TEXT: Record<string, string> = {
  cnpj: '12.ABC.345/01DE-35',
  nomeEmpresa: 'Empresa Ponta a Ponta',
  solicitante: 'Fulano de Tal',
  email: 'fulano@exemplo.com.br',
  telefone: '(34) 99999-9999',
}
const CHOICE: Record<string, string> = { versaoFormulario: 'sintetico', regimeAtual: 'simples', ehSimei: 'nao', segmento: 'comercio' }

let address = 0
export async function useOwnAddress(page: Page) {
  address++
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${(Date.now() + address) % 250}` })
}

export async function fillVisibleStep(page: Page, choices: Record<string, string> = {}) {
  const preferred = { ...CHOICE, ...choices }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false
    const keys = await page.locator('[data-field]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-field') ?? ''))
    for (const key of keys) {
      const field = page.locator(`[data-field="${key}"]`)
      const value = TEXT[key]
      if (value !== undefined) {
        const input = field.locator('input')
        if ((await input.inputValue()) === '') {
          await input.fill(value)
          await input.blur()
          changed = true
        }
      } else if (await field.locator('select').count()) {
        const select = field.locator('select')
        if (!(await select.inputValue())) {
          await select.selectOption(preferred[key] ?? { index: 1 })
          changed = true
        }
      } else if (await field.locator('table').count()) {
        const rows = field.locator('tbody tr')
        for (let i = 0; i < (await rows.count()); i++) {
          const radio = rows.nth(i).locator(`input[value="${i === 0 ? 'acima_80' : 'zero'}"]`)
          if (!(await radio.isChecked())) {
            await radio.check()
            changed = true
          }
        }
      } else if (await field.locator('input[type="checkbox"]').count()) {
        const box = field.locator('input[type="checkbox"]')
        if (!(await box.isChecked())) {
          await box.check()
          changed = true
        }
      } else if (await field.locator('input[type="radio"]').count()) {
        if (!(await field.locator('input[type="radio"]:checked').count())) {
          const choice = preferred[key]
          await (choice ? field.locator(`input[value="${choice}"]`) : field.locator('input[type="radio"]').first()).check()
          changed = true
        }
      }
    }
    if (!changed) return
  }
}

export async function walkToResult(page: Page, choices: Record<string, string> = {}) {
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(`Etapa ${step} de 5`)).toBeVisible()
    await fillVisibleStep(page, choices)
    await page.getByRole('button', { name: step === 5 ? 'Conferir respostas' : 'Próximo' }).click()
  }
  await page.getByRole('button', { name: 'Ver diagnóstico' }).click()
  await expect(page.getByText('Respostas enviadas automaticamente.')).toBeVisible()
  const heading = await page.getByRole('heading', { name: /^Protocolo DS-/ }).textContent()
  return (heading ?? '').replace('Protocolo ', '').trim()
}

export async function completeDiagnosis(page: Page, path = '/diagnosis'): Promise<string> {
  await useOwnAddress(page)
  await page.goto(path)
  return walkToResult(page)
}

export async function changePhoneAndResubmit(page: Page, phone: string) {
  await page.getByRole('button', { name: 'Revisar respostas' }).click()
  await page.locator('.dx-review-row', { hasText: 'Telefone' }).getByRole('button', { name: 'alterar' }).click()
  const input = page.locator('[data-field="telefone"] input')
  await input.fill(phone)
  await input.blur()
  for (let step = 1; step <= 5; step++) await page.getByRole('button', { name: step === 5 ? 'Conferir respostas' : 'Próximo' }).click()
  await page.getByRole('button', { name: 'Ver diagnóstico' }).click()
  await expect(page.getByText('Respostas enviadas automaticamente.')).toBeVisible()
}

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuário').fill(E2E_ADMIN.username)
  await page.getByLabel('Senha').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/backoffice/)
}
