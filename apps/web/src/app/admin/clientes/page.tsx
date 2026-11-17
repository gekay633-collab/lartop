import { redirect } from "next/navigation";

// O cadastro de novos clientes foi encerrado; resultados ficam em /admin/resultados.
// Não apagamos usuários históricos nem avaliações do banco.
export default function AdminClientesLegadosPage() {
  redirect("/admin/resultados");
}
