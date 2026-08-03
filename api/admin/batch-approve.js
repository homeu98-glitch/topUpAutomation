import { applyCors, batchApproveTransactionsAsAdmin } from "../../lib/topup-service.js";
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

    const { transactionIds } = req.body || {};
    if (!Array.isArray(transactionIds) || !transactionIds.length) {
      return res.status(400).json({ error: "請先選擇要核准的交易" });
    }

    const rows = await batchApproveTransactionsAsAdmin({
      transactionIds: transactionIds.map(String),
      adminLogin: session.adminLogin || "admin",
    });
    const successCount = rows.filter((row) => row.ok).length;
    const failedCount = rows.length - successCount;
    return res.status(200).json({ ok: failedCount === 0, count: successCount, failedCount, rows });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "管理員批次核准失敗",
    });
  }
}

