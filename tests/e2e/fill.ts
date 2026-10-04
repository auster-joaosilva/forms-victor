import { expect, type Page } from '@playwright/test'

import { E2E_ADMIN } from './users'

export { E2E_ADMIN, E2E_OPERATOR, E2E_REGULARIZATION } from './users'

const TEXT: Record<string, string> = {
  cnpj: '12.ABC.345/01DE-35',
  nomeEmpresa: 'Empresa Ponta a Ponta',
  solicitante: 'Fulano de Tal',
  email: 'fulano@exemplo.com.br',
  telefone: '(34) 99999-9999',
}
const CHOICE: Record<string, string> = { versaoFormulario: 'sintetico', regimeAtual: 'simples', ehSimei: 'nao', segmento: 'comercio' }

export const nothingLocal = () => [localStorage.length, sessionStorage.length]

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

// Uma data sempre no futuro: o teste não pode vencer como o da adesão, que só vale até 30/10/2026.
export const futureDay = (days = 45) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export async function createEvent(page: Page, title: string, seats = 1, publish = true): Promise<{ id: number; slug: string }> {
  await page.goto('/backoffice?tab=events')
  await page.getByLabel('Título do evento (dá para mudar depois)').fill(title)
  await page.getByRole('button', { name: 'Novo evento' }).click()
  await page.waitForURL(/[?&]event=\d+/)
  const id = Number(new URL(page.url()).searchParams.get('event'))
  await page.getByRole('button', { name: 'Acrescentar encontro' }).click()
  await page.getByLabel('Data do encontro 1').fill(futureDay())
  await page.getByLabel('Hora do encontro 1').fill('19:30')
  await page.getByLabel('Vagas do encontro 1').fill(String(seats))
  // O editor remonta depois de salvar (fiel ao antigo, que redesenhava a tela), então a prova é a resposta da server function.
  const saved = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/_serverFn/'))
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  expect((await saved).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Tirar' })).toBeVisible()
  if (publish) {
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByRole('button', { name: 'Voltar a rascunho' })).toBeVisible()
  }
  const slug = (await page.getByRole('textbox', { name: 'Endereço da página' }).inputValue()).trim()
  return { id, slug }
}

export async function registerInSession(page: Page, person: { name: string; email: string }) {
  await page.getByLabel('Qual encontro').selectOption({ index: 1 })
  await page.getByLabel('Seu nome').fill(person.name)
  await page.getByLabel('E-mail', { exact: true }).fill(person.email)
  await page.getByLabel('Telefone (WhatsApp)').fill('(34) 99999-9999')
  await page.getByLabel('Seu cargo').selectOption('Sócio')
  await page.getByRole('checkbox', { name: /Concordo que a Auster use meus dados/ }).check()
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click()
}

export async function login(page: Page, user: { username: string; password: string } = E2E_ADMIN) {
  await useOwnAddress(page)
  await page.goto('/login')
  await page.getByLabel('Usuário').fill(user.username)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/backoffice/)
}
