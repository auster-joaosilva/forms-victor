import { expect, test } from '@playwright/test'
import { changePhoneAndResubmit, completeDiagnosis, fillVisibleStep, login, useOwnAddress, walkToResult } from './fill'

const nothingLocal = () => [localStorage.length, sessionStorage.length]

test('caminho curto até o resultado; F5 mantém o protocolo; nada local', async ({ page }) => {
  const protocol = await completeDiagnosis(page)
  expect(protocol).toMatch(/^DS-\d{6}-[A-Z0-9]{4}$/)
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  await page.reload()
  await page.getByRole('button', { name: 'Retomar' }).click()
  await expect(page.getByRole('heading', { name: `Protocolo ${protocol}` })).toBeVisible()
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  const cookies = await page.context().cookies()
  expect(cookies.find((cookie) => cookie.name === 'draft_id')).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
})

test('voltar, alterar e reenviar mantém o protocolo', async ({ page }) => {
  const protocol = await completeDiagnosis(page)
  await changePhoneAndResubmit(page, '(34) 98888-7777')
  await expect(page.getByRole('heading', { name: `Protocolo ${protocol}` })).toBeVisible()
})

test('o relatório abre com o nome do arquivo e 5 ou 6 folhas', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => undefined
  })
  await completeDiagnosis(page)
  await page.getByRole('button', { name: 'Baixar o plano de ação em PDF' }).click()
  await page.waitForURL(/\/diagnosis\/report\?print=1/)
  await expect(page).toHaveTitle(/^Plano-De-Acao-SN-Empresa-Ponta-a-Ponta/)
  expect([5, 6]).toContain(await page.locator('.rp-sheet').count())
})

test('o convite pré-preenche e liga a resposta', async ({ page, browser }) => {
  await login(page)
  await page.getByRole('link', { name: 'Convites' }).click()
  const company = `Convidada ${Date.now()}`
  await page.getByPlaceholder('Razão social').fill(company)
  await page.getByRole('button', { name: 'Gerar link' }).click()
  const link = await page.locator('tr', { hasText: company }).locator('.bo-link').textContent()
  const client = await (await browser.newContext()).newPage()
  await useOwnAddress(client)
  await client.goto(new URL(link ?? '').pathname + new URL(link ?? '').search)
  await expect(client.locator('[data-field="nomeEmpresa"] input')).toHaveValue(company)
  await walkToResult(client)
  await page.getByRole('link', { name: 'Respostas' }).click()
  await page.getByPlaceholder('Empresa, CNPJ, protocolo ou respondente').fill(company)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.locator('tr', { hasText: company })).toContainText('convite')
})

test('a matriz vira lista no celular, sem rolagem lateral', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage()
  await useOwnAddress(page)
  await page.goto('/diagnosis')
  for (let step = 1; step <= 2; step++) {
    await fillVisibleStep(page, { versaoFormulario: 'completo' })
    await page.getByRole('button', { name: 'Próximo' }).click()
  }
  const matrix = page.locator('[data-field="receitaPorCliente"]')
  await expect(matrix.locator('.dx-matrix-band', { hasText: 'não sei' }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
