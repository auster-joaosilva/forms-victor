import { expect, test } from '@playwright/test'
import { E2E_OPERATOR } from './users'

test('o operador redefine a própria senha pelo e-mail e entra com a nova', async ({ page, request }) => {
  await page.goto('/forgot-password')
  await page.getByLabel('Usuário').fill(E2E_OPERATOR.username)
  await page.getByRole('button', { name: 'Enviar link de redefinição' }).click()
  await expect(page.getByText(/Se o usuário existir e tiver e-mail cadastrado/)).toBeVisible()

  const mailpit = await request.get('http://localhost:8025/api/v1/search', { params: { query: `to:${E2E_OPERATOR.username}@austercontabil.com.br` } })
  const { messages } = await mailpit.json()
  expect(messages.length).toBeGreaterThan(0)
  const full = await (await request.get(`http://localhost:8025/api/v1/message/${messages[0].ID}`)).json()
  const link = /https?:\/\/[^\s"]+\/reset-password\?token=[a-f0-9]+/.exec(full.Text)?.[0]
  expect(link).toBeTruthy()

  await page.goto(link ?? '')
  await page.getByPlaceholder('Nova senha').fill('Operador246!')
  await page.getByPlaceholder('Repita a nova senha').fill('Operador246!')
  await page.getByRole('button', { name: 'Definir nova senha' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Usuário').fill(E2E_OPERATOR.username)
  await page.getByLabel('Senha').fill('Operador246!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/backoffice/)
})
