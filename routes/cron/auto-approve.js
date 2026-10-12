import { applyCors, runAutoApprovalSweep } from "../../lib/topup-service.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
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
