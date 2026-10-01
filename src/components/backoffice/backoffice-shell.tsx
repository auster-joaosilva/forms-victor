import type { ReactNode } from 'react'

export function BackofficeShell({ userName, nav, logout, children }: { userName: string; nav: ReactNode; logout: ReactNode; children: ReactNode }) {
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
