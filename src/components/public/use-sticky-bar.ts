import { useEffect } from 'react'

// A barra só entra depois que o botão da capa some da tela: duas chamadas para a mesma ação disputariam o olhar.
export function useStickyBar() {
  useEffect(() => {
    const cover = document.getElementById('capa')
    const bar = document.getElementById('barra')
    if (!bar) return
    const mark = () => bar.classList.toggle('vista', window.scrollY > (cover?.offsetHeight || 400) - 90)
    mark()
    window.addEventListener('scroll', mark, { passive: true })
    return () => window.removeEventListener('scroll', mark)
  }, [])
}
