import { applyCors, getOwnerSettings, updateOwnerSettings } from "../../lib/topup-service.js";
import { readSession, refreshSession } from "../../lib/session.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const session = readSession(req);
    if (!session || session.role !== "owner" || !session.shopId) {
      return res.status(401).json({ error: "請先以店主身份登入" });
    }
    refreshSession(res, session);

    if (req.method === "GET") {
      const settings = await getOwnerSettings(session.shopId);
      return res.status(200).json({ settings });
    }

    if (req.method === "POST") {
      const { autoApproveEnabled, autoApproveIntervalSeconds } = req.body || {};
      const settings = await updateOwnerSettings({
        shopId: session.shopId,
        autoApproveEnabled: Boolean(autoApproveEnabled),
        autoApproveIntervalSeconds: Math.max(1, Number(autoApproveIntervalSeconds) || 300),
      });
      return res.status(200).json({ settings });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "更新設定失敗",
    });
  }
}
