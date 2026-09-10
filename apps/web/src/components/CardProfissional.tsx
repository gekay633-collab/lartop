import Link from "next/link";
import type { ProfissionalResultado } from "@/lib/api";

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function CardProfissional({ profissional }: { profissional: ProfissionalResultado }) {
  const p = profissional;

  return (
    <Link
      href={`/profissional/${p.usuarioId}`}
      className="flex gap-4 rounded-2xl border border-areia-300 bg-white/70 p-4 transition hover:border-relva-500 hover:shadow-md sm:p-5"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sauge-200 font-display text-lg font-semibold text-pinho-900 sm:h-20 sm:w-20 sm:text-xl">
        {p.fotoPerfilUrl ? (
          <img
            src={p.fotoPerfilUrl}
            alt={p.nomeExibicao}
            className="h-full w-full rounded-xl object-cover"
          />
        ) : (
          iniciais(p.nomeExibicao)
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-pinho-900">
            {p.nomeExibicao}
          </h3>
          {p.seloVerificado && (
            <span className="shrink-0 rounded-full bg-relva-500/15 px-2 py-0.5 text-xs font-medium text-relva-600">
              Verificado
            </span>
          )}
        </div>

        <p className="text-sm text-pinho-700">
          {p.cidadeNome}/{p.cidadeEstado} · {p.distanciaKm} km de você
        </p>

        {p.bio && (
          <p className="mt-1 line-clamp-2 text-sm text-pinho-900/80">{p.bio}</p>
        )}

        <div className="mt-2 flex items-center gap-2 text-sm">
          {p.totalAvaliacoes > 0 ? (
            <>
              <span className="font-data font-semibold text-terra-600">
                {p.notaMedia.toFixed(1)}
              </span>
              <span className="text-pinho-700">
                ({p.totalAvaliacoes} avaliação{p.totalAvaliacoes > 1 ? "ões" : ""})
              </span>
            </>
          ) : (
            <span className="text-pinho-700">Ainda sem avaliações</span>
          )}
        </div>
      </div>
    </Link>
  );
}
