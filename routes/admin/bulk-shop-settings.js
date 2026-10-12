import { applyCors, updateOwnerSettingsBulk } from "../../lib/topup-service.js";
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

    const { shopIds, autoApproveEnabled, autoApproveIntervalSeconds, autoApproveSettings } = req.body || {};
    const settings = await updateOwnerSettingsBulk({
      shopIds: Array.isArray(shopIds) ? shopIds.map(String) : [],
      autoApproveEnabled: Boolean(autoApproveEnabled),
      autoApproveIntervalSeconds:
        autoApproveIntervalSeconds === undefined
          ? 300
          : Math.max(1, Number(autoApproveIntervalSeconds) || 300),
      autoApproveSettings: autoApproveSettings && typeof autoApproveSettings === "object"
        ? autoApproveSettings
        : undefined,
    });

    return res.status(200).json({ settings, count: settings.length });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "批量更新商家設定失敗",
    });
  }
}

