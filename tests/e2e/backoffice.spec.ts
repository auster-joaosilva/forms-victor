import { expect, test } from '@playwright/test'
import { changePhoneAndResubmit, completeDiagnosis, login, nothingLocal } from './fill'

test('o backoffice lista, trata, avisa a alteração do cliente e baixa o CSV', async ({ page, browser }) => {
  const client = await (await browser.newContext()).newPage()
  const protocol = await completeDiagnosis(client)
  await login(page)
  await page.getByPlaceholder('Empresa, CNPJ, protocolo ou respondente').fill(protocol)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await page.locator('tr.bo-row').first().click()
  await page.getByRole('button', { name: 'Em análise' }).click()
  await changePhoneAndResubmit(client, '(34) 97777-6666')
  await page.locator('tr.bo-row').first().click()
  await expect(page.getByText(/Alterada pelo cliente em .*, depois do último tratamento\./)).toBeVisible()
  await expect(page.getByText('(34) 97777-6666').first()).toBeVisible()
  await page.getByRole('button', { name: 'Fechar' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Baixar planilha (CSV)' }).click()])
  expect(download.suggestedFilename()).toMatch(/^respostas-simples-\d{4}-\d{2}-\d{2}\.csv$/)
})

test('o login e as abas do backoffice não guardam nada local', async ({ page }) => {
  await page.goto('/login')
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  await login(page)
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  for (const tab of ['Convites', 'Adesões', 'Auditoria', 'Usuários', 'Respostas']) {
    await page.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('link', { name: tab })).toHaveClass(/is-active/)
    expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  }
})
