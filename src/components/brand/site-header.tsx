export function SiteHeader({ subtitle }: { subtitle: string }) {
  return (
    <header className="dx-header">
      <div className="dx-header-brand">
        <img className="dx-logo is-screen" alt="auster Inteligência Contábil" src="/brand/logo-contabil-negativa.png" />
        <img className="dx-logo is-paper" alt="auster Inteligência Contábil" src="/brand/logo-contabil-positiva.png" />
      </div>
      <div className="dx-header-sub">{subtitle}</div>
    </header>
  )
}
