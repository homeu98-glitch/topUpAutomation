import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, "..", "storage");

export const AI_BASE_URL = (process.env.AI_BASE_URL || "").replace(/\/$/, "");
export const AI_API_KEY = process.env.AI_API_KEY || "";
export const AI_MODEL = process.env.AI_MODEL || "qwen-vl-plus";
export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "topup-images";
export const DEFAULT_OWNER_CODE = "60000000";
export const DEFAULT_OWNER_PASSWORD = "0000";
export const DEFAULT_OWNER_SHOP_NAME = "表嫂美食";
export const DEFAULT_CUSTOMER_CODE = "63936541";
export const DEFAULT_CUSTOMER_PASSWORD = "1234";

export const HAS_SUPABASE_STORAGE = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_STORAGE_BUCKET
);

const supabase = HAS_SUPABASE_STORAGE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const extractionPrompt = `
你是一個付款截圖辨識助手。請只輸出 JSON，不要輸出 Markdown，不要加說明文字。

你需要從付款截圖中盡量辨識以下交易欄位。不同支付 App 的欄位名稱可能不同，請根據語意推斷：
- merchantName: 商戶全稱 / 收款方 / 商店名稱
- transactionOrderNo: 原交易訂單號 / 訂單號 / 流水號 / 交易單號
- amount: 交易金額 / 支付金額 / 金額
- transactionTime: 實際交易時間 / 付款時間 / 完成時間
- orderStatus: 訂單狀態 / 交易狀態 / 支付狀態
- paymentMethod: 支付方式 / 付款方式 / 扣款帳戶 / 銀行卡或帳戶

辨識規則：
1. 若圖片中明確顯示成功、已完成、交易成功，orderStatus 請標準化成「交易成功」。
2. 若無法確認某欄位，請填 null。
3. amount 請輸出這張圖中最應代表交易總額的金額，若同一張圖有多個金額，優先選擇最大的主金額。不要把折扣後、立減、優惠、補貼、已減、券後價、實付優惠部分當成最終 amount。
4. transactionOrderNo 若看起來像長數字或英數組合訂單號，請完整保留。
5. transactionTime 優先輸出 YYYY-MM-DD HH:mm:ss；若原圖只有部分時間資訊，也請忠實輸出最接近格式。
6. confidence 請輸出 0 到 1 之間的小數，代表整體辨識信心。
7. rawLabels 請保留你在圖片中看到、可對應到上述欄位的原始文字片段。
8. allDetectedAmounts 請列出圖片中所有你能辨識到、看起來像金額的候選值，使用純數字字串陣列，例如 ["30.00","20.00","10.00"]。
9. amountReason 請用一句短語說明你為什麼選這個 amount，例如 "取畫面中最大的交易主金額"。

JSON 格式固定如下：
{
  "merchantName": "表嫂美食",
  "transactionOrderNo": "2026062411365300000010",
  "amount": "300.00",
  "transactionTime": "2026-06-24 11:40:00",
  "orderStatus": "交易成功",
  "paymentMethod": "中國銀行澳門分行(6756)",
  "allDetectedAmounts": ["300.00","280.00"],
  "amountReason": "取畫面中最大的交易主金額",
  "confidence": 0.92,
  "rawLabels": {
    "merchantName": "商戶全稱 : 表嫂美食",
    "transactionOrderNo": "原交易訂單號：2026062411365300000010",
    "amount": "交易金额：300.00",
    "transactionTime": "實際交易時間：2026-06-24 11:40:00",
    "orderStatus": "訂單狀態: 交易成功",
    "paymentMethod": "支付方式 : 中國銀行澳門分行(6756)"
  }
}
`.trim();

function normalizeAIText(content) {
  if (!content) return "{}";
  return content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        merchantName: null,
        transactionOrderNo: null,
        amount: null,
        transactionTime: null,
        orderStatus: null,
        paymentMethod: null,
        allDetectedAmounts: [],
        amountReason: null,
        confidence: 0,
        rawLabels: {},
        parseFallback: text,
      };
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return {
        merchantName: null,
        transactionOrderNo: null,
        amount: null,
        transactionTime: null,
        orderStatus: null,
        paymentMethod: null,
        allDetectedAmounts: [],
        amountReason: null,
        confidence: 0,
        rawLabels: {},
        parseFallback: text,
      };
    }
  }
}

