import { applyCors, batchApproveTransactions } from "../../lib/topup-service.js";
import { readSession } from "../../lib/session.js";

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

    const { transactionIds } = req.body || {};
    if (!Array.isArray(transactionIds) || !transactionIds.length) {
      return res.status(400).json({ error: "請先選擇要核准的交易" });
    }

    const rows = await batchApproveTransactions({
      shopId: session.shopId,
      transactionIds: transactionIds.map(String),
      ownerLogin: session.ownerLogin || "owner",
    });

    return res.status(200).json({ ok: true, count: rows?.length || 0, rows });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "批次核准失敗",
    });
  }
}
