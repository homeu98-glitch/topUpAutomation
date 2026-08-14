import { applyCors, getOwnerSettings, updateOwnerSettings } from "../../lib/topup-service.js";
import { readSession, refreshSession } from "../../lib/session.js";

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const session = readSession(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "請先以管理員身份登入" });
    }
    refreshSession(res, session);

    if (req.method === "GET") {
      const { shopId } = req.query || {};
      if (!shopId) {
        return res.status(400).json({ error: "缺少商家編號" });
      }
      const settings = await getOwnerSettings(String(shopId));
      return res.status(200).json({ settings });
    }

    if (req.method === "POST") {
      const { shopId, autoApproveEnabled, autoApproveIntervalSeconds, autoApproveSettings } = req.body || {};
      if (!shopId) {
        return res.status(400).json({ error: "缺少商家編號" });
      }
      const settings = await updateOwnerSettings({
        shopId: String(shopId),
        autoApproveEnabled: Boolean(autoApproveEnabled),
        autoApproveIntervalSeconds:
          autoApproveIntervalSeconds === undefined
            ? 300
            : Math.max(1, Number(autoApproveIntervalSeconds) || 300),
        autoApproveSettings: autoApproveSettings && typeof autoApproveSettings === "object"
          ? autoApproveSettings
          : undefined,
      });
      return res.status(200).json({ settings });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "管理員更新商家設定失敗",
    });
  }
}

