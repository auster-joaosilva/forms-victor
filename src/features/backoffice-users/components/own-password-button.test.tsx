import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { changeOwnPasswordFn, navigate } = vi.hoisted(() => ({ changeOwnPasswordFn: vi.fn(), navigate: vi.fn() }))
vi.mock('../api/users', () => ({ changeOwnPasswordFn }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

const { OwnPasswordButton } = await import('./own-password-button')

const changeTo = async (password: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'Trocar minha senha' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Nova senha de bia')).toBeInTheDocument()
  await userEvent.type(within(dialog).getByPlaceholderText('Senha'), password)
  await userEvent.type(within(dialog).getByPlaceholderText('Repita a senha'), password)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Definir' }))
}

describe('OwnPasswordButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends only the new password and goes back to the login', async () => {
    changeOwnPasswordFn.mockResolvedValue({ ok: true })
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    render(<OwnPasswordButton username="bia" />)
    await changeTo('senha-bem-longa-1')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/login' }))
    expect(changeOwnPasswordFn).toHaveBeenCalledWith({ data: { password: 'senha-bem-longa-1' } })
    expect(alert).toHaveBeenCalledWith('Senha trocada. O navegador ainda guarda a antiga nesta aba: feche e abra de novo para entrar com a nova.')
  })

  it('tells the refusal of the server', async () => {
    changeOwnPasswordFn.mockResolvedValue({ ok: false, message: 'a senha precisa de pelo menos 12 caracteres' })
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    navigate.mockClear()
    render(<OwnPasswordButton username="bia" />)
    await changeTo('senha-bem-longa-1')
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Trocar minha senha: a senha precisa de pelo menos 12 caracteres'))
    expect(navigate).not.toHaveBeenCalled()
  })
})
