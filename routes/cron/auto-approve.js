import { applyCors, runAutoApprovalSweep } from "../../lib/topup-service.js";

// Vercel attaches `Authorization: Bearer <CRON_SECRET>` to scheduled cron
// invocations when CRON_SECRET is configured. When it is unset (local dev /
// unconfigured), the gate is relaxed so legitimate runs are not blocked.
const CRON_SECRET = process.env.CRON_SECRET || "";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (CRON_SECRET) {
    const authHeader = req.headers["authorization"] || "";
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: "未授權的排程請求" });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await runAutoApprovalSweep();
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "自動核准失敗",
    });
  }
}
