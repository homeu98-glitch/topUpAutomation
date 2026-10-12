import { getShopById, applyCors } from "../../lib/topup-service.js";
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
    if (!session) {
      return res.status(200).json({ user: null });
    }
    refreshSession(res, session);

    const shop = session.shopId ? await getShopById(session.shopId) : null;

    return res.status(200).json({
      user: {
        role: session.role,
        adminLogin: session.adminLogin || null,
        memberCode: session.memberCode || null,
        authSource: session.authSource || "local",
        externalMemberId: session.externalMemberId || null,
        fullName: session.fullName || null,
        phone: session.phone || null,
        ownerLogin: session.ownerLogin || null,
        shopId: session.shopId || null,
        shopName: shop?.name || session.shopName || null,
        shopCode: shop?.code || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "讀取登入狀態失敗",
    });
  }
}
