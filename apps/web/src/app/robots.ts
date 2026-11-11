import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/bff/",
        "/admin/",
        "/administracao/",
        "/dashboard/",
        "/minha-conta/",
        "/minhas-solicitacoes/",
        "/entrar",
        "/login",
        "/cadastro",
        "/redefinir-senha",
      ],
    },
    sitemap: "https://lartop.app.br/sitemap.xml",
    host: "https://lartop.app.br",
  };
}
