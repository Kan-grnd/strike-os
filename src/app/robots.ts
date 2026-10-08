import type { MetadataRoute } from "next";

// Strike OS is an internal tool — keep it out of every search index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}