import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/status`, changeFrequency: "always", priority: 0.4 },
  ];
}
