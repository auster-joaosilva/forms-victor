import { useEffect } from 'react'

// Entrada por rolagem: só opacidade. Sem IntersectionObserver (jsdom, navegador velho) tudo aparece.
export function useReveal(key: unknown) {
  useEffect(() => {
    const targets = document.querySelectorAll('.pub .rev:not(.vista)')
    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('vista'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('vista')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [key])
}
