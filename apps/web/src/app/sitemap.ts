import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://lartop.app.br/",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://lartop.app.br/jardinagem/rj/marica",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://lartop.app.br/piscinas/rj/marica",
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
