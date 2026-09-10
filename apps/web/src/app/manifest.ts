import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lartop - Corte de grama e jardinagem",
    short_name: "Lartop",
    description: "Encontre profissionais de corte de grama, poda e paisagismo perto de voce.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F9F1",
    theme_color: "#1F3524",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
