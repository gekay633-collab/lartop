"use client";

export function ErroValidacaoSessao({ mensagem }: { mensagem: string }) {
  return (
    <div role="alert" className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-medium text-terra-600">{mensagem}</p>
      <p className="mt-2 text-sm text-pinho-700">
        Sua sessão não foi apagada. Você pode tentar novamente quando a conexão estiver estável.
      </p>
      <button type="button" onClick={() => window.location.reload()}
        className="mt-4 rounded-lg bg-relva-500 px-4 py-2 text-sm font-semibold text-white">
        Tentar novamente
      </button>
    </div>
  );
}
