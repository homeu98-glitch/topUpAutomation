import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import {
  ensureStorageDir,
  HAS_SUPABASE_STORAGE,
} from "./lib/topup-service.js";
import analyzeHandler from "./api/analyze.js";
import meHandler from "./api/auth/me.js";
import customerLoginHandler from "./api/auth/customer-login.js";
import membershipLoginHandler from "./api/auth/membership-login.js";
import logoutHandler from "./api/auth/logout.js";
import ownerLoginHandler from "./api/auth/owner-login.js";
import autoApproveHandler from "./api/cron/auto-approve.js";
import customerSubmitHandler from "./api/customer/submit.js";
import healthHandler from "./api/health.js";
import approveHandler from "./api/owner/approve.js";
import batchApproveHandler from "./api/owner/batch-approve.js";
import dashboardHandler from "./api/owner/dashboard.js";
import rejectHandler from "./api/owner/reject.js";
import revokeHandler from "./api/owner/revoke.js";
import settingsHandler from "./api/owner/settings.js";
import transactionsHandler from "./api/owner/transactions.js";
import updateTransactionHandler from "./api/owner/update-transaction.js";
import shopsHandler from "./api/shops.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.join(__dirname, "storage");

app.use(express.json({ limit: "2mb" }));
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
mountRoute("/api/owner/dashboard", dashboardHandler);
mountRoute("/api/owner/transactions", transactionsHandler);
mountRoute("/api/owner/approve", approveHandler);
mountRoute("/api/owner/batch-approve", batchApproveHandler);
mountRoute("/api/owner/reject", rejectHandler);
mountRoute("/api/owner/revoke", revokeHandler);
mountRoute("/api/owner/settings", settingsHandler);
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
