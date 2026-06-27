import { applyCors, getShopById } from "../../lib/topup-service.js";
import { writeSession } from "../../lib/session.js";

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
    const { memberCode, shopId } = req.body || {};
    if (!/^\d{8}$/.test(String(memberCode || ""))) {
      return res.status(400).json({ error: "請輸入 8 位數會員編號" });
    }

    const shop = await getShopById(shopId);
    if (!shop) {
      return res.status(400).json({ error: "請先選擇有效店舖" });
    }

    writeSession(res, {
      role: "customer",
      memberCode: String(memberCode),
      shopId: shop.id,
      shopName: shop.name,
    });

    return res.status(200).json({
      user: {
        role: "customer",
        memberCode: String(memberCode),
        shopId: shop.id,
        shopName: shop.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "客戶登入失敗",
    });
  }
}
