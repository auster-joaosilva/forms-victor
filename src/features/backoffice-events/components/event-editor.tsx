import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { EVENT_STATUS_LABELS, THEMES, type EventContent, type FileRef } from '@/server/events/domain/event'
import { updateEventFn, type EventDetail, type GalleryItem } from '../api/events'
import { uploadEventImage } from '../api/upload-image'
import { ImagePicker, type UploadResult } from './image-picker'
import { COVER_QUALITY, COVER_SIDE, PORTRAIT_QUALITY, PORTRAIT_SIDE, reduceImage } from './reduce-image'
import { SessionsTable, draftsOf, sessionsToSave } from './sessions-table'

const THEME_LABELS: Record<(typeof THEMES)[number], string> = {
  marca: 'Marca — o símbolo, grande, na borda',
  foto: 'Foto — imagem ao lado do texto',
  aurora: 'Aurora — luz em diagonal',
  onda: 'Onda — faixas curvas',
  solido: 'Sólido — azul-escuro e nada mais',
}
const THEME_ORDER = ['marca', 'foto', 'aurora', 'onda', 'solido'] as const
const isTheme = (value: string): value is (typeof THEMES)[number] => THEMES.some((theme) => theme === value)

const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean)

// O mesmo molde do servidor, repetido de propósito: a pessoa vê o erro enquanto digita. Quem decide continua sendo o servidor.
function slugHint(value: string, published: boolean, untouched: boolean): string {
  if (untouched) return published ? 'este evento já está publicado: trocar o endereço quebra todo link já enviado' : 'letras sem acento, números e hífen — é o que vem depois de /events/'
  const clean = value.trim().toLowerCase()
  if (!clean) return 'o endereço não pode ficar em branco'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean)) return 'só letras sem acento, números e hífen entre palavras'
  if (clean.length < 3 || clean.length > 50) return 'de 3 a 50 caracteres'
  return `a página vai ficar em /events/${clean}`
}

type Props = {
  detail: EventDetail
  gallery: GalleryItem[]
  canManage: boolean
  canExport: boolean
  onBack(): void
  onChanged(saved: boolean): void
}

