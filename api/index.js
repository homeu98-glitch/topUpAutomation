import { applyCors } from "../lib/topup-service.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

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
    const { default: analyzeHandler } = await import("./analyze.js");
    return analyzeHandler(req, res);
  }

  if (pathname.endsWith("/shops")) {
    const { default: shopsHandler } = await import("./shops.js");
    return shopsHandler(req, res);
  }

  if (pathname.endsWith("/auth/me")) {
    const { default: meHandler } = await import("./auth/me.js");
    return meHandler(req, res);
  }

  if (pathname.endsWith("/auth/customer-login")) {
    const { default: customerLoginHandler } = await import("./auth/customer-login.js");
    return customerLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/membership-login")) {
    const { default: membershipLoginHandler } = await import("./auth/membership-login.js");
    return membershipLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/sso-login")) {
    const { default: ssoLoginHandler } = await import("./auth/sso-login.js");
    return ssoLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/owner-login")) {
    const { default: ownerLoginHandler } = await import("./auth/owner-login.js");
    return ownerLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/admin-login")) {
    const { default: adminLoginHandler } = await import("./auth/admin-login.js");
    return adminLoginHandler(req, res);
  }

  if (pathname.endsWith("/auth/logout")) {
    const { default: logoutHandler } = await import("./auth/logout.js");
    return logoutHandler(req, res);
  }

  if (pathname.endsWith("/customer/submit")) {
    const { default: submitHandler } = await import("./customer/submit.js");
    return submitHandler(req, res);
  }

  if (pathname.endsWith("/customer/transactions")) {
    const { default: customerTransactionsHandler } = await import("./customer/transactions.js");
    return customerTransactionsHandler(req, res);
  }

  if (pathname.endsWith("/owner/dashboard")) {
    const { default: dashboardHandler } = await import("./owner/dashboard.js");
    return dashboardHandler(req, res);
  }

  if (pathname.endsWith("/owner/transactions")) {
    const { default: transactionsHandler } = await import("./owner/transactions.js");
    return transactionsHandler(req, res);
  }

  if (pathname.endsWith("/owner/approve")) {
    const { default: approveHandler } = await import("./owner/approve.js");
    return approveHandler(req, res);
  }

  if (pathname.endsWith("/owner/batch-approve")) {
    const { default: batchApproveHandler } = await import("./owner/batch-approve.js");
    return batchApproveHandler(req, res);
  }

  if (pathname.endsWith("/owner/reject")) {
    const { default: rejectHandler } = await import("./owner/reject.js");
    return rejectHandler(req, res);
  }

  if (pathname.endsWith("/owner/revoke")) {
    const { default: revokeHandler } = await import("./owner/revoke.js");
    return revokeHandler(req, res);
  }

  if (pathname.endsWith("/owner/settings")) {
    const { default: settingsHandler } = await import("./owner/settings.js");
    return settingsHandler(req, res);
  }

  if (pathname.endsWith("/owner/auto-approve-sweep")) {
    const { default: autoApproveSweepHandler } = await import("./owner/auto-approve-sweep.js");
    return autoApproveSweepHandler(req, res);
  }

  if (pathname.endsWith("/owner/update-transaction")) {
    const { default: updateTransactionHandler } = await import("./owner/update-transaction.js");
    return updateTransactionHandler(req, res);
  }

  if (pathname.endsWith("/admin/dashboard")) {
    const { default: adminDashboardHandler } = await import("./admin/dashboard.js");
    return adminDashboardHandler(req, res);
  }

  if (pathname.endsWith("/admin/transactions")) {
    const { default: adminTransactionsHandler } = await import("./admin/transactions.js");
    return adminTransactionsHandler(req, res);
  }

  if (pathname.endsWith("/cron/auto-approve")) {
    const { default: cronHandler } = await import("./cron/auto-approve.js");
    return cronHandler(req, res);
  }

  if (pathname.endsWith("/integration/sitea/pending-count")) {
    const { default: pendingCountHandler } = await import("./integration/sitea/pending-count.js");
    return pendingCountHandler(req, res);
  }

  return res.status(200).json({
    ok: true,
    route: "api/index",
    message: "API is reachable",
  });
}
