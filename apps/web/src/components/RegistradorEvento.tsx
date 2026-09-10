"use client";

import { useEffect, useRef } from "react";
import { registrarEvento } from "@/lib/tracking";

export function RegistradorEvento(props: {
  tipo: "PESQUISA" | "VISUALIZACAO_PERFIL";
  cidadeId?: string;
  categoriaId?: string;
  profissionalId?: string;
}) {
  const jaRegistrou = useRef(false);

  useEffect(() => {
    if (jaRegistrou.current) return;
    jaRegistrou.current = true;
    registrarEvento(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
