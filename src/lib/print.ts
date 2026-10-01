export const FONT_WAIT_CEILING_MS = 1500

const twoFrames = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve()
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

// Printing before Kanit arrives yields Arial, which has no Light or Medium: the PDF loses every weight.
export async function printWhenReady(title: string): Promise<void> {
  const ceiling = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_CEILING_MS))
  await twoFrames()
  await Promise.race([document.fonts?.ready ?? ceiling, ceiling])
  const previous = document.title
  document.title = title
  window.addEventListener('afterprint', () => void (document.title = previous), { once: true })
  window.print()
}
