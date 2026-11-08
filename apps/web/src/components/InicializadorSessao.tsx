"use client";

import { useEffect, useState, type ReactNode } from "react";
import { inicializarSessao } from "@/lib/auth-client";

/** Prevent route guards from redirecting before cookie-based session restoration. */
export function InicializadorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  useEffect(() => {
    let ativo = true;
    inicializarSessao().then(
      () => { if (ativo) setEstado("pronto"); },
      () => { if (ativo) setEstado("erro"); },
    );
    return () => { ativo = false; };
  }, []);

  if (estado === "carregando") {
    return <main role="status" className="mx-auto p-8 text-center">Restaurando sessão...</main>;
  }
  if (estado === "erro") {
    return <main role="alert" className="mx-auto max-w-md p-8 text-center">
      <p>Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.</p>
      <button className="mt-4 rounded-lg border px-4 py-2" onClick={() => {
        setEstado("carregando");
        inicializarSessao().then(() => setEstado("pronto"), () => setEstado("erro"));
      }}>Tentar novamente</button>
    </main>;
  }
  return <>{children}</>;
}
