const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export function registrarEvento(input: {
  tipo: "PESQUISA" | "VISUALIZACAO_PERFIL";
  cidadeId?: string;
  categoriaId?: string;
  profissionalId?: string;
}) {
  fetch(`${API_URL}/api/eventos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {
    // tracking nunca deve interromper a experiencia do usuario
  });
}
