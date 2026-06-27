import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import multer from "multer";
import {
  ensureStorageDir,
  getHealthPayload,
  HAS_SUPABASE_STORAGE,
  normalizeMemberCode,
  processUploadedFiles,
} from "./lib/topup-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.join(__dirname, "storage");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 12 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("只接受圖片檔案"));
    }
    cb(null, true);
  },
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function isRunningDirectly() {
  return process.argv[1] && path.resolve(process.argv[1]) === __filename;
}

app.get("/api/health", async (_req, res) => {
  await ensureStorageDir();
  res.json(getHealthPayload());
});

app.post("/api/analyze", upload.array("images", 10), async (req, res) => {
  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: "請先選擇圖片" });
    }

    if (files.length > 10) {
      return res.status(400).json({ error: "一次最多只可上傳 10 張圖片" });
    }

    const memberCode = normalizeMemberCode(req.body.memberCode);
    const payload = await processUploadedFiles(files, memberCode);
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "系統錯誤，請稍後再試",
    });
  }
});

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
