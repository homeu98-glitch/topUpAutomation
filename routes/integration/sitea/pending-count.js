import {
  applyCors,
  getPendingTransactionCountByExternalShopId,
  verifyMembershipLoginToken,
} from "../../../lib/topup-service.js";

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
    const authorization = String(req.headers.authorization || "");
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!bearerToken) {
      return res.status(401).json({ error: "缺少 Bearer token" });
    }

    const { claims } = verifyMembershipLoginToken(bearerToken);
    if (claims.portal_role !== "owner") {
      return res.status(403).json({ error: "只有店主 token 可以讀取待審核數量" });
    }

    const requestedShopId = String(req.query?.shopId || claims.shop_id || "").trim();
    if (!requestedShopId) {
      return res.status(400).json({ error: "缺少 shopId" });
    }
    if (claims.shop_id && String(claims.shop_id) !== requestedShopId) {
      return res.status(403).json({ error: "token 的 shopId 與請求參數不一致" });
    }

    const result = await getPendingTransactionCountByExternalShopId(requestedShopId);
    return res.status(200).json({
      shopId: result.shopId,
      shopName: result.shopName,
      pendingCount: result.pendingCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "讀取待審核數量失敗",
    });
  }
}
