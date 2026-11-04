import { AcessoBuscaCliente } from "@/components/AcessoBuscaCliente";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AcessoBuscaCliente redirecionar>{children}</AcessoBuscaCliente>;
}
