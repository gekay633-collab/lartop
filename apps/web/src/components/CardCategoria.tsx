import Link from "next/link";

const ICONES: Record<string, string> = {
  "corte-de-grama": "🌱",
  poda: "✂️",
  paisagismo: "🌳",
  "manutencao-jardim": "🌻",
  "limpeza-terreno": "🧹",
  instalacao: "🌾",
  piscineiro: "🏊",
};

export function CardCategoria({ slug, nome }: { slug: string; nome: string }) {
  return (
    <Link
      href={`/buscar?categoria=${slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-areia-300 bg-white/60 p-5 transition hover:-translate-y-1 hover:border-relva-500 hover:shadow-md"
    >
      <span className="text-3xl">{ICONES[slug] ?? "🌿"}</span>
      <span className="font-display text-lg font-medium text-pinho-900 group-hover:text-relva-600">
        {nome}
      </span>
    </Link>
  );
}
