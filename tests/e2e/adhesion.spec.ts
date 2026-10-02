import { expect, test, type Page } from '@playwright/test'
import { E2E_OPERATOR, E2E_REGULARIZATION, login, nothingLocal, useOwnAddress } from './fill'

const PERSON = { cnpj: '12.ABC.345/01DE-35', representante: 'Fulana de Tal', cpf: '529.982.247-25', cargo: 'Sócio Administrador', email: 'fulana@exemplo.com.br', telefone: '(34) 99999-9999' }
const PROTOCOL = /^ADS-\d{8}-[A-Z0-9]{5}$/

async function invitationPath(page: Page, company: string): Promise<string> {
  await login(page)
  await page.getByRole('link', { name: 'Convites' }).click()
  await page.getByPlaceholder('Razão social').fill(company)
  await page.getByRole('button', { name: 'Gerar link' }).click()
  const diagnosisLink = await page.locator('tr', { hasText: company }).locator('.bo-link').textContent()
  return `/adhesion?invite=${new URL(diagnosisLink ?? '').searchParams.get('invite') ?? ''}`
}

async function confirmHybrid(page: Page): Promise<string> {
  const cnpj = page.getByLabel('CNPJ', { exact: true })
  await cnpj.fill(PERSON.cnpj)
  await cnpj.blur()
  await page.getByLabel('Nome do representante legal').fill(PERSON.representante)
  await page.getByLabel('Cargo de quem confirma').selectOption(PERSON.cargo)
  await page.getByLabel('CPF do representante').fill(PERSON.cpf)
  await page.getByLabel('E-mail', { exact: true }).fill(PERSON.email)
  await page.getByLabel('Telefone', { exact: true }).fill(PERSON.telefone)
  await page.getByRole('radio', { name: /Opção 2 — Simples Nacional Híbrido/ }).check()
  await page.getByRole('radio', { name: /autoriza a Auster a cancelar a opção/ }).check()
  await page.getByRole('checkbox', { name: /Li o termo acima/ }).check()
  await page.getByRole('button', { name: 'Confirmar a opção' }).click()
  await expect(page.getByText('Opção registrada')).toBeVisible()
  return ((await page.getByText(PROTOCOL).first().textContent()) ?? '').trim()
}

test('a adesão pelo convite pré-preenche, registra, sobrevive ao F5 e o PDF leva o nome da empresa', async ({ page, browser }) => {
  const stamp = Date.now()
  const company = `Aderente ${stamp}`
  const path = await invitationPath(page, company)
  const client = await (await browser.newContext()).newPage()
  await client.addInitScript(() => {
    window.print = () => undefined
  })
  await useOwnAddress(client)
  await client.goto(path)
  await expect(client.getByLabel('Razão social')).toHaveValue(company)
  expect(await client.evaluate(nothingLocal)).toEqual([0, 0])

  const protocol = await confirmHybrid(client)
  expect(protocol).toMatch(PROTOCOL)
  const cookie = (await client.context().cookies()).find((item) => item.name === 'adhesion_receipt')
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
  expect(cookie?.value).toMatch(/^[0-9a-f]{64}$/)

  await client.reload()
  await expect(client.getByText('Opção registrada')).toBeVisible()
  await expect(client.getByText(protocol).first()).toBeVisible()
  await expect(client.getByText('A Auster fará a opção no Portal do Simples Nacional até 30/10/2026 e confirmará por e-mail.')).toBeVisible()
  await client.getByRole('button', { name: 'Baixar o termo (PDF)' }).click()
  await expect(client).toHaveTitle(new RegExp(`^Termo-Opcao-SN-ADERENTE-${stamp}`))
  expect(await client.evaluate(nothingLocal)).toEqual([0, 0])

  await client.getByRole('button', { name: 'Nova confirmação' }).click()
  await expect(client.getByRole('button', { name: 'Confirmar a opção' })).toBeVisible()
  await expect(client.getByLabel('CPF do representante')).toHaveValue('')
  expect((await client.context().cookies()).find((item) => item.name === 'adhesion_receipt')).toBeUndefined()
  await client.reload()
  await expect(client.getByText('Opção registrada')).toHaveCount(0)
})

test('a regularização vê a adesão, marca Protocolei e tira a via, sem planilha nem auditoria', async ({ page, browser }) => {
  const client = await (await browser.newContext()).newPage()
  await useOwnAddress(client)
  await client.goto('/adhesion')
  await client.getByLabel('Razão social').fill(`Protocolar ${Date.now()}`)
  const protocol = await confirmHybrid(client)

  await login(page, E2E_REGULARIZATION)
  await expect(page.getByRole('link', { name: 'Auditoria' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Adesões' }).click()
  await expect(page.getByRole('link', { name: 'Baixar planilha (CSV)' })).toHaveCount(0)
  await page.getByPlaceholder('Empresa, CNPJ, protocolo ou representante').fill(protocol)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  const row = page.locator('tr', { hasText: protocol })
  await expect(row).toContainText('Recebida')
  await row.getByRole('button', { name: 'Protocolei' }).click()
  await expect(row).toContainText('Protocolada')
  await expect(row).toContainText(`tratado por ${E2E_REGULARIZATION.username} em`)
  await expect(row.getByRole('button', { name: 'Protocolei' })).toHaveCount(0)

  const [copy] = await Promise.all([page.context().waitForEvent('page'), row.getByRole('link', { name: 'Termo (PDF)' }).click()])
  await expect(copy.getByText('Registro do aceite eletrônico')).toBeVisible()
  await expect(copy.getByText(protocol).first()).toBeVisible()
  expect((await page.request.get('/backoffice/adhesions.csv')).status()).toBe(403)
})

test('o operador não alcança adesão: sem aba, sem via, sem planilha, e a recusa vai para a auditoria', async ({ page, browser }) => {
  const client = await (await browser.newContext()).newPage()
  await useOwnAddress(client)
  await client.goto('/adhesion')
  await client.getByLabel('Razão social').fill(`Recusar ${Date.now()}`)
  const protocol = await confirmHybrid(client)
  await login(page)
  await page.getByRole('link', { name: 'Adesões' }).click()
  await page.getByPlaceholder('Empresa, CNPJ, protocolo ou representante').fill(protocol)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  const termPath = await page.locator('tr', { hasText: protocol }).getByRole('link', { name: 'Termo (PDF)' }).getAttribute('href')
  expect(termPath).toMatch(/^\/backoffice\/adhesions\/\d+\/term$/)
  await page.context().clearCookies()

  await login(page, E2E_OPERATOR)
  await expect(page.getByRole('link', { name: 'Respostas' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Adesões' })).toHaveCount(0)
  await page.goto('/backoffice?tab=adhesions')
  await expect(page.getByPlaceholder('Empresa, CNPJ, protocolo ou representante')).toHaveCount(0)
  const refused = await page.goto(termPath ?? '')
  expect(refused?.status()).toBe(200)
  await expect(page.getByText('o seu papel não alcança esta área')).toBeVisible()
  await expect(page.getByText('Registro do aceite eletrônico')).toHaveCount(0)
  expect((await page.request.get('/backoffice/adhesions.csv')).status()).toBe(403)

  await page.context().clearCookies()
  await login(page)
  await page.getByRole('link', { name: 'Auditoria' }).click()
  await expect(page.locator('tr', { hasText: 'acesso negado' }).filter({ hasText: E2E_OPERATOR.username }).first()).toBeVisible()
})
