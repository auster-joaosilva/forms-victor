import type { ReactNode } from 'react'
import { BrandMark } from './brand-mark'

export function PublicBar({ anchors, action }: { anchors: readonly (readonly [string, string])[]; action: ReactNode }) {
  return (
    <div className="barra" id="barra">
      <BrandMark />
      <nav>
        {anchors.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      {action}
    </div>
  )
}
