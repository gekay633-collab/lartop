import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

export default function TermosDeUsoPage() {
  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h1 className="font-display text-3xl font-semibold text-pinho-900">Termos de Uso</h1>
          <p className="mt-2 text-sm text-pinho-700">Ultima atualizacao: setembro de 2026</p>

          <div className="mt-8 flex flex-col gap-6 text-pinho-900/90">
            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">1. Aceitacao dos termos</h2>
              <p className="mt-2">Ao criar uma conta ou utilizar a Lartop, voce concorda com estes Termos de Uso e com a nossa Politica de Privacidade. Se voce nao concordar com algum ponto, pedimos que nao utilize a plataforma.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">2. O que e a Lartop</h2>
              <p className="mt-2">A Lartop e uma plataforma de vitrine e intermediacao de contato entre clientes que buscam servicos de jardinagem e corte de grama e profissionais que oferecem esses servicos. A Lartop nao presta os servicos de jardinagem, nao emprega os profissionais listados e nao participa da negociacao, execucao ou pagamento do servico contratado.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">3. Cadastro</h2>
              <p className="mt-2">Para usar certas funcionalidades, e necessario criar uma conta como cliente ou profissional, fornecendo informacoes verdadeiras e atualizadas. Voce e responsavel por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">4. Responsabilidades do profissional</h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Fornecer informacoes verdadeiras sobre os servicos oferecidos, experiencia e valores de referencia.</li>
                <li>Responder as solicitacoes de orcamento com boa-fe.</li>
                <li>Cumprir com o que foi combinado diretamente com o cliente.</li>
                <li>Nao utilizar a plataforma para fins ilicitos ou fraudulentos.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">5. Responsabilidades do cliente</h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Fornecer informacoes verdadeiras sobre o servico desejado (endereco, tamanho do terreno, descricao).</li>
                <li>Negociar e combinar diretamente com o profissional os termos do servico, incluindo valor, prazo e forma de pagamento.</li>
                <li>Avaliar o profissional de forma honesta apos o servico.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">6. Isencao de responsabilidade</h2>
              <p className="mt-2">A Lartop atua exclusivamente como uma vitrine de conexao. Nao verificamos, garantimos ou nos responsabilizamos pela qualidade, seguranca, legalidade ou execucao dos servicos prestados pelos profissionais listados, nem pelo pagamento entre as partes. Qualquer negociacao, contrato verbal ou acordo financeiro e de responsabilidade exclusiva de cliente e profissional.</p>
              <p className="mt-2">Recomendamos que voce verifique referencias, avaliacoes e combine os detalhes do servico com clareza antes de contratar.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">7. Avaliacoes</h2>
              <p className="mt-2">As avaliacoes devem refletir experiencias reais e verdadeiras. A Lartop se reserva o direito de remover avaliacoes que sejam ofensivas, falsas ou que violem estes termos.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">8. Suspensao e encerramento de conta</h2>
              <p className="mt-2">A Lartop pode suspender ou encerrar contas que violem estes Termos de Uso, incluindo fraude, informacoes falsas, comportamento abusivo ou uso indevido da plataforma.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">9. Planos e cobranca</h2>
              <p className="mt-2">Atualmente, o cadastro e a publicacao de perfil de profissional na Lartop sao gratuitos. Caso a Lartop passe a oferecer planos pagos no futuro, os termos de cobranca serao comunicados com antecedencia e exigirao aceite explicito.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">10. Alteracoes nestes termos</h2>
              <p className="mt-2">Estes Termos de Uso podem ser atualizados periodicamente. A data da ultima atualizacao esta sempre indicada no topo desta pagina.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">11. Contato</h2>
              <p className="mt-2">Duvidas sobre estes termos podem ser enviadas pelo nosso Instagram <a href="https://www.instagram.com/lartopoficial/" target="_blank" rel="noopener noreferrer" className="text-relva-600 hover:underline">@lartopoficial</a>.</p>
            </section>
          </div>
        </div>
      </main>
      <Rodape />
    </>
  );
}
