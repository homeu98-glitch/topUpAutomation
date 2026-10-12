import { applyCors, listCustomerTransactions } from "../../lib/topup-service.js";
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
    if (!session || session.role !== "customer" || !session.memberCode) {
      return res.status(401).json({ error: "請先以客戶身份登入" });
    }
    refreshSession(res, session);

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const shopId = url.searchParams.get("shopId") || "";
    const page = url.searchParams.get("page") || "1";
    const pageSize = url.searchParams.get("pageSize") || "50";

    const payload = await listCustomerTransactions({
      shopId: String(shopId || ""),
      customerCode: String(session.memberCode),
      page,
      pageSize,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "讀取交易紀錄失敗",
    });
  }
}
