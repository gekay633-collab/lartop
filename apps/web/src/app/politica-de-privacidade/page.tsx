import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

export default function PoliticaPrivacidadePage() {
  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h1 className="font-display text-3xl font-semibold text-pinho-900">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-pinho-700">Última atualização: setembro de 2026</p>

          <div className="mt-8 flex flex-col gap-6 text-pinho-900/90">
            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">1. Quem somos</h2>
              <p className="mt-2">A Lartop é uma plataforma que conecta clientes a profissionais de corte de grama, poda e paisagismo. Esta política explica como coletamos, usamos e protegemos os dados pessoais de quem utiliza o site, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">2. Quais dados coletamos</h2>
              <p className="mt-2">Coletamos os seguintes dados, conforme o uso que você faz da plataforma:</p>
              <ul className="mt-2 list-disc pl-5">
                <li>Nome, e-mail, telefone e senha (armazenada de forma criptografada), no cadastro de conta.</li>
                <li>CEP e endereço, para calcular a distância entre você e os profissionais disponíveis.</li>
                <li>Fotos de perfil e de trabalhos realizados, quando o profissional opta por enviar.</li>
                <li>Dados de uso, como pesquisas realizadas e perfis visualizados, para melhorar a qualidade da busca.</li>
                <li>Avaliações e comentários que você escreve sobre um serviço.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">3. Como usamos seus dados</h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Para exibir profissionais próximos a você com base no CEP informado.</li>
                <li>Para permitir que você entre em contato com um profissional via WhatsApp.</li>
                <li>Para autenticar sua conta e manter sua sessão ativa com segurança.</li>
                <li>Para enviar e-mails operacionais, como recuperação de senha.</li>
                <li>Para gerar estatísticas agregadas e anônimas sobre demanda por região e categoria.</li>
              </ul>
              <p className="mt-2">Nunca vendemos seus dados pessoais a terceiros.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">4. Compartilhamento com terceiros</h2>
              <p className="mt-2">Para operar a plataforma, utilizamos os seguintes serviços, que podem processar dados em nosso nome:</p>
              <ul className="mt-2 list-disc pl-5">
                <li><strong>Cloudinary</strong> - armazenamento de fotos de perfil e portfólio.</li>
                <li><strong>Resend</strong> - envio de e-mails transacionais (como recuperação de senha).</li>
                <li><strong>ViaCEP e OpenStreetMap (Nominatim)</strong> - resolução de CEP e cálculo de localização geográfica.</li>
              </ul>
              <p className="mt-2">O contato entre cliente e profissional acontece diretamente pelo WhatsApp, fora da nossa plataforma - a Lartop não armazena o conteúdo dessas conversas.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">5. Seus direitos</h2>
              <p className="mt-2">De acordo com a LGPD, você tem direito a:</p>
              <ul className="mt-2 list-disc pl-5">
                <li>Confirmar a existência de tratamento dos seus dados.</li>
                <li>Acessar, corrigir ou atualizar seus dados pessoais.</li>
                <li>Solicitar a exclusão dos seus dados, exceto quando houver obrigação legal de retenção.</li>
                <li>Revogar seu consentimento a qualquer momento.</li>
              </ul>
              <p className="mt-2">Para exercer qualquer um desses direitos, entre em contato pelo nosso Instagram <a href="https://www.instagram.com/lartopoficial/" target="_blank" rel="noopener noreferrer" className="text-relva-600 hover:underline">@lartopoficial</a>.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">6. Segurança dos dados</h2>
              <p className="mt-2">Adotamos medidas técnicas para proteger seus dados, incluindo criptografia de senhas, conexões seguras (HTTPS), controle de acesso por autenticação e limitação de tentativas de login.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">7. Cookies</h2>
              <p className="mt-2">Utilizamos um cookie essencial para manter sua sessão de login ativa com segurança. Não utilizamos cookies de rastreamento publicitário.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-pinho-900">8. Alterações nesta política</h2>
              <p className="mt-2">Esta política pode ser atualizada periodicamente. A data da última atualização está sempre indicada no topo desta página.</p>
            </section>
          </div>
        </div>
      </main>
      <Rodape />
    </>
  );
}
