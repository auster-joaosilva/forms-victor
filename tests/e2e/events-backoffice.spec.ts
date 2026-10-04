import { expect, test } from '@playwright/test'
import { E2E_OPERATOR, E2E_REGULARIZATION, login } from './fill'

// PNG 1x1: o navegador o reduz a JPEG num canvas e manda os bytes brutos para /backoffice/event-images.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test('o administrador cria um evento, envia a capa, escolhe o fundo Foto e publica', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Eventos' }).click()
  const title = `Encontro E2E ${Date.now()}`
  await page.getByLabel('Título do evento (dá para mudar depois)').fill(title)
  await page.getByRole('button', { name: 'Novo evento' }).click()
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Baixar inscritos (CSV)' })).toBeVisible()

  await page.getByLabel('Fundo da capa').selectOption('foto')
  await page.getByLabel('Enviar imagem da capa').setInputFiles({ name: 'capa.png', mimeType: 'image/png', buffer: PIXEL })
  await expect(page.getByText(/imagem pronta \(\d+ KB\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('salvo')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByRole('button', { name: 'Voltar a rascunho' })).toBeVisible()
})

test('o operador gerencia eventos mas não baixa os inscritos; a regularização nem vê a aba', async ({ page }) => {
  await login(page, E2E_OPERATOR)
  await page.getByRole('link', { name: 'Eventos' }).click()
  await expect(page.getByRole('heading', { name: 'Agenda de eventos' })).toBeVisible()
  await page.locator('tr.bo-row-link').first().click()
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Baixar inscritos (CSV)' })).toHaveCount(0)

  await page.context().clearCookies()
  await login(page, E2E_REGULARIZATION)
  await expect(page.getByRole('link', { name: 'Eventos' })).toHaveCount(0)
  const refused = await page.request.post('/backoffice/event-images?kind=event_cover', { data: PIXEL, headers: { 'content-type': 'image/png' } })
  expect(refused.status()).toBe(403)
})

test('o envio de imagem sem sessão é recusado', async ({ request }) => {
  const refused = await request.post('/backoffice/event-images?kind=event_cover', { data: PIXEL, headers: { 'content-type': 'image/png' } })
  expect([401, 403]).toContain(refused.status())
})
