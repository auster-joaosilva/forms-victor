import { BrandMark } from '@/components/public/brand-mark'
import { PublicBar } from '@/components/public/public-bar'
import { PublicFooter } from '@/components/public/public-footer'
import { useReveal } from '@/components/public/use-reveal'
import { useStickyBar } from '@/components/public/use-sticky-bar'
import type { HomeBootstrap } from '../types/home'
import { Doors } from './doors'

const ANCHORS = [
  ['portas', 'Por onde começar'],
  ['como', 'Como funciona'],
  ['quem', 'Quem faz'],
] as const

export function HomePage({ bootstrap }: { bootstrap: HomeBootstrap }) {
  useReveal('home')
  useStickyBar()
  return (
    <div className="pub">
      <PublicBar
        anchors={ANCHORS}
        action={
          <a className="botao" href="/diagnosis">
            Fazer o diagnóstico
          </a>
        }
      />
      <header className="capa tema-foto" id="capa">
        <div className="miolo">
          <div className="texto">
            <BrandMark />
            <span className="rotulo">Reforma Tributária</span>
            <h1>
              A Reforma Tributária <b>na sua empresa</b>
            </h1>
            <div className="chamada">
              Diagnóstico, formalização da opção e encontros presenciais. Tudo o que a Auster preparou para a sua empresa
              atravessar a mudança sabendo o que está fazendo — e não descobrindo depois.
            </div>
            <div className="tira">
              <div className="dado">
                <b>4 a 10 min</b>
                <span>o diagnóstico completo</span>
              </div>
              <div className="dado">
                <b>Com registro</b>
                <span>o termo de opção assinado</span>
              </div>
            </div>
            <div className="acoes">
              <a className="botao" href="/diagnosis">
                Fazer o diagnóstico
              </a>
              <a className="botao fantasma" href="#portas">
                Ver tudo o que tem aqui
              </a>
            </div>
          </div>
          <figure className="retrato-capa">
            <img src="/imagens/recepcao.jpg" alt="Recepção da Auster, em Uberlândia" />
          </figure>
        </div>
      </header>

      <main id="corpo">
        <section id="portas" className="rev">
          <span className="olho">por onde começar</span>
          <h2>Escolha o que a sua empresa precisa agora</h2>
          <div className="regua" />
          <p className="linha-fina">Cada porta abre uma etapa. Dá para percorrer na ordem ou ir direto ao que falta.</p>
          <Doors bootstrap={bootstrap} />
        </section>

        <section id="como" className="rev">
          <span className="olho">como funciona</span>
          <h2>Três passos, na ordem</h2>
          <div className="regua" />
          <div className="passos">
            <div className="passo">
              <div className="t">Responda o diagnóstico</div>
              <div className="d">De 4 a 10 minutos, com números que a sua empresa já tem à mão. Nada de documento para procurar.</div>
            </div>
            <div className="passo">
              <div className="t">Leia o resultado</div>
              <div className="d">O portal mostra qual caminho faz mais sentido para o seu caso e por quê, em linguagem de dono de empresa.</div>
            </div>
            <div className="passo">
              <div className="t">Formalize a opção</div>
              <div className="d">Decidido, o termo é assinado na própria página e fica registrado com data, hora e origem do aceite.</div>
            </div>
          </div>
        </section>

        <section id="quem" className="rev">
          <span className="olho">quem faz</span>
          <h2>Auster Inteligência Contábil</h2>
          <div className="regua" />
          <div className="cartao">
            <p>
              Contabilidade, fiscal recorrente, obrigações acessórias e rotinas empresariais, em Uberlândia-MG. A frente de
              consultoria tributária da casa acompanha a Reforma desde a tramitação e traduz cada etapa para o que ela significa
              na conta do mês.
            </p>
            <p className="nota">
              O diagnóstico deste portal é orientação preliminar, construída sobre as informações que você declara. A decisão
              definitiva considera as particularidades da empresa e passa pela análise da nossa equipe. Questões de natureza
              jurídica exigem validação de advogado.
            </p>
          </div>
        </section>

        <section className="fecho rev">
          <span className="olho">ficou em dúvida</span>
          <h2>Fale com a gente</h2>
          <div className="regua" />
          <p className="linha-fina">
            Se a sua empresa tem alguma particularidade — filial em outro estado, atividade mista, faturamento perto do limite —
            escreva. Um caso fora do padrão merece conversa, não formulário.
          </p>
          <a className="botao escura" href="mailto:contato@austercontabil.com.br">
            contato@austercontabil.com.br
          </a>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
