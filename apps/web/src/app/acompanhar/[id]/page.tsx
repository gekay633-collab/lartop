import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { AcompanhamentoRapido } from "@/components/AcompanhamentoRapido";

export const metadata: Metadata = {
  title: "Acompanhar solicitação | LARTOP",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AcompanharRapidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <Cabecalho />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <AcompanhamentoRapido id={id} />
      </main>
      <Rodape />
    </>
  );
}