export function EventEditor({ detail, gallery, canManage, canExport, onBack, onChanged }: Props) {
  const { event, counts } = detail
  const content = event.content
  const [title, setTitle] = useState(event.title)
  const [slug, setSlug] = useState(event.slug)
  const [slugTouched, setSlugTouched] = useState(false)
  const [chamada, setChamada] = useState(content.chamada ?? '')
  const [local, setLocal] = useState(content.local ?? '')
  const [intro, setIntro] = useState(content.intro ?? '')
  const [destaques, setDestaques] = useState((content.destaques ?? []).map((item) => `${item.titulo} | ${item.texto}`).join('\n'))
  const [temas, setTemas] = useState((content.temas ?? []).join('\n'))
  const [avisos, setAvisos] = useState((content.avisos ?? []).join('\n'))
  const [aposEncerrar, setAposEncerrar] = useState(content.aposEncerrar ?? '')
  const [tema, setTema] = useState<(typeof THEMES)[number]>(content.tema ?? 'marca')
  const [rotulo, setRotulo] = useState(content.rotulo ?? '')
  const [capa, setCapa] = useState<FileRef | null>(content.capa ?? null)
  const [nome, setNome] = useState(content.palestrante?.nome ?? '')
  const [cargo, setCargo] = useState(content.palestrante?.cargo ?? '')
  const [bio, setBio] = useState(content.palestrante?.bio ?? '')
  const [foto, setFoto] = useState<FileRef | null>(content.palestrante?.foto ?? null)
  const [sessions, setSessions] = useState(() => draftsOf(event.sessions))
  const [state, setState] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (input: { changes: Parameters<typeof updateEventFn>[0]['data']; saved: boolean }) => updateEventFn({ data: input.changes }),
    onSuccess: (result, input) => {
      if (!result.ok) {
        setState('')
        return setError(`Não foi possível salvar: ${result.error}`)
      }
      setError(null)
      setState('salvo')
      onChanged(input.saved)
    },
    onError: (failure) => {
      setState('')
      setError(`Não foi possível salvar: ${failure.message}`)
    },
  })

  const uploadAs =
    (kind: 'event_cover' | 'speaker_photo', side: number, quality: number) =>
    async (file: File): Promise<UploadResult> => {
      const reduced = await reduceImage(file, side, quality)
      const result = await uploadEventImage({ kind, blob: reduced.blob, originalName: file.name.slice(0, 200) || null })
      return result.ok ? { ok: true, fileId: result.fileId, kb: reduced.kb } : result
    }

  const saveAll = () => {
    setState('salvando…')
    const nextContent: EventContent = {
      ...content,
      chamada: chamada.trim(),
      local: local.trim(),
      intro: intro.trim(),
      destaques: lines(destaques)
        .map((line) => {
          const [first = '', ...rest] = line.split('|')
          return { titulo: first.trim(), texto: rest.join('|').trim() }
        })
        .filter((item) => item.titulo),
      temas: lines(temas),
      avisos: lines(avisos),
      aposEncerrar: aposEncerrar.trim(),
      tema,
      rotulo: rotulo.trim(),
      capa,
      palestrante: { nome: nome.trim(), cargo: cargo.trim(), bio: bio.trim(), foto },
    }
    save.mutate({
      changes: { id: event.id, title: title.trim() || event.title, slug: slug.trim() || event.slug, content: nextContent, sessions: sessionsToSave(sessions) },
      saved: true,
    })
  }
  const change = (changes: { status?: EventDetail['event']['status']; registrations?: EventDetail['event']['registrations'] }) =>
    save.mutate({ changes: { id: event.id, ...changes }, saved: false })
  const copyLink = () => void navigator.clipboard?.writeText(`${window.location.origin}/events/${event.slug}`)
  const busy = save.isPending || !canManage

  return (
    <>
      <div className="bo-filters" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="bo-button is-light" onClick={onBack}>
          ← Todos os eventos
        </button>
        <span>
          <button type="button" className="bo-button is-light" onClick={copyLink}>
            Copiar link
          </button>{' '}
          <a className="bo-button is-light" href={`/events/${event.slug}`} target="_blank" rel="noopener">
            Ver a página
          </a>
        </span>
      </div>

      <div className="bo-counts">
        {([['total', 'Inscritos'], ['present', 'Presentes'], ['cancelled', 'Canceladas']] as const).map(([key, label]) => (
          <div key={key} className="bo-count">
            <div className="bo-count-label">{label}</div>
            <div className="bo-count-value">{counts[key]}</div>
          </div>
        ))}
        <div className="bo-count">
          <div className="bo-count-label">Situação</div>
          <div className="bo-count-value is-text">{EVENT_STATUS_LABELS[event.status]}</div>
        </div>
        <div className="bo-count">
          <div className="bo-count-label">Inscrições</div>
          <div className="bo-count-value is-text">{event.registrations === 'open' ? 'Abertas' : 'Encerradas'}</div>
        </div>
      </div>

      <div className="bo-filters">
        {canManage ? (
          <>
            {event.status !== 'published' ? (
              <button type="button" className="bo-button" disabled={busy} onClick={() => change({ status: 'published' })}>
                Publicar
              </button>
            ) : (
              <button type="button" className="bo-button is-light" disabled={busy} onClick={() => change({ status: 'draft' })}>
                Voltar a rascunho
              </button>
            )}
            {event.registrations === 'open' ? (
              <button type="button" className="bo-button is-light" disabled={busy} onClick={() => change({ registrations: 'closed' })}>
                Encerrar inscrições
              </button>
            ) : (
              <button type="button" className="bo-button is-light" disabled={busy} onClick={() => change({ registrations: 'open' })}>
                Reabrir inscrições
              </button>
            )}
            {event.status !== 'closed' ? (
              <button type="button" className="bo-button is-light" disabled={busy} onClick={() => change({ status: 'closed' })}>
                Marcar como encerrado
              </button>
            ) : null}
          </>
        ) : null}
        {canExport ? (
          <a className="bo-button is-light" href={`/backoffice/events/${event.id}/registrations.csv`}>
            Baixar inscritos (CSV)
          </a>
        ) : null}
      </div>
      {error ? <div className="bo-error">{error}</div> : null}

      <div className="bo-panel" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Conteúdo da página</h2>
        <fieldset disabled={busy} className="bo-form">
          <label className="bo-field">
            <span>Título</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="bo-field">
            <label>
              <span>Endereço da página</span>
              <input type="text" value={slug} onChange={(e) => (setSlug(e.target.value), setSlugTouched(true))} />
            </label>
            <span className="bo-note is-tight">{slugHint(slug, event.status === 'published', !slugTouched)}</span>
          </div>
          <label className="bo-field">
            <span>Chamada (o parágrafo abaixo do título)</span>
            <textarea value={chamada} onChange={(e) => setChamada(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Onde (linha sob as datas, na capa)</span>
            <input type="text" placeholder="Auditório da Auster — Uberlândia/MG" value={local} onChange={(e) => setLocal(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Abertura de “O que você vai ver”</span>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>
              Destaques — um por linha, no formato <code>Título | texto</code>
            </span>
            <textarea value={destaques} onChange={(e) => setDestaques(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Temas abordados — um por linha</span>
            <textarea value={temas} onChange={(e) => setTemas(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Informações gerais — uma por linha</span>
            <textarea value={avisos} onChange={(e) => setAvisos(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Texto quando as inscrições fecharem</span>
            <input type="text" placeholder="Se quiser ser avisado do próximo encontro, fale com a Auster." value={aposEncerrar}
              onChange={(e) => setAposEncerrar(e.target.value)} />
          </label>

          <h3 style={{ margin: '22px 0 8px' }}>Aparência da capa</h3>
          <p className="bo-note" style={{ margin: '0 0 10px' }}>
            Cinco fundos prontos. “Marca”, “Foto” e “Sólido” seguem a regra da casa ao pé da letra; “Aurora” e “Onda” usam degradê, que vale para convite e não
            para peça institucional. A escolha muda só o visual da capa: o conteúdo é o mesmo.
          </p>
          <label className="bo-field">
            <span>Fundo da capa</span>
            <select value={tema} onChange={(e) => isTheme(e.target.value) && setTema(e.target.value)}>
              {THEME_ORDER.map((key) => (
                <option key={key} value={key}>
                  {THEME_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="bo-field">
            <span>Etiqueta acima do título</span>
            <input type="text" placeholder="Encontro gratuito · Uberlândia-MG" value={rotulo} onChange={(e) => setRotulo(e.target.value)} />
          </label>
          <div className="bo-field">
            <span>Imagem da capa (só para o fundo “Foto”)</span>
            <ImagePicker target="cover" value={capa} gallery={gallery} onChange={setCapa} upload={uploadAs('event_cover', COVER_SIDE, COVER_QUALITY)} />
          </div>

          <h3 style={{ margin: '22px 0 8px' }}>Quem apresenta</h3>
          <label className="bo-field">
            <span>Nome</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Cargo</span>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </label>
          <label className="bo-field">
            <span>Apresentação</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
          <div className="bo-field">
            <span>Foto (opcional)</span>
            <ImagePicker target="portrait" value={foto} gallery={gallery} onChange={setFoto} upload={uploadAs('speaker_photo', PORTRAIT_SIDE, PORTRAIT_QUALITY)} />
          </div>

          <h3 style={{ margin: '22px 0 8px' }}>Encontros</h3>
          <p className="bo-note" style={{ margin: '0 0 10px' }}>
            A inscrição é por encontro. Deixe as vagas em branco para não limitar. Encontro que já tem inscrito não pode ser tirado.
          </p>
          <SessionsTable rows={sessions} onChange={setSessions} disabled={busy} />
        </fieldset>
        {canManage ? (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-auster-border)' }}>
            <button type="button" className="bo-button" disabled={save.isPending} onClick={saveAll}>
              Salvar alterações
            </button>
            <span className="bo-note" style={{ marginLeft: 10 }}>
              {state}
            </span>
          </div>
        ) : null}
      </div>
    </>
  )
}
