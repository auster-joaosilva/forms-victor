import { useState } from 'react'
import { formatShortDateTime } from '@/server/diagnosis/domain/dates'
import type { Role, UserChanges } from '@/server/identity/domain/user'
import type { UserRow } from '../api/users'

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
  const isAdmin = user.role === 'admin'
  return (
    <tr className={user.active ? undefined : 'is-inactive'}>
      <td>
        <b>{user.username}</b>
        <br />
        <span className="bo-muted">{user.name}</span>
      </td>
      <td>
        <span className={isAdmin ? 'bo-role is-admin' : 'bo-role'}>{isAdmin ? 'administrador' : 'equipe'}</span>
      </td>
      <td>{user.active ? 'ativo' : 'desativado'}</td>
      <td>{formatShortDateTime(user.lastLoginAt)}</td>
      <td>{formatShortDateTime(user.createdAt)}</td>
      <td>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onRequestPassword(user.username)}>
          Trocar senha
        </button>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onChange(user.username, { role: isAdmin ? 'team' : 'admin' })}>
          {isAdmin ? 'Tornar equipe' : 'Tornar administrador'}
        </button>
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
  const [role, setRole] = useState<Role>('team')
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
        Cada pessoa entra com usuário e senha próprios, e é esse nome que fica gravado na auditoria de cada resposta validada.{' '}
        <b>Administrador</b> cria e altera usuários; <b>equipe</b> confere respostas e gera convites, e pode trocar a própria senha. A
        senha nunca é guardada: guarda-se o resumo <code>scrypt</code> com sal por usuário.
      </p>
      <div className="bo-filters">
        <input type="text" placeholder="usuario (sem espaço nem acento)" value={username} onChange={(event) => setUsername(event.target.value)} />
        <input type="text" placeholder="Nome de quem usa" style={{ minWidth: 190 }} value={name} onChange={(event) => setName(event.target.value)} />
        <select value={role} onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'team')}>
          <option value="team">equipe</option>
          <option value="admin">administrador</option>
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
