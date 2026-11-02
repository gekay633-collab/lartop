

export function registrarEvento(input: {
  tipo: "PESQUISA" | "VISUALIZACAO_PERFIL";
  cidadeId?: string;
  categoriaId?: string;
  profissionalId?: string;
}) {
  fetch(`/api/eventos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {
    // tracking nunca deve interromper a experiencia do usuario
  });
}
