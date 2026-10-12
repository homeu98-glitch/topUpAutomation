import { applyCors } from "../lib/topup-service.js";
import { applyEmbedResponseHeaders } from "../lib/embed-policy.js";

export const config = {
  api: {
    // Keep the raw stream so multipart routes (analyze / customer submit) can
    // use formidable. JSON routes get their body parsed below instead.
    bodyParser: false,
  },
};

/**
 * Vercel no longer auto-parses JSON bodies once bodyParser is disabled at the
 * catch-all level, so parse application/json requests manually here.
 * multipart/form-data is deliberately left untouched for formidable to read.
 */
async function readJsonBody(req) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const contentType = req.headers["content-type"] || "";
  if (contentType.startsWith("multipart/form-data")) return;

  const raw = await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });

  if (!raw) return;
  try {
    req.body = JSON.parse(raw);
  } catch {
    req.body = undefined;
  }
}

export default async function handler(req, res) {
  applyEmbedResponseHeaders(res);
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  await readJsonBody(req);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/health")) {
    return res.status(200).json({
      ok: true,
      route: "api/index/health",
      storageProvider:
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET
          ? "supabase"
          : "local",
      hasAiConfig: Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY),
    });
  }

  if (pathname.endsWith("/analyze")) {
    const { default: analyzeHandler } = await import("../routes/analyze.js");
    return analyzeHandler(req, res);
  }

  if (pathname.endsWith("/shops")) {
    const { default: shopsHandler } = await import("../routes/shops.js");
    return shopsHandler(req, res);
  }

  if (pathname.endsWith("/auth/me")) {
    const { default: meHandler } = await import("../routes/auth/me.js");
    return meHandler(req, res);
  }

  if (pathname.endsWith("/auth/customer-login")) {
    const { default: customerLoginHandler } = await import("../routes/auth/customer-login.js");
    return customerLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/membership-login")) {
    const { default: membershipLoginHandler } = await import("../routes/auth/membership-login.js");
    return membershipLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/sso-login")) {
    const { default: ssoLoginHandler } = await import("../routes/auth/sso-login.js");
    return ssoLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/owner-login")) {
    const { default: ownerLoginHandler } = await import("../routes/auth/owner-login.js");
    return ownerLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/admin-login")) {
    const { default: adminLoginHandler } = await import("../routes/auth/admin-login.js");
    return adminLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/logout")) {
    const { default: logoutHandler } = await import("../routes/auth/logout.js");
    return logoutHandler(req, res);
  }

  if (pathname.endsWith("/customer/submit")) {
    const { default: submitHandler } = await import("../routes/customer/submit.js");
    return submitHandler(req, res);
  }

  if (pathname.endsWith("/customer/submit-raw")) {
    const { default: submitRawHandler } = await import("../routes/customer/submit-raw.js");
    return submitRawHandler(req, res);
  }

  if (pathname.endsWith("/customer/transactions")) {
    const { default: customerTransactionsHandler } = await import("../routes/customer/transactions.js");
    return customerTransactionsHandler(req, res);
  }

  if (pathname.endsWith("/owner/dashboard")) {
    const { default: dashboardHandler } = await import("../routes/owner/dashboard.js");
    return dashboardHandler(req, res);
  }

  if (pathname.endsWith("/owner/transactions")) {
    const { default: transactionsHandler } = await import("../routes/owner/transactions.js");
    return transactionsHandler(req, res);
  }

  if (pathname.endsWith("/owner/approve")) {
    const { default: approveHandler } = await import("../routes/owner/approve.js");
    return approveHandler(req, res);
  }

  if (pathname.endsWith("/owner/batch-approve")) {
    const { default: batchApproveHandler } = await import("../routes/owner/batch-approve.js");
    return batchApproveHandler(req, res);
  }

  if (pathname.endsWith("/owner/reject")) {
    const { default: rejectHandler } = await import("../routes/owner/reject.js");
    return rejectHandler(req, res);
  }

  if (pathname.endsWith("/owner/revoke")) {
    const { default: revokeHandler } = await import("../routes/owner/revoke.js");
    return revokeHandler(req, res);
  }

  if (pathname.endsWith("/owner/settings")) {
    const { default: settingsHandler } = await import("../routes/owner/settings.js");
    return settingsHandler(req, res);
  }

  if (pathname.endsWith("/owner/auto-approve-sweep")) {
    const { default: autoApproveSweepHandler } = await import("../routes/owner/auto-approve-sweep.js");
    return autoApproveSweepHandler(req, res);
  }

  if (pathname.endsWith("/owner/update-transaction")) {
    const { default: updateTransactionHandler } = await import("../routes/owner/update-transaction.js");
    return updateTransactionHandler(req, res);
  }

  if (pathname.endsWith("/admin/dashboard")) {
    const { default: adminDashboardHandler } = await import("../routes/admin/dashboard.js");
    return adminDashboardHandler(req, res);
  }

  if (pathname.endsWith("/admin/transactions")) {
    const { default: adminTransactionsHandler } = await import("../routes/admin/transactions.js");
    return adminTransactionsHandler(req, res);
  }

  if (pathname.endsWith("/admin/shops")) {
    const { default: adminShopsHandler } = await import("../routes/admin/shops.js");
    return adminShopsHandler(req, res);
  }

  if (pathname.endsWith("/admin/shop-settings")) {
    const { default: adminShopSettingsHandler } = await import("../routes/admin/shop-settings.js");
    return adminShopSettingsHandler(req, res);
  }

  if (pathname.endsWith("/admin/bulk-shop-settings")) {
    const { default: adminBulkShopSettingsHandler } = await import("../routes/admin/bulk-shop-settings.js");
    return adminBulkShopSettingsHandler(req, res);
  }

  if (pathname.endsWith("/admin/approve")) {
    const { default: adminApproveHandler } = await import("../routes/admin/approve.js");
    return adminApproveHandler(req, res);
  }

  if (pathname.endsWith("/admin/batch-approve")) {
    const { default: adminBatchApproveHandler } = await import("../routes/admin/batch-approve.js");
    return adminBatchApproveHandler(req, res);
  }

  if (pathname.endsWith("/admin/reject")) {
    const { default: adminRejectHandler } = await import("../routes/admin/reject.js");
    return adminRejectHandler(req, res);
  }

  if (pathname.endsWith("/admin/revoke")) {
    const { default: adminRevokeHandler } = await import("../routes/admin/revoke.js");
    return adminRevokeHandler(req, res);
  }

  if (pathname.endsWith("/admin/update-transaction")) {
    const { default: adminUpdateTransactionHandler } = await import("../routes/admin/update-transaction.js");
    return adminUpdateTransactionHandler(req, res);
  }

  if (pathname.endsWith("/admin/auto-approve-sweep")) {
    const { default: adminAutoApproveSweepHandler } = await import("../routes/admin/auto-approve-sweep.js");
    return adminAutoApproveSweepHandler(req, res);
  }

  if (pathname.endsWith("/cron/auto-approve")) {
    const { default: cronHandler } = await import("../routes/cron/auto-approve.js");
    return cronHandler(req, res);
  }

  if (pathname.endsWith("/integration/sitea/pending-count")) {
    const { default: pendingCountHandler } = await import("../routes/integration/sitea/pending-count.js");
    return pendingCountHandler(req, res);
  }

  return res.status(200).json({
    ok: true,
    route: "api/index",
    message: "API is reachable",
  });
}
