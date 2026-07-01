import { applyCors, approveTransaction } from "../../lib/topup-service.js";
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
    if (!session || session.role !== "owner" || !session.shopId) {
      return res.status(401).json({ error: "請先以店主身份登入" });
    }
    refreshSession(res, session);

    const { transactionId } = req.body || {};
    if (!transactionId) {
      return res.status(400).json({ error: "缺少交易編號" });
    }

    const data = await approveTransaction({
      shopId: session.shopId,
      transactionId: String(transactionId),
      ownerLogin: session.ownerLogin || "owner",
    });

    return res.status(200).json({ ok: true, transaction: data });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "核准交易失敗",
    });
  }
}
