import Link from "next/link";

const SERVICOS = [
  { slug: "corte-de-grama", nome: "Corte de grama" },
  { slug: "poda", nome: "Poda de arvores e arbustos" },
  { slug: "paisagismo", nome: "Paisagismo" },
  { slug: "manutencao-jardim", nome: "Manutencao de jardim" },
  { slug: "limpeza-terreno", nome: "Limpeza de terreno" },
  { slug: "instalacao", nome: "Instalacao de grama/jardim" },
  { slug: "piscineiro", nome: "Piscineiro" },
];

export function Rodape() {
  return (
    <footer className="mt-auto border-t border-areia-300 bg-sauge-100">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg text-pinho-900">Lartop</p>
            <p className="mt-2 max-w-xs text-sm text-pinho-700">Conectamos quem precisa cuidar da casa com profissionais de jardinagem, piscina e muito mais perto de voce.</p>
            <a href="https://www.instagram.com/lartopoficial/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium text-relva-600 hover:underline">Instagram @lartopoficial</a>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-pinho-900">Ajuda</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-pinho-700">
              <li><Link href="/para-profissionais" className="hover:text-pinho-900">Vagas para profissionais</Link></li>
              <li><Link href="/buscar" className="hover:text-pinho-900">Encontrar profissional</Link></li>
              <li><Link href="/#faq" className="hover:text-pinho-900">Perguntas frequentes</Link></li>
              <li><Link href="/entrar" className="hover:text-pinho-900">Entrar na minha conta</Link></li>
              <li><Link href="/termos-de-uso" className="hover:text-pinho-900">Termos de uso</Link></li>
              <li><Link href="/politica-de-privacidade" className="hover:text-pinho-900">Politica de privacidade</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-pinho-900">Tipos de servico</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-pinho-700">
              {SERVICOS.map((s) => (
                <li key={s.slug}><Link href={`/buscar?categoria=${s.slug}`} className="hover:text-pinho-900">{s.nome}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-pinho-900">Para profissionais</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-pinho-700">
              <li><Link href="/para-profissionais" className="hover:text-pinho-900">Criar meu perfil</Link></li>
              <li><Link href="/painel" className="hover:text-pinho-900">Acessar meu painel</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-areia-300 pt-6 text-xs text-pinho-700/70">
          <p>&copy; {new Date().getFullYear()} Lartop. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
