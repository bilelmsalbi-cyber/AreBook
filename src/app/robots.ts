import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Regular search engines & everything else not listed below
        userAgent: "*",
        allow: ["/", "/results"],
        disallow: [
          "/admin",
          "/api",
          "/booking",
          "/passengers",
          "/services",
          "/payment",
          "/invoice",
          "/login",
          "/signup",
        ],
      },
      // AI training/retrieval crawlers — blocked entirely, separate from
      // the search-engine rule above so ordinary search indexing (Google,
      // Bing) is unaffected.
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "OAI-SearchBot", disallow: "/" },
      { userAgent: "ChatGPT-User", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
      { userAgent: "Meta-ExternalAgent", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
      { userAgent: "Amazonbot", disallow: "/" },
      { userAgent: "Applebot-Extended", disallow: "/" },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}