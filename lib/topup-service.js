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
3. amount 請盡量輸出純數字字串，例如 "300.00"。
4. transactionOrderNo 若看起來像長數字或英數組合訂單號，請完整保留。
5. transactionTime 優先輸出 YYYY-MM-DD HH:mm:ss；若原圖只有部分時間資訊，也請忠實輸出最接近格式。
6. confidence 請輸出 0 到 1 之間的小數，代表整體辨識信心。
7. rawLabels 請保留你在圖片中看到、可對應到上述欄位的原始文字片段。

JSON 格式固定如下：
{
  "merchantName": "表嫂美食",
  "transactionOrderNo": "2026062411365300000010",
  "amount": "300.00",
  "transactionTime": "2026-06-24 11:40:00",
  "orderStatus": "交易成功",
  "paymentMethod": "中國銀行澳門分行(6756)",
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

export async function ensureStorageDir() {
  if (HAS_SUPABASE_STORAGE) return;
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function compressImage(file) {
  const dayFolder = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const outputName = `${id}.jpg`;
  const metadata = await sharp(file.buffer).metadata();
  const width = metadata.width && metadata.width > 1600 ? 1600 : metadata.width;

  const compressedBuffer = await sharp(file.buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
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
      max_tokens: 1200,
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

export async function processUploadedFiles(files, memberCode = "") {
  await ensureStorageDir();

  const items = await Promise.all(
    files.map(async (file, index) => {
      const { compressedBuffer, storageUrl, originalSize, compressedSize, storageProvider, objectPath } =
        await saveCompressedImage(file);
      const base64DataUrl = `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`;
      const extracted = await analyzeImage(base64DataUrl);

      return {
        id: crypto.randomUUID(),
        index,
        fileName: file.originalname,
        previewUrl: storageUrl,
        originalSize,
        compressedSize,
        storageProvider,
        storagePath: objectPath,
        compressionRatio: originalSize ? Number((compressedSize / originalSize).toFixed(4)) : 1,
        extracted: {
          merchantName: extracted.merchantName ?? null,
          transactionOrderNo: extracted.transactionOrderNo ?? null,
          amount: extracted.amount ?? null,
          transactionTime: extracted.transactionTime ?? null,
          orderStatus: extracted.orderStatus ?? null,
          paymentMethod: extracted.paymentMethod ?? null,
          confidence: extracted.confidence ?? null,
          rawLabels: extracted.rawLabels ?? {},
        },
      };
    })
  );

  const totalAmount = items.reduce((sum, item) => sum + toAmountNumber(item.extracted.amount), 0);

  return {
    memberCode: memberCode || null,
    count: items.length,
    totalAmount: totalAmount.toFixed(2),
    storageProvider: HAS_SUPABASE_STORAGE ? "supabase" : "local",
    items,
  };
}

export function normalizeMemberCode(value) {
  return String(value || "").trim();
}
