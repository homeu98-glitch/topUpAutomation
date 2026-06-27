export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/health")) {
    return res.status(200).json({
      ok: true,
      route: "api/index/health",
      storageProvider:
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET
          ? "supabase"
          : "local",
      hasAiConfig: Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY),
    });
  }

  if (pathname.endsWith("/analyze")) {
    const { default: analyzeHandler } = await import("./analyze.js");
    return analyzeHandler(req, res);
  }

  return res.status(200).json({
    ok: true,
    route: "api/index",
    message: "API is reachable",
  });
}
