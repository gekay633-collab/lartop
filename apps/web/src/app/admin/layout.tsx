"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGuardaAdmin } from "@/components/GuardaAdmin";
import { limparSessao } from "@/lib/auth-client";

const ITENS_MENU = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/oferta-demanda", label: "Oferta e Demanda" },
  { href: "/admin/prestadores", label: "Prestadores" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/categorias", label: "Categorias" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { sessao, carregando } = useGuardaAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  if (carregando || !sessao) {
    return <div className="flex min-h-screen items-center justify-center text-pinho-700">Carregando...</div>;
  }

  function sair() {
    limparSessao();
    router.push("/");
  }

  function irPara(href: string) {
    setMenuAberto(false);
    router.push(href);
  }

  return (
    <div className="flex min-h-screen flex-col bg-sauge-50 sm:flex-row">
      <div className="flex items-center justify-between border-b border-areia-300 bg-pinho-900 px-4 py-3 sm:hidden">
        <span className="font-display text-lg font-semibold text-sauge-50">Lartop admin</span>
        <button onClick={() => setMenuAberto(!menuAberto)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sauge-100/30 text-sauge-50" aria-label="Abrir menu">
          {menuAberto ? "✕" : "☰"}
        </button>
      </div>

      <aside className={`${menuAberto ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-areia-300 bg-pinho-900 text-sauge-100 sm:flex sm:w-56`}>
        <div className="hidden border-b border-pinho-700 px-5 py-5 sm:block">
          <p className="font-display text-xl font-semibold text-sauge-50">Lartop</p>
          <p className="text-xs text-sauge-100/70">Painel admin</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {ITENS_MENU.map((item) => (
            <button key={item.href} onClick={() => irPara(item.href)} className={pathname === item.href ? "rounded-lg bg-pinho-700 px-3 py-2 text-left text-sm font-medium text-sauge-50" : "rounded-lg px-3 py-2 text-left text-sm font-medium text-sauge-100/80 hover:bg-pinho-700/50"}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-pinho-700 p-3">
          <button onClick={sair} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-sauge-100/80 hover:bg-pinho-700/50">Sair</button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