export function toAmountNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dedupeAmountCandidates(values) {
  const normalized = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((value) => value.replace(/[^0-9.]/g, ""))
    .filter(Boolean);

  return [...new Set(normalized)];
}

function extractAmountsFromText(text) {
  if (!text) return [];
  const matches = String(text).match(/\d+(?:\.\d{1,2})/g) || [];
  return matches.filter((value) => Number(value) > 0);
}

function pickLargestAmount(extracted) {
  const rawLabelValues = Object.entries(extracted?.rawLabels || {})
    .filter(([key]) => key.toLowerCase().includes("amount"))
    .flatMap(([, value]) => extractAmountsFromText(value));
  const candidates = dedupeAmountCandidates([
    extracted?.amount,
    ...(Array.isArray(extracted?.allDetectedAmounts) ? extracted.allDetectedAmounts : []),
    ...rawLabelValues,
  ]);

  if (!candidates.length) {
    return {
      amount: extracted?.amount ?? null,
      allDetectedAmounts: [],
    };
  }

  const largest = candidates.reduce((max, current) => {
    return toAmountNumber(current) > toAmountNumber(max) ? current : max;
  }, candidates[0]);

  return {
    amount: largest,
    allDetectedAmounts: candidates,
  };
}

export async function ensureStorageDir() {
  if (HAS_SUPABASE_STORAGE) return;
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function compressImage(file) {
  const dayFolder = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const outputName = `${id}.jpg`;
  const metadata = await sharp(file.buffer).metadata();
  const width = metadata.width && metadata.width > 1024 ? 1024 : metadata.width;

  const compressedBuffer = await sharp(file.buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 55, mozjpeg: true })
    .toBuffer();

  return {
    dayFolder,
    outputName,
    compressedBuffer,
    originalSize: file.size,
    compressedSize: compressedBuffer.length,
  };
}

async function saveCompressedImage(file) {
  const { dayFolder, outputName, compressedBuffer, originalSize, compressedSize } = await compressImage(file);

  if (HAS_SUPABASE_STORAGE && supabase) {
    const objectPath = `${dayFolder}/${outputName}`;
    const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(objectPath, compressedBuffer, {
      contentType: "image/jpeg",
      cacheControl: "1728000",
      upsert: false,
    });

    if (error) {
      throw new Error(`Supabase 儲存失敗：${error.message}`);
    }

    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);

    return {
      compressedBuffer,
      storageUrl: data.publicUrl,
      originalSize,
      compressedSize,
      storageProvider: "supabase",
      objectPath,
    };
  }

  const targetDir = path.join(STORAGE_DIR, dayFolder);
  const outputPath = path.join(targetDir, outputName);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(outputPath, compressedBuffer);

  return {
    compressedBuffer,
    storageUrl: `/storage/${dayFolder}/${outputName}`,
    originalSize,
    compressedSize,
    storageProvider: "local",
    objectPath: `${dayFolder}/${outputName}`,
  };
}

