import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import {
  ensureStorageDir,
  HAS_SUPABASE_STORAGE,
} from "./lib/topup-service.js";
import { applyEmbedResponseHeaders } from "./lib/embed-policy.js";
import analyzeHandler from "./routes/analyze.js";
import meHandler from "./routes/auth/me.js";
import customerLoginHandler from "./routes/auth/customer-login.js";
import membershipLoginHandler from "./routes/auth/membership-login.js";
import logoutHandler from "./routes/auth/logout.js";
import ownerLoginHandler from "./routes/auth/owner-login.js";
import autoApproveHandler from "./routes/cron/auto-approve.js";
import customerSubmitHandler from "./routes/customer/submit.js";
import customerTransactionsHandler from "./routes/customer/transactions.js";
import healthHandler from "./routes/health.js";
import approveHandler from "./routes/owner/approve.js";
import batchApproveHandler from "./routes/owner/batch-approve.js";
import dashboardHandler from "./routes/owner/dashboard.js";
import autoApproveSweepHandler from "./routes/owner/auto-approve-sweep.js";
import rejectHandler from "./routes/owner/reject.js";
import revokeHandler from "./routes/owner/revoke.js";
import settingsHandler from "./routes/owner/settings.js";
import transactionsHandler from "./routes/owner/transactions.js";
import updateTransactionHandler from "./routes/owner/update-transaction.js";
import shopsHandler from "./routes/shops.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.join(__dirname, "storage");

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  applyEmbedResponseHeaders(res);
  next();
});
app.use(express.static(path.join(__dirname, "public")));

function isRunningDirectly() {
  return process.argv[1] && path.resolve(process.argv[1]) === __filename;
}

function mountRoute(pathname, handler) {
  app.all(pathname, async (req, res) => handler(req, res));
}

mountRoute("/api/health", healthHandler);
mountRoute("/api/analyze", analyzeHandler);
mountRoute("/api/shops", shopsHandler);
mountRoute("/api/auth/me", meHandler);
mountRoute("/api/auth/customer-login", customerLoginHandler);
mountRoute("/api/auth/membership-login", membershipLoginHandler);
mountRoute("/api/auth/owner-login", ownerLoginHandler);
mountRoute("/api/auth/logout", logoutHandler);
mountRoute("/api/customer/submit", customerSubmitHandler);
mountRoute("/api/customer/transactions", customerTransactionsHandler);
mountRoute("/api/owner/dashboard", dashboardHandler);
mountRoute("/api/owner/transactions", transactionsHandler);
mountRoute("/api/owner/approve", approveHandler);
mountRoute("/api/owner/batch-approve", batchApproveHandler);
mountRoute("/api/owner/reject", rejectHandler);
mountRoute("/api/owner/revoke", revokeHandler);
mountRoute("/api/owner/settings", settingsHandler);
mountRoute("/api/owner/auto-approve-sweep", autoApproveSweepHandler);
mountRoute("/api/owner/update-transaction", updateTransactionHandler);
mountRoute("/api/cron/auto-approve", autoApproveHandler);

if (!HAS_SUPABASE_STORAGE) {
  app.use("/storage", express.static(STORAGE_DIR));
}

if (isRunningDirectly()) {
  app.listen(PORT, async () => {
    await ensureStorageDir();
    console.log(`Top-up POC running at http://localhost:${PORT}`);
  });
}

export default app;
