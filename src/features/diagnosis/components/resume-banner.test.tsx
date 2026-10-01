import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResumeBanner } from './resume-banner'

const banner = <ResumeBanner resumable={{ step: 2, answers: {}, savedAt: '2026-10-01T11:00:00.000Z', protocol: null }} onResume={() => undefined} onStartOver={() => undefined} />

describe('ResumeBanner', () => {
  it('keeps its buttons disabled until hydrated, so an early click is not lost', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(banner)
    expect([...host.querySelectorAll('button')].map((button) => button.disabled)).toEqual([true, true])
  })

  it('enables its buttons once hydrated', () => {
    render(banner)
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Começar de novo' })).toBeEnabled()
  })
})