export async function analyzeImage(base64DataUrl) {
  if (!AI_BASE_URL || !AI_API_KEY) {
    throw new Error("AI 設定未完成，請先設定 API Host 與 API Key");
  }

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: extractionPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "請辨識這張付款交易截圖，並依照指定 JSON 格式回傳。",
            },
            {
              type: "image_url",
              image_url: {
                url: base64DataUrl,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 辨識失敗：${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  return safeJsonParse(normalizeAIText(content));
}

export function getHealthPayload() {
  return {
    ok: true,
    storageProvider: HAS_SUPABASE_STORAGE ? "supabase" : "local",
    hasAiConfig: Boolean(AI_BASE_URL && AI_API_KEY),
  };
}

function normalizeAnalyzedItem(extracted, file, index, extras = {}) {
  const normalizedAmount = pickLargestAmount(extracted);
  return {
    id: extras.id || crypto.randomUUID(),
    index,
    fileName: file.originalname,
    previewUrl: extras.previewUrl || null,
    originalSize: extras.originalSize ?? file.size,
    compressedSize: extras.compressedSize ?? null,
    storageProvider: extras.storageProvider || null,
    storagePath: extras.storagePath || null,
    compressionRatio:
      extras.originalSize && extras.compressedSize
        ? Number((extras.compressedSize / extras.originalSize).toFixed(4))
        : null,
    extracted: {
      merchantName: extracted.merchantName ?? null,
      transactionOrderNo: extracted.transactionOrderNo ?? null,
      amount: normalizedAmount.amount ?? null,
      transactionTime: extracted.transactionTime ?? null,
      orderStatus: extracted.orderStatus ?? null,
      paymentMethod: extracted.paymentMethod ?? null,
      allDetectedAmounts: normalizedAmount.allDetectedAmounts,
      amountReason: extracted.amountReason ?? "取候選金額中的最大值",
      confidence: extracted.confidence ?? null,
      rawLabels: extracted.rawLabels ?? {},
    },
  };
}

function buildBatchPayload(items, memberCode = "") {
  const totalAmount = items.reduce((sum, item) => sum + toAmountNumber(item.extracted.amount), 0);
  return {
    memberCode: memberCode || null,
    count: items.length,
    totalAmount: totalAmount.toFixed(2),
    storageProvider: HAS_SUPABASE_STORAGE ? "supabase" : "local",
    items,
  };
}

function extractTransactionOrderNos(items = []) {
  return [...new Set(items.map((item) => item?.extracted?.transactionOrderNo).filter(Boolean).map(String))];
}

function normalizeCompareText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isAbnormalExtractedItem(extracted = {}) {
  const missingKeys = ["merchantName", "transactionOrderNo", "amount", "transactionTime"].filter(
    (key) => !String(extracted?.[key] || "").trim()
  );

  return {
    isAbnormal: missingKeys.length > 0,
    missingKeys,
  };
}

export async function findDuplicateTransactionOrderNos(orderNos = []) {
  const normalizedOrderNos = [...new Set(orderNos.filter(Boolean).map(String))];
  if (!normalizedOrderNos.length || !supabase) {
    return [];
  }

  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("transactions")
    .select("id, customer_code, shop_id, items")
    .or("status.eq.pending,status.eq.approved,status.eq.rejected");

  if (error) {
    throw new Error(`檢查重複訂單失敗：${error.message}`);
  }

  const duplicated = new Set();
  for (const row of data || []) {
    for (const item of row.items || []) {
      const orderNo = item?.extracted?.transactionOrderNo;
      if (orderNo && normalizedOrderNos.includes(String(orderNo))) {
        duplicated.add(String(orderNo));
      }
    }
  }

  return [...duplicated];
}

export async function analyzeUploadedFiles(files, memberCode = "") {
  const items = await Promise.all(
    files.map(async (file, index) => {
      const { compressedBuffer, originalSize, compressedSize } = await compressImage(file);
      const base64DataUrl = `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`;
      const extracted = await analyzeImage(base64DataUrl);
      return normalizeAnalyzedItem(extracted, file, index, {
        originalSize,
        compressedSize,
      });
    })
  );

  const payload = buildBatchPayload(items, memberCode);
  const duplicateTransactionOrderNos = await findDuplicateTransactionOrderNos(extractTransactionOrderNos(items));
  return {
    ...payload,
    duplicateTransactionOrderNos,
    hasDuplicates: duplicateTransactionOrderNos.length > 0,
  };
}

function ensureDatabaseReady() {
  if (!supabase) {
    throw new Error("Supabase 尚未設定完成");
  }
  return supabase;
}

export async function listShops() {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("shops")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(`讀取店舖失敗：${error.message}`);
  return data || [];
}

export async function findOwnerByLogin(login) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("shops")
    .select("id, code, name, owner_login, owner_password, is_active")
    .eq("owner_login", login)
    .maybeSingle();

  if (error) throw new Error(`讀取店主帳號失敗：${error.message}`);
  if (data) return data;

  if (String(login) === DEFAULT_OWNER_CODE) {
    const { data: shopByName } = await client
      .from("shops")
      .select("id, code, name, is_active")
      .eq("name", DEFAULT_OWNER_SHOP_NAME)
      .maybeSingle();

    if (shopByName) {
      return {
        ...shopByName,
        owner_login: DEFAULT_OWNER_CODE,
        owner_password: DEFAULT_OWNER_PASSWORD,
      };
    }
  }

  return null;
}

export async function findCustomerByCode(code) {
  const normalizedCode = String(code || "").trim();
  const client = ensureDatabaseReady();

  try {
    const { data, error } = await client
      .from("customer_accounts")
      .select("code, password, is_active")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  } catch {
    if (normalizedCode === DEFAULT_CUSTOMER_CODE) {
      return {
        code: DEFAULT_CUSTOMER_CODE,
        password: DEFAULT_CUSTOMER_PASSWORD,
        is_active: true,
      };
    }
  }

  return null;
}

export async function getShopById(shopId) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("shops")
    .select("id, code, name")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(`讀取店舖失敗：${error.message}`);
  return data;
}

