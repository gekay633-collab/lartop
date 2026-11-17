import { redirect } from "next/navigation";

// URL antiga mantida só para encaminhar visitantes ao fluxo sem cadastro.
export default function CadastroLegadoPage() {
  redirect("/");
}
