import { assinarUpload, enviar, porProtocolo } from './diagnostico'
import { addTodo, listTodos } from './todos'

export default {
  diagnostico: {
    assinarUpload,
    enviar,
    porProtocolo,
  },

  // Exemplo que veio do template. Sai quando o segundo formulario entrar.
  listTodos,
  addTodo,
}