export async function createTransactionSubmission({ shopId, customerCode, files, analyzedItems }) {
  const client = ensureDatabaseReady();
  await ensureStorageDir();

  const duplicateTransactionOrderNos = await findDuplicateTransactionOrderNos(
    extractTransactionOrderNos(analyzedItems)
  );
  if (duplicateTransactionOrderNos.length) {
    throw new Error("duplicated record, please reupload.");
  }

  const shop = await getShopById(shopId);
  if (!shop) {
    throw new Error("店舖不存在");
  }

  const items = await Promise.all(
    files.map(async (file, index) => {
      const analyzed = analyzedItems[index] || {};
      const saved = await saveCompressedImage(file);
      const merchantName = analyzed?.extracted?.merchantName || "";
      const shopName = shop.name || "";
      const normalizedMerchant = normalizeCompareText(merchantName);
      const normalizedShop = normalizeCompareText(shopName);
      const shopMismatch =
        normalizedMerchant && normalizedShop
          ? !normalizedMerchant.includes(normalizedShop) && !normalizedShop.includes(normalizedMerchant)
          : false;
      const abnormalInfo = isAbnormalExtractedItem(analyzed?.extracted || {});

      return {
        ...analyzed,
        previewUrl: saved.storageUrl,
        originalSize: saved.originalSize,
        compressedSize: saved.compressedSize,
        storageProvider: saved.storageProvider,
        storagePath: saved.objectPath,
        compressionRatio: saved.originalSize
          ? Number((saved.compressedSize / saved.originalSize).toFixed(4))
          : null,
        validation: {
          isShopMismatch: shopMismatch,
          expectedShopName: shopName,
          detectedMerchantName: merchantName || null,
          isAbnormal: abnormalInfo.isAbnormal,
          missingKeys: abnormalInfo.missingKeys,
        },
      };
    })
  );

  const totalAmount = items.reduce((sum, item) => sum + toAmountNumber(item?.extracted?.amount), 0);
  const hasShopMismatch = items.some((item) => item?.validation?.isShopMismatch);

  const insertPayload = {
    shop_id: shopId,
    customer_code: customerCode,
    total_amount: totalAmount.toFixed(2),
    item_count: items.length,
    status: hasShopMismatch ? "rejected" : "pending",
    items,
  };

  const { data, error } = await client
    .from("transactions")
    .insert(insertPayload)
    .select("id, status, submitted_at")
    .single();

  if (error) {
    throw new Error(`儲存交易失敗：${error.message}`);
  }

  return {
    transactionId: data.id,
    status: data.status,
    submittedAt: data.submitted_at,
    totalAmount: totalAmount.toFixed(2),
    items,
    hasShopMismatch,
  };
}

function applyTransactionFilters(query, { shopId, mode = "pending", from, to }) {
  let nextQuery = query.eq("shop_id", shopId);

  if (mode === "pending") {
    nextQuery = nextQuery.eq("status", "pending");
  } else if (mode === "history") {
    nextQuery = nextQuery.in("status", ["approved", "rejected"]);
  }

  if (from) {
    nextQuery = nextQuery.gte("submitted_at", `${from}T00:00:00`);
  }
  if (to) {
    nextQuery = nextQuery.lte("submitted_at", `${to}T23:59:59`);
  }

  return nextQuery;
}

export async function listTransactions({ shopId, mode = "pending", from, to, page = 1, pageSize = 20 }) {
  const client = ensureDatabaseReady();
  const normalizedPage = Math.max(1, Number(page) || 1);
  const useAll = String(pageSize) === "all";
  const normalizedPageSize = useAll ? "all" : Math.max(1, Number(pageSize) || 20);

  let query = applyTransactionFilters(
    client.from("transactions").select("*", { count: "exact" }).order("submitted_at", { ascending: false }),
    { shopId, mode, from, to }
  );

  if (!useAll) {
    const fromIndex = (normalizedPage - 1) * normalizedPageSize;
    const toIndex = fromIndex + normalizedPageSize - 1;
    query = query.range(fromIndex, toIndex);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`讀取交易列表失敗：${error.message}`);

  return {
    rows: data || [],
    total: count || 0,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    pageCount: useAll ? 1 : Math.max(1, Math.ceil((count || 0) / normalizedPageSize)),
  };
}

