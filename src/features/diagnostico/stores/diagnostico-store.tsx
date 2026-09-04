import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { etapasAntesDe } from '../config/etapas'
import { errosDoParse, esquemaDaEtapa } from '../schemas/diagnostico.schema'
import { arquivosVazios, valoresIniciais } from '../types'
import { apagarRascunho, lerRascunho, salvarRascunho } from './rascunho'

import type { ReactNode } from 'react'
import type {
  ArquivosDiagnostico,
  CampoAnexo,
  ContatoPublico,
  DiagnosticoValores,
  ErrosDiagnostico,
} from '../types'
import type { SlugEtapa } from '../config/etapas'

const INTERVALO_AUTOSALVAMENTO_MS = 800

type Contexto = {
  valores: DiagnosticoValores
  arquivos: ArquivosDiagnostico
  erros: ErrosDiagnostico
  rascunhoSalvo: boolean

  atualizar: <C extends keyof DiagnosticoValores>(
    campo: C,
    valor: DiagnosticoValores[C],
  ) => void
  atualizarContato: (
    lado: 'contatoCliente' | 'contatoParceiro',
    campo: keyof ContatoPublico,
    valor: string,
  ) => void
  definirArquivos: (campo: CampoAnexo, arquivos: Array<File>) => void
  definirErros: (erros: ErrosDiagnostico) => void

  /** Valida uma etapa e publica os erros. */
  validarEtapa: (slug: SlugEtapa) => boolean
  /**
   * Revalida todas as etapas anteriores a `slug`. Devolve a primeira que
   * falhou (com os erros ja publicados) ou `null` quando todas passam.
   */
  primeiraEtapaInvalidaAntesDe: (slug: SlugEtapa) => SlugEtapa | null

  limpar: () => void
}

const DiagnosticoContext = createContext<Contexto | null>(null)

export function DiagnosticoProvider({ children }: { children: ReactNode }) {
  const [valores, setValores] = useState<DiagnosticoValores>(valoresIniciais)
  const [arquivos, setArquivos] = useState<ArquivosDiagnostico>(arquivosVazios)
  const [erros, setErros] = useState<ErrosDiagnostico>({})
  const [rascunhoSalvo, setRascunhoSalvo] = useState(false)

  // O rascunho e lido em efeito, nao no inicializador do useState: o
  // localStorage nao existe no SSR, e ler ali faria a marcacao do cliente
  // divergir da do servidor na hidratacao.
  const carregado = useRef(false)
  useEffect(() => {
    const rascunho = lerRascunho()
    if (rascunho) setValores(rascunho)
    carregado.current = true
  }, [])

  useEffect(() => {
    // Nao salvar antes de ler: o primeiro efeito ainda nao rodou e gravar o
    // estado inicial vazio apagaria o rascunho de quem voltou para terminar.
    if (!carregado.current) return

    const temporizador = window.setTimeout(() => {
      salvarRascunho(valores)
      setRascunhoSalvo(true)
      window.setTimeout(() => setRascunhoSalvo(false), 2000)
    }, INTERVALO_AUTOSALVAMENTO_MS)

    return () => window.clearTimeout(temporizador)
  }, [valores])

  const atualizar = useCallback<Contexto['atualizar']>((campo, valor) => {
    setValores((anterior) => ({ ...anterior, [campo]: valor }))
    setErros((anterior) => ({ ...anterior, [campo]: undefined }))
  }, [])

  const atualizarContato = useCallback<Contexto['atualizarContato']>(
    (lado, campo, valor) => {
      setValores((anterior) => ({
        ...anterior,
        [lado]: { ...anterior[lado], [campo]: valor },
      }))
      // O erro de contato e um so para os dois blocos: digitar em qualquer um
      // dos lados o limpa.
      setErros((anterior) => ({ ...anterior, contatos: undefined }))
    },
    [],
  )

  const definirArquivos = useCallback<Contexto['definirArquivos']>(
    (campo, novos) => {
      setArquivos((anterior) => ({ ...anterior, [campo]: novos }))

      // Os dois obrigatorios espelham o nome do arquivo em `valores`, que e o
      // que o Zod exige e a revisao mostra.
      if (campo === 'situacao_fiscal') {
        atualizar('anexoSituacaoFiscal', novos[0]?.name ?? '')
      }
      if (campo === 'cdas_pgfn') {
        atualizar('anexoCDAs', novos[0]?.name ?? '')
      }
    },
    [atualizar],
  )

  const validarEtapa = useCallback<Contexto['validarEtapa']>(
    (slug) => {
      const encontrados = errosDoParse(esquemaDaEtapa(slug), valores)
      setErros(encontrados)
      return Object.keys(encontrados).length === 0
    },
    [valores],
  )

  const primeiraEtapaInvalidaAntesDe = useCallback<
    Contexto['primeiraEtapaInvalidaAntesDe']
  >(
    (slug) => {
      for (const anterior of etapasAntesDe(slug)) {
        const encontrados = errosDoParse(esquemaDaEtapa(anterior), valores)
        if (Object.keys(encontrados).length > 0) {
          setErros(encontrados)
          return anterior
        }
      }
      setErros({})
      return null
    },
    [valores],
  )

  const limpar = useCallback(() => {
    setValores(valoresIniciais())
    setArquivos(arquivosVazios())
    setErros({})
    apagarRascunho()
  }, [])

  const valor = useMemo<Contexto>(
    () => ({
      valores,
      arquivos,
      erros,
      rascunhoSalvo,
      atualizar,
      atualizarContato,
      definirArquivos,
      definirErros: setErros,
      validarEtapa,
      primeiraEtapaInvalidaAntesDe,
      limpar,
    }),
    [
      valores,
      arquivos,
      erros,
      rascunhoSalvo,
      atualizar,
      atualizarContato,
      definirArquivos,
      validarEtapa,
      primeiraEtapaInvalidaAntesDe,
      limpar,
    ],
  )

  return (
    <DiagnosticoContext.Provider value={valor}>
      {children}
    </DiagnosticoContext.Provider>
  )
}

export function useDiagnostico(): Contexto {
  const contexto = useContext(DiagnosticoContext)
  if (!contexto) {
    throw new Error(
      'useDiagnostico precisa estar dentro de <DiagnosticoProvider> — ele e montado no layout da rota /diagnostico.',
    )
  }
  return contexto
}
