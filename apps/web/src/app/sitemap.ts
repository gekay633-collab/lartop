import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://lartop.app.br/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