async function updateTransactionsStatus({ shopId, transactionIds, status, actor }) {
  const client = ensureDatabaseReady();
  const approvedAt = status === "approved" ? new Date().toISOString() : null;
  const { data, error } = await client
    .from("transactions")
    .update({
      status,
      approved_at: approvedAt,
      approved_by: approvedAt ? actor : null,
    })
    .eq("shop_id", shopId)
    .eq("status", "pending")
    .in("id", transactionIds)
    .select("id, status, approved_at");

  if (error) {
    throw new Error(`${status === "approved" ? "核准" : "拒絕"}交易失敗：${error.message}`);
  }
  return data;
}

export async function approveTransaction({ shopId, transactionId, ownerLogin }) {
  const rows = await updateTransactionsStatus({
    shopId,
    transactionIds: [transactionId],
    status: "approved",
    actor: ownerLogin,
  });
  return rows?.[0] || null;
}

export async function batchApproveTransactions({ shopId, transactionIds, ownerLogin }) {
  return updateTransactionsStatus({
    shopId,
    transactionIds,
    status: "approved",
    actor: ownerLogin,
  });
}

export async function rejectTransaction({ shopId, transactionId }) {
  const rows = await updateTransactionsStatus({
    shopId,
    transactionIds: [transactionId],
    status: "rejected",
    actor: null,
  });
  return rows?.[0] || null;
}

export async function revokeRejectedTransaction({ shopId, transactionId }) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("transactions")
    .update({
      status: "pending",
      approved_at: null,
      approved_by: null,
    })
    .eq("shop_id", shopId)
    .eq("id", transactionId)
    .eq("status", "rejected")
    .select("id, status")
    .single();

  if (error) throw new Error(`撤回拒絕失敗：${error.message}`);
  return data;
}

export async function getDashboardStats({ shopId, from, to }) {
  const { rows } = await listTransactions({ shopId, mode: "all", from, to, pageSize: "all" });
  const customerSet = new Set(rows.map((row) => row.customer_code).filter(Boolean));
  const approvedRows = rows.filter((row) => row.status === "approved");
  const rejectedRows = rows.filter((row) => row.status === "rejected");

  return {
    uploadCount: rows.length,
    customerCount: customerSet.size,
    totalAmount: rows.reduce((sum, row) => sum + toAmountNumber(row.total_amount), 0).toFixed(2),
    approvedCount: approvedRows.length,
    approvedAmount: approvedRows.reduce((sum, row) => sum + toAmountNumber(row.total_amount), 0).toFixed(2),
    rejectedCount: rejectedRows.length,
  };
}

export async function getOwnerSettings(shopId) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("shops")
    .select("id, auto_approve_enabled, auto_approve_interval_minutes")
    .eq("id", shopId)
    .single();

  if (error) throw new Error(`讀取店舖設定失敗：${error.message}`);
  return data;
}

export async function updateOwnerSettings({ shopId, autoApproveEnabled }) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("shops")
    .update({
      auto_approve_enabled: autoApproveEnabled,
      auto_approve_interval_minutes: 5,
    })
    .eq("id", shopId)
    .select("id, auto_approve_enabled, auto_approve_interval_minutes")
    .single();

  if (error) throw new Error(`更新店舖設定失敗：${error.message}`);
  return data;
}

export async function runAutoApprovalSweep() {
  const client = ensureDatabaseReady();
  const { data: shops, error } = await client
    .from("shops")
    .select("id, owner_login")
    .eq("is_active", true)
    .eq("auto_approve_enabled", true);

  if (error) throw new Error(`讀取自動核准設定失敗：${error.message}`);

  let approvedCount = 0;
  for (const shop of shops || []) {
    const { data: rows, error: updateError } = await client
      .from("transactions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: shop.owner_login || "auto-approve",
      })
      .eq("shop_id", shop.id)
      .eq("status", "pending")
      .select("id");

    if (updateError) {
      throw new Error(`自動核准失敗：${updateError.message}`);
    }
    approvedCount += rows?.length || 0;
  }

  return {
    shopCount: shops?.length || 0,
    approvedCount,
  };
}

export function normalizeMemberCode(value) {
  return String(value || "").trim();
}

export function applyCors(req, res) {
  const origin = req.headers.origin || "https://top-up-automation.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
