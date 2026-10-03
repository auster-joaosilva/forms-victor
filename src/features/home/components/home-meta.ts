export const HOME_TITLE = 'Reforma Tributária — Auster Inteligência Contábil'
// A chamada da própria capa: é ela que a prévia no WhatsApp deve mostrar.
export const HOME_DESCRIPTION =
  'Diagnóstico, formalização da opção e encontros presenciais. Tudo o que a Auster preparou para a sua empresa atravessar a mudança sabendo o que está fazendo — e não descobrindo depois.'

export function homeMeta(publicUrl: string) {
  return [
    { title: HOME_TITLE },
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'description', content: HOME_DESCRIPTION },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Auster Inteligência Contábil' },
    { property: 'og:locale', content: 'pt_BR' },
    { property: 'og:title', content: HOME_TITLE },
    { property: 'og:description', content: HOME_DESCRIPTION },
    { property: 'og:url', content: `${publicUrl}/` },
    { name: 'twitter:card', content: 'summary' },
  ]
}
