import type { ReactNode } from 'react'

type Props = { userName: string; nav: ReactNode; account: ReactNode; logout: ReactNode; children: ReactNode }

export function BackofficeShell({ userName, nav, account, logout, children }: Props) {
  return (
    <>
      <header className="bo-header">
        <div className="bo-brand">
          <img className="bo-logo" alt="auster" src="/brand/logo-contabil-negativa.png" />
          <div>
            <h1>Conferência</h1>
            <div className="bo-tagline">Diagnóstico e termos de opção — Simples Nacional 2027</div>
          </div>
        </div>
        <div className="bo-header-actions">
          <span className="bo-who">{userName}</span>
          {account}
          {logout}
        </div>
      </header>
      <main className="bo">
        {nav}
        <div className="bo-panel">{children}</div>
      </main>
    </>
  )
}
