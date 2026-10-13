import { pathToFileURL } from 'node:url'

// `file://${process.argv[1]}` nunca bate no Windows (barra invertida, sem percent-encoding) nem com espaço ou acento
// no caminho: o script sairia com código 0 sem fazer nada. A URL tem de sair do mesmo conversor que o Node usa.
export function isRunDirectly(moduleUrl: string, entryPath: string | undefined = process.argv[1]): boolean {
  return !!entryPath && moduleUrl === pathToFileURL(entryPath).href
}
