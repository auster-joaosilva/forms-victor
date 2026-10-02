import { recordAccessDenied } from '../auth/access-audit'
import { can, type Capability } from '../domain/permissions'
import { ACCESS_RESTRICTED, ROLE_CANNOT_REACH } from './access-messages'
import { getSessionUser, type SessionUser } from './session'

const plain = (text: string, status: number) => new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// Handlers de rota (CSV) não passam por middleware de função, e o beforeLoad de /backoffice não roda para eles.
// Módulo à parte: só os handlers importam, e assim a sessão e o banco não entram em chunk que o navegador carrega.
export async function ensureCapability(request: Request, capability: Capability): Promise<SessionUser | Response> {
  const user = await getSessionUser(request.headers)
  if (!user) return plain(ACCESS_RESTRICTED, 401)
  if (!can(user.role, capability)) {
    // A recusa vale mesmo sem a trilha: o erro do banco não pode virar 500.
    try {
      await recordAccessDenied({ id: user.id, username: user.username, role: user.role }, capability, new URL(request.url).pathname)
    } catch (error) {
      console.error(error)
    }
    return plain(ROLE_CANNOT_REACH, 403)
  }
  return user
}
