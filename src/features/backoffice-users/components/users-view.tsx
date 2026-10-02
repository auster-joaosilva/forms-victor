import { useState } from 'react'
import { formatShortDateTime } from '@/server/shared/domain/dates'
import type { UserChanges } from '@/server/identity/domain/user'
import { ROLE_LABELS, toRole, type Role } from '@/server/shared/domain/permissions'
import type { UserRow } from '../api/users'

// Ordem da main: do mais fechado ao mais aberto.
const ROLE_ORDER: Role[] = ['operator', 'regularization', 'manager', 'admin']

export type NewUser = { username: string; name: string; role: Role }

type Props = {
  users: UserRow[]
  error: string | null
  pending: boolean
  onCreate(input: NewUser): void
  onChange(username: string, changes: UserChanges): void
  onRequestPassword(username: string): void
  onRename(username: string, currentName: string): void
}

function UserLine({ user, pending, onChange, onRequestPassword, onRename }: { user: UserRow } & Omit<Props, 'users' | 'error' | 'onCreate'>) {
  return (
    <tr className={user.active ? undefined : 'is-inactive'}>
      <td>
        <b>{user.username}</b>
        <br />
        <span className="bo-muted">{user.name}</span>
      </td>
      <td>
        <span className={user.role === 'admin' ? 'bo-role is-admin' : 'bo-role'}>{ROLE_LABELS[user.role]}</span>
      </td>
      <td>{user.active ? 'ativo' : 'desativado'}</td>
      <td>{formatShortDateTime(user.lastLoginAt)}</td>
      <td>{formatShortDateTime(user.createdAt)}</td>
      <td>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onRequestPassword(user.username)}>
          Trocar senha
        </button>
        <select
          aria-label={`Papel de ${user.username}`}
          className="bo-button is-light"
          disabled={pending}
          value={user.role}
          onChange={(event) => onChange(user.username, { role: toRole(event.target.value) })}
        >
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onChange(user.username, { active: !user.active })}>
          {user.active ? 'Desativar' : 'Reativar'}
        </button>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onRename(user.username, user.name)}>
          Renomear
        </button>
      </td>
    </tr>
  )
}

export function UsersView({ users, error, pending, onCreate, ...lineProps }: Props) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [missingUsername, setMissingUsername] = useState(false)

  const create = () => {
    const normalized = username.trim().toLowerCase()
    setMissingUsername(!normalized)
    if (normalized) onCreate({ username: normalized, name: name.trim(), role })
  }

  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Usuários internos</h2>
      <p className="bo-note" style={{ margin: '0 0 18px' }}>
        Cada pessoa entra com usuário e senha próprios, e é esse nome que fica gravado na auditoria de cada resposta validada. A senha nunca é guardada: guarda-se o
        resumo <code>scrypt</code> com sal por usuário.
      </p>
      <ul className="bo-note" style={{ margin: '0 0 18px', paddingLeft: 18, lineHeight: 1.7 }}>
        <li>
          <b>Administrador</b> — tudo, e é o único que cria e altera usuários.
        </li>
        <li>
          <b>Gestor de departamento</b> — tudo, menos abrir acesso para alguém.
        </li>
        <li>
          <b>Regularização</b> — respostas e adesões, inclusive protocolar a opção e tirar a via do termo. Não exporta planilha nem lê a auditoria.
        </li>
        <li>
          <b>Operador</b> — respostas, convites, eventos e inscrições. Não alcança adesão.
        </li>
      </ul>
      <p className="bo-note" style={{ margin: '-10px 0 18px' }}>
        As planilhas com CNPJ e CPF e a trilha de auditoria ficam com administrador e gestor. Quem não tem a permissão não vê o botão — e, se forçar o endereço, a recusa
        fica registrada na auditoria.
      </p>
      <div className="bo-filters">
        <input type="text" placeholder="usuario (sem espaço nem acento)" value={username} onChange={(event) => setUsername(event.target.value)} />
        <input type="text" placeholder="Nome de quem usa" style={{ minWidth: 190 }} value={name} onChange={(event) => setName(event.target.value)} />
        <select aria-label="Papel do novo usuário" value={role} onChange={(event) => setRole(toRole(event.target.value))}>
          {ROLE_ORDER.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </select>
        <button type="button" className="bo-button" disabled={pending} onClick={create}>
          Criar usuário
        </button>
      </div>
      <div className="bo-error">{missingUsername ? 'Informe o usuário.' : error}</div>
      {users.length ? (
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Situação</th>
              <th>Último acesso</th>
              <th>Criado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserLine key={user.id} user={user} pending={pending} {...lineProps} />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Nenhum usuário ainda. O primeiro que você criar nasce administrador.</div>
      )}
    </>
  )
}
