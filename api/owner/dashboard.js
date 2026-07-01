import { applyCors, getDashboardStats } from "../../lib/topup-service.js";
import { readSession, refreshSession } from "../../lib/session.js";

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
    const session = readSession(req);
    if (!session || session.role !== "owner" || !session.shopId) {
      return res.status(401).json({ error: "請先以店主身份登入" });
    }
    refreshSession(res, session);

    const { from, to } = req.query || {};
    const stats = await getDashboardStats({
      shopId: session.shopId,
      from: String(from || ""),
      to: String(to || ""),
    });

    return res.status(200).json({ stats });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "讀取儀表板失敗",
    });
  }
}
