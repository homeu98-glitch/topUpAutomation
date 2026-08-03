import { applyCors, runAutoApprovalSweep } from "../../lib/topup-service.js";
import { readSession, refreshSession } from "../../lib/session.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = readSession(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "請先以管理員身份登入" });
    }
    refreshSession(res, session);

    const { shopId } = req.body || {};
    const result = await runAutoApprovalSweep({
      shopId: String(shopId || ""),
      forceAll: true,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "管理員執行自動核准失敗",
    });
  }
}

