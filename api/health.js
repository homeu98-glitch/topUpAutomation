export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    ok: true,
    route: "api/health",
    storageProvider:
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET
        ? "supabase"
        : "local",
    hasAiConfig: Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY),
  });
}
