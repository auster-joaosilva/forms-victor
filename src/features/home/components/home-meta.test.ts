import { describe, expect, it } from 'vitest'
import { HOME_DESCRIPTION, HOME_TITLE, homeMeta } from './home-meta'

describe('homeMeta', () => {
  it('keeps the page out of search engines and adds the preview tags the old page left as a comment', () => {
    const meta = homeMeta('https://reforma-tributaria.austercontabil.com.br')
    expect(meta).toContainEqual({ title: 'Reforma Tributária — Auster Inteligência Contábil' })
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, nofollow' })
    expect(meta).toContainEqual({ name: 'description', content: HOME_DESCRIPTION })
    expect(meta).toContainEqual({ property: 'og:title', content: HOME_TITLE })
    expect(meta).toContainEqual({ property: 'og:url', content: 'https://reforma-tributaria.austercontabil.com.br/' })
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary' })
  })
})
