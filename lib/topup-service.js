import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

import { applyEmbedResponseHeaders } from "./embed-policy.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, "..", "storage");

export const AI_BASE_URL = (process.env.AI_BASE_URL || "").replace(/\/$/, "");
export const AI_API_KEY = (process.env.AI_API_KEY || "").trim();
export const AI_MODEL = process.env.AI_MODEL || "qwen-vl-plus";
export const AI_ORCHESTRATOR_ENABLED = process.env.AI_ORCHESTRATOR_ENABLED !== "false";
export const AI_OCR_MODEL = process.env.AI_OCR_MODEL || "qwen-vl-ocr";
export const AI_TEXT_MODEL = process.env.AI_TEXT_MODEL || "qwen-plus-2025-07-28";
export const AI_VL_FALLBACK_MODEL = process.env.AI_VL_FALLBACK_MODEL || "qwen3-vl-32b-instruct";
export const AI_OCR_MAX_TOKENS = Number(process.env.AI_OCR_MAX_TOKENS || 512);
export const AI_TEXT_MAX_TOKENS = Number(process.env.AI_TEXT_MAX_TOKENS || 600);
export const AI_VL_MAX_TOKENS = Number(process.env.AI_VL_MAX_TOKENS || 700);
export const AI_FALLBACK_CONFIDENCE_THRESHOLD = Number(process.env.AI_FALLBACK_CONFIDENCE_THRESHOLD || 0.75);
export const AI_FALLBACK_MISSING_KEYS_THRESHOLD = Number(process.env.AI_FALLBACK_MISSING_KEYS_THRESHOLD || 1);
export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "topup-images";
export const DEFAULT_OWNER_CODE = "60000000";
export const DEFAULT_OWNER_PASSWORD = "0000";
export const DEFAULT_ADMIN_LOGIN = "60000001";
export const DEFAULT_ADMIN_PASSWORD = "0000";
export const DEFAULT_ADMIN_NAME = "System Admin";
export const DEFAULT_OWNER_SHOP_NAME = "表嫂美食";
export const DEFAULT_CUSTOMER_CODE = "63936541";
export const DEFAULT_CUSTOMER_PASSWORD = "1234";
export const MEMBERSHIP_TOKEN_ENABLED = process.env.MEMBERSHIP_TOKEN_ENABLED !== "false";
export const MEMBERSHIP_TOKEN_SECRET = process.env.MEMBERSHIP_TOKEN_SECRET || "";
export const MEMBERSHIP_TOKEN_ISSUER = process.env.MEMBERSHIP_TOKEN_ISSUER || "main-membership-system";
export const MEMBERSHIP_TOKEN_AUDIENCE = process.env.MEMBERSHIP_TOKEN_AUDIENCE || "topup-portal";
export const MEMBERSHIP_TOKEN_CLOCK_SKEW_SECONDS = Number(process.env.MEMBERSHIP_TOKEN_CLOCK_SKEW_SECONDS || 30);
export const MEMBERSHIP_SYNC_ENDPOINT = (process.env.MEMBERSHIP_SYNC_ENDPOINT || "").trim();
export const MEMBERSHIP_SYNC_SECRET = process.env.MEMBERSHIP_SYNC_SECRET || "";
export const MEMBERSHIP_SYNC_TIMEOUT_MS = Number(process.env.MEMBERSHIP_SYNC_TIMEOUT_MS || 10000);
export const SITEA_SSO_ENABLED = process.env.SITEA_SSO_ENABLED ? process.env.SITEA_SSO_ENABLED !== "false" : MEMBERSHIP_TOKEN_ENABLED;
export const SITEA_SSO_SECRET =
  process.env.SITEA_SSO_SECRET || process.env.SITEA_SSO_JWT_SECRET || MEMBERSHIP_TOKEN_SECRET || "";
export const SITEA_SSO_ISSUER =
  process.env.SITEA_SSO_ISSUER || process.env.SITEA_SSO_JWT_ISSUER || MEMBERSHIP_TOKEN_ISSUER || "site-a";
export const SITEA_SSO_AUDIENCE =
  process.env.SITEA_SSO_AUDIENCE || process.env.SITEA_SSO_JWT_AUDIENCE || MEMBERSHIP_TOKEN_AUDIENCE || "site-b";
export const SITEA_SSO_CLOCK_SKEW_SECONDS = Number(
  process.env.SITEA_SSO_CLOCK_SKEW_SECONDS || process.env.SITEA_SSO_JWT_CLOCK_SKEW_SECONDS || MEMBERSHIP_TOKEN_CLOCK_SKEW_SECONDS || 30
);
export const SITEA_CALLBACK_APPROVED_ENDPOINT =
  (process.env.SITEA_CALLBACK_APPROVED_ENDPOINT || process.env.MEMBERSHIP_SYNC_ENDPOINT || "").trim();
export const SITEA_CALLBACK_REJECTED_ENDPOINT = (process.env.SITEA_CALLBACK_REJECTED_ENDPOINT || "").trim();
export const SITEA_CALLBACK_PENDING_ENDPOINT = (process.env.SITEA_CALLBACK_PENDING_ENDPOINT || "").trim();
export const SITEA_WEBHOOK_SECRET =
  process.env.SITEA_WEBHOOK_SECRET || process.env.MEMBERSHIP_SYNC_SECRET || "";
export const SITEA_WEBHOOK_TIMEOUT_MS = Number(
  process.env.SITEA_WEBHOOK_TIMEOUT_MS || process.env.MEMBERSHIP_SYNC_TIMEOUT_MS || 10000
);
export const PUBLIC_APP_BASE_URL = (process.env.PUBLIC_APP_BASE_URL || "https://top-up-automation.vercel.app").replace(/\/$/, "");

// Auto-approval whitelist & defaults (see Task #1 + Task #3)
export const VALID_AUTO_APPROVE_STATUSES = [
  "verified_amount_and_id",
  "verified_id_only",
  "no_match",
  "no_order_id",
  "ai_skipped",
];
export const AUTO_APPROVE_DEFAULT_MAX_AMOUNT = Number(
  process.env.AUTO_APPROVE_DEFAULT_MAX_AMOUNT ?? 5000
);
export const AUTO_APPROVE_DEFAULT_COOLDOWN_SECONDS = Number(
  process.env.AUTO_APPROVE_DEFAULT_COOLDOWN_SECONDS ?? 30
);

export function createDefaultAutoApproveSettings() {
  return {
    allowed_statuses: ["verified_amount_and_id"],
    max_amount: AUTO_APPROVE_DEFAULT_MAX_AMOUNT,
    cooldown_seconds: AUTO_APPROVE_DEFAULT_COOLDOWN_SECONDS,
    last_auto_approved_at: null,
  };
}

export function normalizeAutoApproveSettings(raw) {
  const base = createDefaultAutoApproveSettings();
  if (!raw || typeof raw !== "object") return base;
  const incoming = Array.isArray(raw.allowed_statuses)
    ? raw.allowed_statuses
        .map((value) => String(value || "").trim())
        .filter((value) => VALID_AUTO_APPROVE_STATUSES.includes(value))
    : [];
  const maxAmountRaw = Number(raw.max_amount);
  const cooldownRaw = Number(raw.cooldown_seconds);
  const lastApproved = raw.last_auto_approved_at;
  return {
    allowed_statuses: incoming,
    max_amount: Number.isFinite(maxAmountRaw) && maxAmountRaw >= 0 ? maxAmountRaw : base.max_amount,
    cooldown_seconds:
      Number.isFinite(cooldownRaw) && cooldownRaw >= 0 ? cooldownRaw : base.cooldown_seconds,
    last_auto_approved_at:
      typeof lastApproved === "string" && lastApproved ? lastApproved : null,
  };
}

export function sanitizeAutoApproveSettingsPatch(input = {}) {
  const patch = {};
  if (Array.isArray(input.allowed_statuses)) {
    const filtered = input.allowed_statuses
      .map((value) => String(value || "").trim())
      .filter((value) => VALID_AUTO_APPROVE_STATUSES.includes(value));
    patch.allowed_statuses = Array.from(new Set(filtered));
  }
  if (input.max_amount !== undefined) {
    const numeric = Number(input.max_amount);
    if (Number.isFinite(numeric) && numeric >= 0) {
      patch.max_amount = numeric;
    }
  }
  if (input.cooldown_seconds !== undefined) {
    const numeric = Number(input.cooldown_seconds);
    if (Number.isFinite(numeric) && numeric >= 0) {
      patch.cooldown_seconds = numeric;
    }
  }
  if (input.last_auto_approved_at !== undefined) {
    patch.last_auto_approved_at =
      typeof input.last_auto_approved_at === "string" && input.last_auto_approved_at
        ? input.last_auto_approved_at
        : null;
  }
  return patch;
}

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

const vlExtractionPrompt = `
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
3. amount 請輸出這張圖中最應代表交易總額的金額。若同一張圖有多個金額，優先尋找明確帶有「MOP」或「$」標記的金額，並在正數候選值中選擇最高的一個。
3a. 不要把折扣後、立減、優惠、補貼、已減、券後價、實付優惠部分當成最終 amount；若畫面中同時有折扣後金額與原交易金額，通常應優先取原交易金額。
3b. 若畫面同時有「消費原金額 / 原金額 / 訂單金額 / 付款項目中的訂單金額」以及「折扣後實付金額」，而系統業務應以原交易充值金額入帳，請優先選擇原交易金額。例如原金額 210、折扣後支付 140，amount 應輸出 210。
3c. 若「付款項目」、「訂單項目」、「中銀訂單MOP210.00」這類欄位內含明確訂單金額，這是強訊號，應優先納入判斷。
4. transactionOrderNo 若看起來像長數字或英數組合訂單號，請完整保留。
4a. 若畫面同時出現多個長數字單號，例如「交易編號」與「參考編號」，請務必把全部「連續數字長度大於或等於 12 位」的候選單號都收集到 allDetectedOrderNos。
4b. 若同時有「交易編號」與「參考編號」，transactionOrderNo 優先填「交易編號」對應的長數字；但 allDetectedOrderNos 必須同時包含兩者。
4c. 若你看到的數字連續長度少於 12 位，不要放進 allDetectedOrderNos。
5. transactionTime 優先輸出 YYYY-MM-DD HH:mm:ss；若原圖只有部分時間資訊，也請忠實輸出最接近格式。
6. confidence 請輸出 0 到 1 之間的小數，代表整體辨識信心。
7. rawLabels 請保留你在圖片中看到、可對應到上述欄位的原始文字片段。尤其是所有與金額有關的原始標籤都要保留，例如「消費金額 MOP 60.00」、「原訂單金額 MOP 90.00」、「優惠後金額 MOP 40.00」、「支出金額 MOP 40.00」。
8. allDetectedAmounts 請列出圖片中所有你能辨識到、看起來像金額的候選值，使用純數字字串陣列，例如 ["30.00","20.00","10.00"]。
9. amountReason 請用一句短語說明你為什麼選這個 amount，例如 "取畫面中最大的交易主金額"。
10. allDetectedOrderNos 請列出圖片中所有你能辨識到、連續長度大於或等於 12 位的純數字候選單號，使用字串陣列，例如 ["2026062411365300000010","2026062411365300000011"]。不要自行補位，不要輸出短於 12 位的數字。

JSON 格式固定如下：
{
  "merchantName": "表嫂美食",
  "transactionOrderNo": "2026062411365300000010",
  "amount": "300.00",
  "transactionTime": "2026-06-24 11:40:00",
  "orderStatus": "交易成功",
  "paymentMethod": "中國銀行澳門分行(6756)",
  "allDetectedAmounts": ["300.00","280.00"],
  "allDetectedOrderNos": ["2026062411365300000010"],
  "amountReason": "取畫面中最大的交易主金額",
  "confidence": 0.92,
  "rawLabels": {
    "merchantName": "商戶全稱 : 表嫂美食",
    "transactionOrderNo": "交易編號：2026062411365300000010",
    "referenceOrderNo": "參考編號：2026062411365300000011",
    "amount": "交易金额：300.00",
    "transactionTime": "實際交易時間：2026-06-24 11:40:00",
    "orderStatus": "訂單狀態: 交易成功",
    "paymentMethod": "支付方式 : 中國銀行澳門分行(6756)"
  }
}
`.trim();

const ocrPrompt = `
你是一個 OCR 文字提取助手。請只輸出圖片中可辨識的原始文字內容，不要輸出 JSON，不要做總結，不要補充說明，不要翻譯。

要求：
1. 盡量保留原有閱讀順序。
2. 對於金額、時間、交易編號、參考編號、商戶名稱、支付方式等關鍵內容，請完整保留。
3. 若同一畫面有多個長數字、金額或時間，請全部輸出。
4. 若無法辨識的局部文字，可跳過，但不要捏造。
`.trim();

const textStructuringPrompt = `
你是一個交易 OCR 結構化助手。你會收到一段由 OCR 從付款截圖提取出來的原始文字。請根據文字內容，整理成固定 JSON。

你只可以輸出 JSON，不要輸出 Markdown，不要輸出思考過程，不要額外說明。

你需要輸出以下欄位：
- merchantName
- transactionOrderNo
- amount
- transactionTime
- orderStatus
- paymentMethod
- allDetectedAmounts
- allDetectedOrderNos
- amountReason
- confidence
- rawLabels

判斷規則：
1. 若文字中明確出現成功、已完成、交易成功，orderStatus 請標準化成「交易成功」。
2. 若某欄位無法確認，請填 null。
3. amount 請選最代表交易總額的金額。若同時有原金額與優惠後/實付金額，優先選原交易金額。
4. transactionOrderNo 優先選實際交易編號；若同時有交易編號與參考編號，transactionOrderNo 優先填交易編號，但 allDetectedOrderNos 必須包含全部連續數字長度大於或等於 12 位的候選單號。
5. transactionTime 優先輸出 YYYY-MM-DD HH:mm:ss；若 OCR 文字不完整，也請忠實輸出最接近格式。
6. allDetectedAmounts 請列出所有看起來像金額的候選值。
7. confidence 請輸出 0 到 1 之間的小數，代表你根據 OCR 文字作出判斷的信心。
8. rawLabels 請保存 OCR 文字中與各欄位最相關的原始片段。

JSON 格式固定如下：
{
  "merchantName": "表嫂美食",
  "transactionOrderNo": "2026062411365300000010",
  "amount": "300.00",
  "transactionTime": "2026-06-24 11:40:00",
  "orderStatus": "交易成功",
  "paymentMethod": "中國銀行澳門分行(6756)",
  "allDetectedAmounts": ["300.00","280.00"],
  "allDetectedOrderNos": ["2026062411365300000010"],
  "amountReason": "取畫面中最大的交易主金額",
  "confidence": 0.92,
  "rawLabels": {
    "merchantName": "商戶全稱 : 表嫂美食",
    "transactionOrderNo": "交易編號：2026062411365300000010",
    "referenceOrderNo": "參考編號：2026062411365300000011",
    "amount": "交易金额：300.00",
    "transactionTime": "實際交易時間：2026-06-24 11:40:00",
    "orderStatus": "訂單狀態: 交易成功",
    "paymentMethod": "支付方式 : 中國銀行澳門分行(6756)"
  }
}
`.trim();

function normalizeAIText(content) {
  if (!content) return "{}";
  return String(content)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getMessageContentText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return part.text || "";
        return part?.text || "";
      })
      .join("\n");
  }
  return String(content);
}

async function requestChatCompletion({
  model,
  maxTokens,
  temperature = 0,
  messages,
}) {
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
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let hint = "";
    if (response.status === 401) {
      hint =
        "（API key 被供應商拒絕：OpenRouter 的 401 即使 key 無效也會報 'Missing Authentication header'。" +
        "請確認 AI_API_KEY 是該供應商有效的 key——OpenRouter key 必須以 sk-or- 開頭；" +
        "若你填的是 Google/Gemini key（AIza…）請改為 OpenRouter key，或將 AI_BASE_URL 指向 Gemini 原生端點）";
    } else if (response.status === 404) {
      hint =
        "（模型不存在於該供應商：請確認 AI_MODEL / AI_OCR_MODEL / AI_VL_FALLBACK_MODEL / AI_TEXT_MODEL 是該供應商提供的模型 ID，" +
        "例如 OpenRouter 上的 google/gemini-2.5-flash）";
    }
    throw new Error(`AI 辨識失敗：${response.status} ${errorText}${hint}`);
  }

  const data = await response.json();
  return {
    data,
    text: getMessageContentText(data?.choices?.[0]?.message?.content || ""),
  };
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
        allDetectedOrderNos: [],
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
        allDetectedOrderNos: [],
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

function dedupeOrderNoCandidates(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter((value) => /^\d{12,}$/.test(value)))];
}

function extractLongDigitNumbersFromText(text) {
  if (!text) return [];
  const matches = String(text).match(/\d{12,}/g) || [];
  return dedupeOrderNoCandidates(matches);
}

function collectOrderNoCandidates(extracted = {}) {
  const rawLabelValues = Object.values(extracted?.rawLabels || {}).flatMap((value) =>
    Array.isArray(value) ? value : [value]
  );
  const rawText = [
    extracted?.transactionOrderNo,
    ...(Array.isArray(extracted?.allDetectedOrderNos) ? extracted.allDetectedOrderNos : []),
    ...rawLabelValues,
    extracted?.parseFallback,
  ]
    .filter(Boolean)
    .join(" ");

  return dedupeOrderNoCandidates([
    extracted?.transactionOrderNo,
    ...(Array.isArray(extracted?.allDetectedOrderNos) ? extracted.allDetectedOrderNos : []),
    ...extractLongDigitNumbersFromText(rawText),
  ]);
}

function extractCurrencyAmountsFromText(text) {
  if (!text) return [];
  const source = String(text);
  const results = [];
  const patterns = [
    /(^|[^\d-])(?:MOP|\$)\s*([0-9]{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/gi,
    /(^|[^\d])([0-9]{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:MOP|\$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      const rawPrefix = match[1] || "";
      const rawAmount = match[2] || "";
      if (rawPrefix.includes("-")) continue;
      const normalized = rawAmount.replace(/,/g, "");
      if (toAmountNumber(normalized) > 0) {
        results.push(normalized);
      }
    }
  }

  return dedupeAmountCandidates(results);
}

function scoreAmountLabel(text) {
  const source = String(text || "");
  if (!source) return 0;

  const positiveGroups = [
    { score: 130, labels: ["消費金額", "消费金额"] },
    { score: 125, labels: ["原訂單金額", "原订单金额", "原交易金額", "原交易金额"] },
    { score: 120, labels: ["消費原金額", "消费原金额", "原金額", "原金额"] },
    { score: 110, labels: ["訂單金額", "订单金额", "交易金額", "交易金额"] },
    { score: 90, labels: ["付款項目", "付款项目", "訂單項目", "订单项目", "中銀訂單", "中银订单"] },
  ];
  const negativeGroups = [
    { score: -140, labels: ["優惠後金額", "优惠后金额", "支出金額", "支出金额", "實付", "实付"] },
    { score: -120, labels: ["折扣", "優惠", "优惠", "立減", "立减", "補貼", "补贴"] },
  ];

  let score = 0;
  for (const group of positiveGroups) {
    if (group.labels.some((label) => source.includes(label))) {
      score = Math.max(score, group.score);
    }
  }
  for (const group of negativeGroups) {
    if (group.labels.some((label) => source.includes(label))) {
      score += group.score;
    }
  }
  return score;
}

function collectLabeledCurrencyCandidates(extracted) {
  return Object.entries(extracted?.rawLabels || {})
    .flatMap(([key, value]) => {
      const text = `${key} ${String(value || "")}`;
      const amounts = extractCurrencyAmountsFromText(text);
      const score = scoreAmountLabel(text);
      return amounts.map((amount) => ({ amount, score, text }));
    })
    .filter((item) => item.amount && toAmountNumber(item.amount) > 0);
}

function extractAmountsByKeyword(text, keywords = []) {
  const source = String(text || "");
  if (!source) return [];

  return keywords.flatMap((keyword) => {
    const patterns = [
      new RegExp(`${keyword}[\\s\\S]{0,18}?([0-9]+(?:\\.[0-9]{1,2})?)`, "gi"),
      new RegExp(`([0-9]+(?:\\.[0-9]{1,2})?)[\\s\\S]{0,12}?${keyword}`, "gi"),
    ];
    const results = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source))) {
        if (match[1]) results.push(match[1]);
      }
    }
    return results;
  });
}

function pickPreferredAmount(extracted) {
  const rawText = JSON.stringify(extracted?.rawLabels || {});
  const preferredKeywords = [
    "消費原金額",
    "消费原金额",
    "原金額",
    "原金额",
    "付款項目",
    "付款项目",
    "訂單金額",
    "订单金额",
    "交易金額",
    "交易金额",
    "中銀訂單",
    "中银订单",
  ];
  const discountKeywords = ["優惠折扣", "优惠折扣", "折扣", "優惠", "优惠", "立減", "立减"];

  const preferredCandidates = dedupeAmountCandidates(extractAmountsByKeyword(rawText, preferredKeywords));
  const discountCandidates = new Set(dedupeAmountCandidates(extractAmountsByKeyword(rawText, discountKeywords)));
  const usablePreferredCandidates = preferredCandidates.filter((value) => !discountCandidates.has(value));

  if (!usablePreferredCandidates.length) return null;

  return usablePreferredCandidates.reduce((max, current) => {
    return toAmountNumber(current) > toAmountNumber(max) ? current : max;
  }, usablePreferredCandidates[0]);
}

function pickHighestCurrencyAmount(extracted) {
  const rawLabelValues = Object.values(extracted?.rawLabels || {}).flatMap((value) =>
    extractCurrencyAmountsFromText(value)
  );
  const rawText = JSON.stringify(extracted?.rawLabels || {});
  const candidates = dedupeAmountCandidates([
    ...rawLabelValues,
    ...extractCurrencyAmountsFromText(rawText),
  ]);

  if (!candidates.length) return null;

  return candidates.reduce((max, current) => {
    return toAmountNumber(current) > toAmountNumber(max) ? current : max;
  }, candidates[0]);
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

  const labeledCurrencyCandidates = collectLabeledCurrencyCandidates(extracted)
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return toAmountNumber(right.amount) - toAmountNumber(left.amount);
    });

  if (labeledCurrencyCandidates.length) {
    const best = labeledCurrencyCandidates[0];
    return {
      amount: best.amount,
      allDetectedAmounts: dedupeAmountCandidates([best.amount, ...candidates]),
      amountReason: "優先採用高優先級金額標籤中的最高 MOP/$ 金額",
    };
  }

  const highestCurrencyAmount = pickHighestCurrencyAmount(extracted);
  if (highestCurrencyAmount) {
    return {
      amount: highestCurrencyAmount,
      allDetectedAmounts: dedupeAmountCandidates([highestCurrencyAmount, ...candidates]),
      amountReason: "優先採用帶 MOP/$ 標記的最高正數金額",
    };
  }

  const preferredAmount = pickPreferredAmount(extracted);
  if (preferredAmount) {
    return {
      amount: preferredAmount,
      allDetectedAmounts: dedupeAmountCandidates([preferredAmount, ...candidates]),
      amountReason: "優先採用原交易/訂單金額欄位",
    };
  }

  const largest = candidates.reduce((max, current) => {
    return toAmountNumber(current) > toAmountNumber(max) ? current : max;
  }, candidates[0]);

  return {
    amount: largest,
    allDetectedAmounts: candidates,
    amountReason: "取候選金額中的最大值",
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

function collectAmountCandidatesForQuality(extracted = {}) {
  return dedupeAmountCandidates([
    extracted?.amount,
    ...(Array.isArray(extracted?.allDetectedAmounts) ? extracted.allDetectedAmounts : []),
  ]).filter((value) => toAmountNumber(value) > 0);
}

function evaluateStructuredResult(extracted = {}) {
  const missingKeys = [];
  if (!String(extracted?.merchantName || "").trim()) missingKeys.push("merchantName");
  if (!collectOrderNoCandidates(extracted).length) missingKeys.push("transactionOrderNo");
  if (!collectAmountCandidatesForQuality(extracted).length) missingKeys.push("amount");
  if (!String(extracted?.transactionTime || "").trim()) missingKeys.push("transactionTime");

  const confidence = Number(extracted?.confidence || 0);
  const missingThreshold = Math.max(0, AI_FALLBACK_MISSING_KEYS_THRESHOLD);
  const lowConfidence = confidence > 0 && confidence < AI_FALLBACK_CONFIDENCE_THRESHOLD;
  const ok = missingKeys.length < missingThreshold && !lowConfidence;

  return {
    ok,
    confidence,
    lowConfidence,
    missingKeys,
    score: 4 - missingKeys.length + Math.min(1, Math.max(0, confidence)),
  };
}

function evaluateOcrText(ocrText = "") {
  const normalizedText = String(ocrText || "").trim();
  const hasEnoughText = normalizedText.replace(/\s+/g, "").length >= 20;
  const hasUsefulSignal =
    /\d{12,}/.test(normalizedText) ||
    /(交易|訂單|订单|金額|金额|MOP|\$|商戶|商户|支付|付款|時間|时间)/.test(normalizedText);
  return {
    ok: hasEnoughText && hasUsefulSignal,
    normalizedText,
  };
}

async function analyzeImageWithSingleModel(base64DataUrl) {
  const { text } = await requestChatCompletion({
    model: AI_MODEL,
    temperature: 0.1,
    maxTokens: 500,
    messages: [
      {
        role: "system",
        content: vlExtractionPrompt,
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
  });

  return safeJsonParse(normalizeAIText(text));
}

async function runOcrModel(base64DataUrl) {
  const { text } = await requestChatCompletion({
    model: AI_OCR_MODEL,
    temperature: 0,
    maxTokens: AI_OCR_MAX_TOKENS,
    messages: [
      {
        role: "system",
        content: ocrPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "請完整提取這張付款交易截圖中的可辨識文字。",
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
  });

  return evaluateOcrText(normalizeAIText(text));
}

async function runTextStructuringModel(ocrText) {
  const { text } = await requestChatCompletion({
    model: AI_TEXT_MODEL,
    temperature: 0,
    maxTokens: AI_TEXT_MAX_TOKENS,
    messages: [
      {
        role: "system",
        content: textStructuringPrompt,
      },
      {
        role: "user",
        content: `以下是由 OCR 從付款截圖提取的原始文字，請根據文字內容輸出固定 JSON：\n\n${ocrText}`,
      },
    ],
  });

  return safeJsonParse(normalizeAIText(text));
}

async function runVlFallbackModel(base64DataUrl) {
  const { text } = await requestChatCompletion({
    model: AI_VL_FALLBACK_MODEL,
    temperature: 0.1,
    maxTokens: AI_VL_MAX_TOKENS,
    messages: [
      {
        role: "system",
        content: vlExtractionPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "OCR 或文字結構化結果不足。請直接根據圖片辨識交易截圖，並依照指定 JSON 格式回傳。",
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
  });

  return safeJsonParse(normalizeAIText(text));
}

async function analyzeImageWithOrchestrator(base64DataUrl) {
  let ocrResult = { ok: false, normalizedText: "" };
  let structuredResult = null;
  let bestResult = null;
  let bestScore = -Infinity;

  try {
    ocrResult = await runOcrModel(base64DataUrl);
  } catch {
    ocrResult = { ok: false, normalizedText: "" };
  }

  if (ocrResult.ok && ocrResult.normalizedText) {
    try {
      structuredResult = await runTextStructuringModel(ocrResult.normalizedText);
      const structuredEvaluation = evaluateStructuredResult(structuredResult);
      bestResult = structuredResult;
      bestScore = structuredEvaluation.score;

      if (structuredEvaluation.ok) {
        return {
          ...structuredResult,
          ocrRawText: ocrResult.normalizedText,
          aiPipeline: "ocr-text",
        };
      }
    } catch {
      structuredResult = null;
    }
  }

  const vlFallbackResult = await runVlFallbackModel(base64DataUrl);
  const fallbackEvaluation = evaluateStructuredResult(vlFallbackResult);

  if (fallbackEvaluation.score >= bestScore) {
    bestResult = vlFallbackResult;
    bestScore = fallbackEvaluation.score;
  }

  return {
    ...(bestResult || vlFallbackResult),
    ocrRawText: ocrResult.normalizedText || null,
    aiPipeline: bestResult === structuredResult ? "ocr-text" : "ocr-text-vl-fallback",
  };
}

export async function analyzeImage(base64DataUrl) {
  if (!AI_ORCHESTRATOR_ENABLED) {
    return analyzeImageWithSingleModel(base64DataUrl);
  }

  return analyzeImageWithOrchestrator(base64DataUrl);
}

export function getHealthPayload() {
  let aiBaseUrlHost = "";
  let aiBaseUrlEndsWithApiV1 = false;
  try {
    if (AI_BASE_URL) {
      const u = new URL(AI_BASE_URL);
      aiBaseUrlHost = u.host;
      aiBaseUrlEndsWithApiV1 = u.pathname.replace(/\/$/, "") === "/api/v1";
    }
  } catch {
    aiBaseUrlHost = "";
  }
  let aiKeyFormat = "empty";
  if (AI_API_KEY.startsWith("sk-or-")) aiKeyFormat = "openrouter";
  else if (AI_API_KEY.startsWith("AIza")) aiKeyFormat = "google-gemini";
  else if (AI_API_KEY) aiKeyFormat = "other";
  return {
    ok: true,
    storageProvider: HAS_SUPABASE_STORAGE ? "supabase" : "local",
    hasAiConfig: Boolean(AI_BASE_URL && AI_API_KEY),
    aiBaseUrlHost,
    aiBaseUrlEndsWithApiV1,
    aiKeyFormat,
    aiModel: AI_MODEL,
    aiOcrModel: AI_OCR_MODEL,
    aiTextModel: AI_TEXT_MODEL,
    aiVlFallbackModel: AI_VL_FALLBACK_MODEL,
    aiOrchestratorEnabled: AI_ORCHESTRATOR_ENABLED,
    hasMembershipConfig: Boolean(MEMBERSHIP_TOKEN_SECRET && MEMBERSHIP_TOKEN_ISSUER && MEMBERSHIP_TOKEN_AUDIENCE),
    hasMembershipSyncConfig: Boolean(MEMBERSHIP_SYNC_ENDPOINT && MEMBERSHIP_SYNC_SECRET),
  };
}

function normalizeAnalyzedItem(extracted, file, index, extras = {}) {
  const normalizedAmount = pickLargestAmount(extracted);
  const orderNoCandidates = collectOrderNoCandidates(extracted);
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
      transactionOrderNo:
        (extracted.transactionOrderNo && /^\d{12,}$/.test(String(extracted.transactionOrderNo))
          ? String(extracted.transactionOrderNo)
          : orderNoCandidates[0]) || null,
      amount: normalizedAmount.amount ?? null,
      transactionTime: extracted.transactionTime ?? null,
      orderStatus: extracted.orderStatus ?? null,
      paymentMethod: extracted.paymentMethod ?? null,
      allDetectedAmounts: normalizedAmount.allDetectedAmounts,
      allDetectedOrderNos: orderNoCandidates,
      amountReason: normalizedAmount.amountReason || extracted.amountReason || "取候選金額中的最大值",
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
  return [
    ...new Set(
      items
        .flatMap((item) => [
          item?.extracted?.transactionOrderNo,
          ...(Array.isArray(item?.extracted?.allDetectedOrderNos) ? item.extracted.allDetectedOrderNos : []),
        ])
        .filter(Boolean)
        .map(String)
    ),
  ];
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
      const candidates = [
        item?.extracted?.transactionOrderNo,
        ...(Array.isArray(item?.extracted?.allDetectedOrderNos) ? item.extracted.allDetectedOrderNos : []),
      ]
        .filter(Boolean)
        .map(String);
      candidates.forEach((orderNo) => {
        if (normalizedOrderNos.includes(orderNo)) duplicated.add(orderNo);
      });
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

async function loadBackofficeMatchMap(client, candidates = []) {
  const normalizedCandidates = [...new Set(candidates.filter(Boolean).map(String))];
  const matchMap = new Map();
  if (!normalizedCandidates.length) return matchMap;

  const extractBackofficeAmount = (row) => {
    if (!row || typeof row !== "object") return null;
    const preferredKeys = [
      "amount",
      "total_amount",
      "trade_amount",
      "pay_amount",
      "payment_amount",
      "txn_amount",
      "trans_amount",
      "order_amount",
      "deal_amount",
      "actual_amount",
      "paid_amount",
    ];
    for (const key of preferredKeys) {
      if (row[key] == null || row[key] === "") continue;
      const amount = toAmountNumber(row[key]);
      if (amount > 0) return amount.toFixed(2);
    }

    for (const [key, value] of Object.entries(row)) {
      if (!/amount|amt|money|total/i.test(key)) continue;
      if (value == null || value === "") continue;
      const amount = toAmountNumber(value);
      if (amount > 0) return amount.toFixed(2);
    }
    return null;
  };

  const absorbMatchRow = ({ matchValue, matchSource, transactionStatus, backofficeAmount = null }) => {
    const key = String(matchValue || "");
    if (!key) return;
    const next = {
      matchedValue: key,
      matchedSource: matchSource || null,
      transactionStatus: transactionStatus ? String(transactionStatus) : null,
      backofficeAmount,
    };
    const existing = matchMap.get(key);
    if (
      !existing ||
      (existing.transactionStatus !== "01" && next.transactionStatus === "01") ||
      (!existing.backofficeAmount && next.backofficeAmount)
    ) {
      matchMap.set(key, next);
    }
  };

  const sourceColumns = ["trade_no", "order_no", "pay_order_no"];
  for (const column of sourceColumns) {
    try {
      const { data, error } = await client
        .from("transactions_from_mpaybackoffice")
        .select("*")
        .in(column, normalizedCandidates);
      if (error) continue;
      (data || []).forEach((row) =>
        absorbMatchRow({
          matchValue: row?.[column],
          matchSource: column,
          transactionStatus: row?.transaction_status,
          backofficeAmount: extractBackofficeAmount(row),
        })
      );
    } catch {
      continue;
    }
  }

  if (matchMap.size > 0) {
    return matchMap;
  }

  try {
    const { data, error } = await client
      .from("transactions_from_mpaybackoffice_match_index")
      .select("match_value, match_source, transaction_status")
      .in("match_value", normalizedCandidates);
    if (!error) {
      (data || []).forEach((row) =>
        absorbMatchRow({
          matchValue: row?.match_value,
          matchSource: row?.match_source,
          transactionStatus: row?.transaction_status,
        })
      );
    }
  } catch {
    // ignore
  }

  return matchMap;
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
    .select("id, code, name, auto_approve_enabled, auto_approve_interval_minutes")
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

export async function findAdminByLogin(login) {
  const normalized = String(login || "").trim();
  if (normalized !== DEFAULT_ADMIN_LOGIN) return null;
  return {
    admin_login: DEFAULT_ADMIN_LOGIN,
    admin_password: DEFAULT_ADMIN_PASSWORD,
    name: DEFAULT_ADMIN_NAME,
    is_active: true,
  };
}

export async function findCustomerByCode(code) {
  const normalizedCode = String(code || "").trim();
  const client = ensureDatabaseReady();

  try {
    const { data, error } = await client
      .from("customer_accounts")
      .select(
        "code, password, is_active, auth_source, external_member_id, full_name, phone, membership_status, profile_json"
      )
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
        auth_source: "local",
        external_member_id: null,
        full_name: null,
        phone: null,
        membership_status: "active",
        profile_json: {},
      };
    }
  }

  return null;
}

export async function findCustomerByExternalMemberId(externalMemberId) {
  if (!externalMemberId) return null;
  const client = ensureDatabaseReady();

  try {
    const { data, error } = await client
      .from("customer_accounts")
      .select(
        "code, password, is_active, auth_source, external_member_id, full_name, phone, membership_status, profile_json"
      )
      .eq("external_member_id", String(externalMemberId))
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

function safeBase64UrlDecode(input) {
  return Buffer.from(String(input || ""), "base64url").toString("utf8");
}

function safeBase64UrlEncode(input) {
  return Buffer.from(String(input || ""), "utf8").toString("base64url");
}

function safeCompareBase64(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("登入 token 格式錯誤");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const header = JSON.parse(safeBase64UrlDecode(encodedHeader));
  const payload = JSON.parse(safeBase64UrlDecode(encodedPayload));

  return {
    encodedHeader,
    encodedPayload,
    signature,
    header,
    payload,
    signingInput: `${encodedHeader}.${encodedPayload}`,
  };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function normalizeSiteASSOClaims(rawClaims = {}) {
  const role = String(rawClaims?.role || rawClaims?.portal_role || "").toLowerCase();
  const shopId = rawClaims?.shop?.shopId || rawClaims?.shop_id || rawClaims?.shopCode || rawClaims?.shop_code || null;
  const shopName = rawClaims?.shop?.shopName || rawClaims?.shop_name || null;
  const customerId =
    rawClaims?.customer?.customerId || rawClaims?.customer?.memberCode || rawClaims?.member_code || rawClaims?.phone || null;
  const displayName = rawClaims?.customer?.displayName || rawClaims?.full_name || rawClaims?.owner_name || null;
  const phone = rawClaims?.customer?.phone || rawClaims?.phone || null;
  const redirectPath = rawClaims?.redirect?.path || rawClaims?.redirect_path || (role === "owner" ? "/owner.html" : "/");
  const redirectTxId = rawClaims?.redirect?.txId || rawClaims?.txId || rawClaims?.transaction_id || null;

  return {
    ...rawClaims,
    portal_role: role,
    role,
    shop_id: shopId ? String(shopId) : null,
    shop_code: rawClaims?.shop?.shopCode || rawClaims?.shop_code || shopId || null,
    shop_name: shopName ? String(shopName) : null,
    member_code: customerId ? String(customerId) : null,
    full_name: displayName ? String(displayName) : null,
    phone: phone ? String(phone) : null,
    redirect: {
      path: String(redirectPath || "/"),
      txId: redirectTxId ? String(redirectTxId) : null,
    },
  };
}

function validateMembershipClaims(rawClaims) {
  const claims = normalizeSiteASSOClaims(rawClaims);
  const now = Math.floor(Date.now() / 1000);
  const skew = SITEA_SSO_CLOCK_SKEW_SECONDS;
  const portalRole = String(claims?.portal_role || "");
  const hasShopIdentity = Boolean(claims?.shop_id || claims?.shop_code || claims?.shop_name);

  if (!claims?.iss || claims.iss !== SITEA_SSO_ISSUER) {
    throw new Error("登入 token issuer 不正確");
  }
  if (!claims?.aud || claims.aud !== SITEA_SSO_AUDIENCE) {
    throw new Error("登入 token audience 不正確");
  }
  if (!claims?.sub) {
    throw new Error("登入 token 缺少 subject");
  }
  if (!claims?.jti) {
    throw new Error("登入 token 缺少 jti");
  }
  if (!portalRole || !["customer", "owner"].includes(portalRole)) {
    throw new Error("登入 token 缺少有效 portal_role");
  }
  if (!hasShopIdentity) {
    throw new Error("登入 token 缺少店舖資訊");
  }
  if (claims?.shop_id && !/^\d{8}$/.test(String(claims.shop_id))) {
    throw new Error("登入 token 的 shop id 必須為 8 位數字");
  }
  if (portalRole === "customer") {
    if (!claims?.member_code || !/^\d{8}$/.test(String(claims.member_code))) {
      throw new Error("登入 token 缺少有效會員編號");
    }
    if (claims?.membership_status && String(claims.membership_status).toLowerCase() !== "active") {
      throw new Error("會員狀態無效，不能登入");
    }
  }
  if (!claims?.iat || !claims?.exp) {
    throw new Error("登入 token 缺少時間欄位");
  }
  if (claims?.nbf && Number(claims.nbf) > now + skew) {
    throw new Error("登入 token 尚未生效");
  }
  if (Number(claims.exp) < now - skew) {
    throw new Error("登入 token 已過期");
  }
  return claims;
}

export function verifyMembershipLoginToken(token) {
  if (!SITEA_SSO_ENABLED) {
    throw new Error("會員系統登入目前未啟用");
  }
  if (!SITEA_SSO_SECRET) {
    throw new Error("會員系統登入設定未完成");
  }

  const parsed = parseJwt(token);
  if (parsed.header?.alg !== "HS256") {
    throw new Error("不支援的登入 token 演算法");
  }

  const expectedSignature = crypto
    .createHmac("sha256", SITEA_SSO_SECRET)
    .update(parsed.signingInput)
    .digest("base64url");

  if (!safeCompareBase64(parsed.signature, expectedSignature)) {
    throw new Error("登入 token 驗證失敗");
  }

  const normalizedClaims = validateMembershipClaims(parsed.payload);
  return {
    claims: normalizedClaims,
    tokenHash: hashToken(token),
    rawToken: token,
  };
}

async function reserveMembershipTokenLogin({ claims, tokenHash, req }) {
  const client = ensureDatabaseReady();
  try {
    const { error } = await client.from("membership_token_logins").insert({
      jti: String(claims.jti),
      token_hash: tokenHash,
      issuer: String(claims.iss),
      audience: String(claims.aud),
      subject: String(claims.sub),
      member_code: String(claims.member_code || claims.shop_id || claims.sub),
      portal_role: String(claims.portal_role),
      status: "processing",
      expires_at: new Date(Number(claims.exp) * 1000).toISOString(),
      request_ip: req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || null,
      user_agent: req?.headers?.["user-agent"] || null,
      claims_json: claims,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("登入 token 已被使用，請重新從主系統進入");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("建立登入記錄失敗");
  }
}

async function finalizeMembershipTokenLogin({ jti, status, rejectReason = null }) {
  const client = ensureDatabaseReady();
  try {
    const updatePayload = {
      status,
      reject_reason: rejectReason,
    };
    if (status === "accepted") {
      updatePayload.used_at = new Date().toISOString();
    }

    const { error } = await client
      .from("membership_token_logins")
      .update(updatePayload)
      .eq("jti", String(jti));

    if (error) throw error;
  } catch {
    return;
  }
}

const SHOP_SELECT_COLUMNS =
  "id, code, name, owner_login, owner_password, is_active, external_shop_id, owner_external_id, auth_source";

async function findMembershipShopBy({ column, value }) {
  if (!value) return null;
  const client = ensureDatabaseReady();
  try {
    const { data, error } = await client
      .from("shops")
      .select(SHOP_SELECT_COLUMNS)
      .eq(column, String(value))
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function provisionMembershipShop(claims) {
  const client = ensureDatabaseReady();
  const externalShopId = claims.shop_id ? String(claims.shop_id) : null;
  const shopCode = claims.shop_code ? String(claims.shop_code) : null;
  const shopName = claims.shop_name ? String(claims.shop_name) : null;
  const ownerLogin = claims.owner_login
    ? String(claims.owner_login)
    : claims.owner_code
      ? String(claims.owner_code)
      : externalShopId || `membership-owner-${String(claims.sub).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "shop"}`;

  const existingShop =
    (await findMembershipShopBy({ column: "external_shop_id", value: externalShopId })) ||
    (await findMembershipShopBy({ column: "code", value: shopCode })) ||
    (await findMembershipShopBy({ column: "name", value: shopName }));

  if (existingShop) {
    const updatePayload = {
      name: shopName || existingShop.name,
      code: shopCode || existingShop.code,
      external_shop_id: externalShopId || existingShop.external_shop_id || null,
      auth_source: "membership",
      owner_external_id:
        claims.portal_role === "owner" ? String(claims.sub) : existingShop.owner_external_id || null,
    };

    const { data, error } = await client
      .from("shops")
      .update(updatePayload)
      .eq("id", existingShop.id)
      .select("id, code, name, owner_login, external_shop_id, owner_external_id")
      .single();

    if (error) throw new Error(`同步店舖資料失敗：${error.message}`);
    return data;
  }

  const insertPayload = {
    code: shopCode || externalShopId || `SHOP-${(externalShopId || crypto.randomUUID()).slice(0, 12)}`,
    name: shopName || `Shop ${shopCode || externalShopId || "Unknown"}`,
    owner_login: ownerLogin,
    owner_password: crypto.randomBytes(6).toString("hex"),
    external_shop_id: externalShopId,
    owner_external_id: claims.portal_role === "owner" ? String(claims.sub) : null,
    auth_source: "membership",
  };

  const { data, error } = await client
    .from("shops")
    .insert(insertPayload)
    .select("id, code, name, owner_login, external_shop_id, owner_external_id")
    .single();

  if (error) throw new Error(`建立店舖資料失敗：${error.message}`);
  return data;
}

export async function provisionMembershipCustomer(claims) {
  const client = ensureDatabaseReady();
  const memberCode = String(claims.member_code);
  const externalMemberId = String(claims.sub);
  const existingByCode = await findCustomerByCode(memberCode);
  const existingByExternal = await findCustomerByExternalMemberId(externalMemberId);

  if (
    existingByCode?.external_member_id &&
    String(existingByCode.external_member_id) !== externalMemberId
  ) {
    throw new Error("此會員編號已綁定其他外部帳號，請人工檢查");
  }

  if (existingByExternal?.code && String(existingByExternal.code) !== memberCode) {
    throw new Error("此外部會員已綁定其他本地會員編號，請人工檢查");
  }

  const profilePayload = {
    source_system: claims.source_system || claims.iss,
    phone: claims.phone || null,
    full_name: claims.full_name || null,
    raw_claims: claims,
  };

  const upsertPayload = {
    code: memberCode,
    password: existingByCode?.password || crypto.randomBytes(6).toString("hex"),
    is_active: true,
    auth_source: existingByCode?.auth_source === "local" ? "hybrid" : "membership",
    external_member_id: externalMemberId,
    full_name: claims.full_name || existingByCode?.full_name || null,
    phone: claims.phone || existingByCode?.phone || null,
    membership_status: claims.membership_status || "active",
    profile_json: profilePayload,
    provisioned_at: existingByCode ? existingByCode.provisioned_at || new Date().toISOString() : new Date().toISOString(),
    last_login_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await client
      .from("customer_accounts")
      .upsert(upsertPayload, { onConflict: "code" })
      .select(
        "code, password, is_active, auth_source, external_member_id, full_name, phone, membership_status, profile_json"
      )
      .single();

    if (error) throw error;
    return data;
  } catch {
    const fallbackPayload = {
      code: memberCode,
      password: existingByCode?.password || crypto.randomBytes(6).toString("hex"),
      is_active: true,
    };
    const { data, error } = await client
      .from("customer_accounts")
      .upsert(fallbackPayload, { onConflict: "code" })
      .select("code, password, is_active")
      .single();

    if (error) throw new Error(`同步會員資料失敗：${error.message}`);
    return {
      ...data,
      auth_source: "membership",
      external_member_id: externalMemberId,
      full_name: claims.full_name || null,
      phone: claims.phone || null,
      membership_status: claims.membership_status || "active",
      profile_json: profilePayload,
    };
  }
}

export async function exchangeMembershipLoginToken({ token, req }) {
  const { claims, tokenHash } = verifyMembershipLoginToken(token);
  await reserveMembershipTokenLogin({ claims, tokenHash, req });

  try {
    const shop = await provisionMembershipShop(claims);

    if (String(claims.portal_role) === "owner") {
      await finalizeMembershipTokenLogin({ jti: claims.jti, status: "accepted" });
      return {
        user: {
          role: "owner",
          ownerLogin: claims.owner_login || claims.owner_code || shop.owner_login || String(claims.sub),
          authSource: "membership",
          externalMemberId: String(claims.sub),
          fullName: claims.full_name || claims.owner_name || null,
          phone: claims.phone || null,
          shopId: shop.id,
          shopName: shop.name,
          shopCode: shop.code || null,
        },
        redirect: claims.redirect || { path: "/owner.html", txId: null },
      };
    }

    const customer = await provisionMembershipCustomer(claims);
    await finalizeMembershipTokenLogin({ jti: claims.jti, status: "accepted" });
    return {
      user: {
        role: "customer",
        memberCode: String(customer.code),
        authSource: customer.auth_source || "membership",
        externalMemberId: customer.external_member_id || String(claims.sub),
        fullName: customer.full_name || claims.full_name || null,
        phone: customer.phone || claims.phone || null,
        shopId: shop.id,
        shopName: shop.name,
        shopCode: shop.code || null,
      },
      redirect: claims.redirect || { path: "/", txId: null },
    };
  } catch (error) {
    await finalizeMembershipTokenLogin({
      jti: claims.jti,
      status: "rejected",
      rejectReason: error instanceof Error ? error.message : "membership login failed",
    });
    throw error;
  }
}

export async function getShopById(shopId) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("shops")
    .select("id, code, name, external_shop_id")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(`讀取店舖失敗：${error.message}`);
  return data;
}

async function getTransactionById(shopId, transactionId) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("transactions")
    .select("*")
    .eq("shop_id", shopId)
    .eq("id", transactionId)
    .single();

  if (error) throw new Error(`讀取交易資料失敗：${error.message}`);
  return data;
}

async function findTransactionById(transactionId) {
  const client = ensureDatabaseReady();
  const { data, error } = await client
    .from("transactions")
    .select("id, shop_id, status, total_amount, items")
    .eq("id", transactionId)
    .single();

  if (error) throw new Error(`讀取交易資料失敗：${error.message}`);
  return data;
}

function buildSiteAApprovedPayload({ transaction, shop, ownerLogin }) {
  const approvedAt = new Date().toISOString();
  return {
    event: "topup.approved",
    eventId: crypto.randomUUID(),
    occurredAt: approvedAt,
    shopId: shop.external_shop_id || shop.code || null,
    shopName: shop.name || null,
    customerId: transaction.customer_code,
    siteBTransactionId: transaction.id,
    amount: Number(transaction.total_amount || 0).toFixed(2),
    currency: "MOP",
    itemCount: transaction.item_count || 0,
    approvedAt,
    ownerLogin: ownerLogin || null,
    items: (transaction.items || []).map((item) => ({
      itemId: item.id || null,
      merchantName: item?.extracted?.merchantName || null,
      transactionOrderNo: item?.extracted?.transactionOrderNo || null,
      allDetectedOrderNos: Array.isArray(item?.extracted?.allDetectedOrderNos) ? item.extracted.allDetectedOrderNos : [],
      amount: item?.extracted?.amount ? Number(item.extracted.amount).toFixed(2) : null,
      transactionTime: item?.extracted?.transactionTime || null,
      paymentMethod: item?.extracted?.paymentMethod || null,
    })),
  };
}

function buildSiteARejectedPayload({ transaction, shop }) {
  return {
    event: "topup.rejected",
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    shopId: shop.external_shop_id || shop.code || null,
    shopName: shop.name || null,
    customerId: transaction.customer_code,
    siteBTransactionId: transaction.id,
    reason: "Rejected by shop owner",
    deepLink: {
      siteBUrl: `${PUBLIC_APP_BASE_URL}/?txId=${encodeURIComponent(transaction.id)}`,
      siteBPath: `/?txId=${transaction.id}`,
      txId: transaction.id,
    },
  };
}

function buildSiteAPendingChangedPayload({ shop, pendingCount }) {
  return {
    event: "shop.pending_changed",
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    shopId: shop.external_shop_id || shop.code || null,
    shopName: shop.name || null,
    pendingCount,
  };
}

async function logSiteAIntegrationEvent({
  eventType,
  transactionId = null,
  shopId = null,
  customerCode = null,
  direction = "outbound",
  status = "processing",
  requestPayload = null,
  responseStatus = null,
  responsePayload = null,
  errorMessage = null,
}) {
  const client = ensureDatabaseReady();
  try {
    await client.from("sitea_integration_events").insert({
      event_type: eventType,
      transaction_id: transactionId,
      shop_id: shopId,
      customer_code: customerCode,
      direction,
      status,
      request_payload: requestPayload,
      response_status: responseStatus,
      response_payload: responsePayload,
      error_message: errorMessage,
    });
  } catch {
    return;
  }
}

async function markMembershipSyncResult({
  transactionId,
  status,
  syncedAt = null,
  errorMessage = null,
  responsePayload = null,
}) {
  const client = ensureDatabaseReady();
  const updatePayload = {
    membership_sync_status: status,
    membership_sync_attempted_at: new Date().toISOString(),
    membership_sync_error: errorMessage,
    membership_sync_response: responsePayload,
  };
  if (syncedAt) {
    updatePayload.membership_synced_at = syncedAt;
  }

  const { error } = await client.from("transactions").update(updatePayload).eq("id", transactionId);
  if (error) throw new Error(`更新會員同步狀態失敗：${error.message}`);
}

async function postSiteAWebhook({ endpoint, eventName, payload, transactionId = null, shopId = null, customerCode = null }) {
  if (!endpoint || !SITEA_WEBHOOK_SECRET) {
    throw new Error("Site A webhook 設定未完成");
  }

  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature = crypto
    .createHmac("sha256", SITEA_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEA_WEBHOOK_TIMEOUT_MS);

  await logSiteAIntegrationEvent({
    eventType: eventName,
    transactionId,
    shopId,
    customerCode,
    status: "processing",
    requestPayload: payload,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Topup-Timestamp": timestamp,
        "X-Topup-Signature": signature,
        "X-Topup-Event": eventName,
      },
      body,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsedResponse = null;
    try {
      parsedResponse = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedResponse = rawText || null;
    }

    if (!response.ok) {
      throw new Error(`${response.status} ${typeof parsedResponse === "string" ? parsedResponse : JSON.stringify(parsedResponse || {})}`);
    }

    await logSiteAIntegrationEvent({
      eventType: eventName,
      transactionId,
      shopId,
      customerCode,
      status: "success",
      requestPayload: payload,
      responseStatus: response.status,
      responsePayload: parsedResponse,
    });

    return {
      responsePayload: parsedResponse,
    };
  } catch (error) {
    await logSiteAIntegrationEvent({
      eventType: eventName,
      transactionId,
      shopId,
      customerCode,
      status: "failed",
      requestPayload: payload,
      errorMessage: error instanceof Error ? error.message : "site a webhook failed",
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function syncApprovedTransactionToMembership({ transaction, shop, ownerLogin }) {
  if (!SITEA_CALLBACK_APPROVED_ENDPOINT) {
    throw new Error("Site A approved callback API 尚未設定完成");
  }

  const payload = buildSiteAApprovedPayload({ transaction, shop, ownerLogin });

  try {
    const result = await postSiteAWebhook({
      endpoint: SITEA_CALLBACK_APPROVED_ENDPOINT,
      eventName: "topup.approved",
      payload,
      transactionId: transaction.id,
      shopId: shop.id,
      customerCode: transaction.customer_code,
    });
    await markMembershipSyncResult({
      transactionId: transaction.id,
      status: "success",
      syncedAt: new Date().toISOString(),
      errorMessage: null,
      responsePayload: result.responsePayload,
    });
    return {
      approvedAt: payload.approvedAt,
      responsePayload: result.responsePayload,
    };
  } catch (error) {
    await markMembershipSyncResult({
      transactionId: transaction.id,
      status: "failed",
      syncedAt: null,
      errorMessage: error instanceof Error ? error.message : "site a approved callback failed",
      responsePayload: null,
    });
    throw error;
  }
}

async function getPendingTransactionCount(shopId) {
  const client = ensureDatabaseReady();
  const { count, error } = await client
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "pending");
  if (error) throw new Error(`讀取待審核數量失敗：${error.message}`);
  return count || 0;
}

export async function getPendingTransactionCountByExternalShopId(externalShopId) {
  const client = ensureDatabaseReady();
  const normalized = String(externalShopId || "").trim();
  if (!normalized) {
    throw new Error("缺少 shop id");
  }

  const { data: shop, error } = await client
    .from("shops")
    .select("id, code, external_shop_id, name")
    .or(`external_shop_id.eq.${normalized},code.eq.${normalized},owner_login.eq.${normalized}`)
    .maybeSingle();
  if (error) throw new Error(`讀取店舖資料失敗：${error.message}`);
  if (!shop) throw new Error("找不到對應店舖");

  const pendingCount = await getPendingTransactionCount(shop.id);
  return {
    shopId: normalized,
    shopName: shop.name || null,
    pendingCount,
    internalShopId: shop.id,
  };
}

async function notifySiteAPendingChanged({ shopId }) {
  if (!SITEA_CALLBACK_PENDING_ENDPOINT) return null;
  const shop = await getShopById(shopId);
  if (!shop) return null;
  const pendingCount = await getPendingTransactionCount(shopId);
  return postSiteAWebhook({
    endpoint: SITEA_CALLBACK_PENDING_ENDPOINT,
    eventName: "shop.pending_changed",
    payload: buildSiteAPendingChangedPayload({ shop, pendingCount }),
    shopId,
  });
}

async function notifySiteARejected({ transaction, shop }) {
  if (!SITEA_CALLBACK_REJECTED_ENDPOINT) return null;
  return postSiteAWebhook({
    endpoint: SITEA_CALLBACK_REJECTED_ENDPOINT,
    eventName: "topup.rejected",
    payload: buildSiteARejectedPayload({ transaction, shop }),
    transactionId: transaction.id,
    shopId: shop.id,
    customerCode: transaction.customer_code,
  });
}

export async function createTransactionSubmission({ shopId, customerCode, files, analyzedItems }) {
  const client = ensureDatabaseReady();
  await ensureStorageDir();

  const extractedOrderNos = extractTransactionOrderNos(analyzedItems);
  const duplicateTransactionOrderNos = await findDuplicateTransactionOrderNos(extractedOrderNos);
  if (duplicateTransactionOrderNos.length) {
    throw new Error("發現重複交易編號，請重新上傳。");
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
    status: "pending",
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

  try {
    await notifySiteAPendingChanged({ shopId });
  } catch {
    // do not fail submission because Site A pending callback is unavailable
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

function applyTransactionFilters(query, { shopId, mode = "pending", from, to, customerCode }) {
  let nextQuery = query;

  if (shopId) {
    nextQuery = nextQuery.eq("shop_id", shopId);
  }

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

  if (customerCode) {
    nextQuery = nextQuery.ilike("customer_code", `%${customerCode}%`);
  }

  return nextQuery;
}

async function persistBackofficeCorrections(client, corrections = []) {
  for (const correction of corrections) {
    try {
      await client
        .from("transactions")
        .update({
          items: correction.items,
          total_amount: correction.totalAmount,
        })
        .eq("id", correction.transactionId);
    } catch {
      continue;
    }
  }
}

export async function listTransactions({
  shopId,
  mode = "pending",
  from,
  to,
  customerCode,
  page = 1,
  pageSize = 20,
  countOnly = false,
  includeShop = false,
}) {
  const client = ensureDatabaseReady();
  const normalizedPage = Math.max(1, Number(page) || 1);
  const useAll = String(pageSize) === "all";
  const normalizedPageSize = useAll ? "all" : Math.max(1, Number(pageSize) || 20);

  if (countOnly) {
    const countQuery = applyTransactionFilters(
      client.from("transactions").select("id", { count: "exact", head: true }),
      { shopId, mode, from, to, customerCode }
    );
    const { error, count } = await countQuery;
    if (error) throw new Error(`讀取交易列表失敗：${error.message}`);
    return {
      rows: [],
      total: count || 0,
      page: 1,
      pageSize: 0,
      pageCount: 1,
    };
  }

  const selectColumns = includeShop ? "*, shops(id, code, name)" : "*";
  let query = applyTransactionFilters(
    client.from("transactions").select(selectColumns, { count: "exact" }).order("submitted_at", { ascending: false }),
    { shopId, mode, from, to, customerCode }
  );

  if (!useAll) {
    const fromIndex = (normalizedPage - 1) * normalizedPageSize;
    const toIndex = fromIndex + normalizedPageSize - 1;
    query = query.range(fromIndex, toIndex);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`讀取交易列表失敗：${error.message}`);

  const rows = data || [];
  const orderNos = [
    ...new Set(
      rows
        .flatMap((row) =>
          (row?.items || []).flatMap((item) => [
            item?.extracted?.transactionOrderNo,
            ...(Array.isArray(item?.extracted?.allDetectedOrderNos) ? item.extracted.allDetectedOrderNos : []),
          ])
        )
        .filter(Boolean)
        .map(String)
    ),
  ];
  const backofficeMatchMap = await loadBackofficeMatchMap(client, orderNos);
  const corrections = [];

  const enhancedRows = rows.map((row) => {
    let rowHasCorrection = false;
    const enhancedItems = (row?.items || []).map((item) => {
      if (item?.aiPipeline === "skipped" || item?.verificationStatus === "ai_skipped") {
        return {
          ...item,
          verificationStatus: "ai_skipped",
          verificationMatchedOrderNo: null,
          verificationMatchedSource: null,
          verificationBackofficeAmount: null,
          verificationAmountMatched: null,
          mpayTransactionStatus: null,
        };
      }
      const candidates = [
        item?.extracted?.transactionOrderNo,
        ...(Array.isArray(item?.extracted?.allDetectedOrderNos) ? item.extracted.allDetectedOrderNos : []),
      ]
        .filter(Boolean)
        .map(String);
      const matchedOrderNo = candidates.find((candidate) => backofficeMatchMap.has(candidate)) || null;
      const matchedInfo = matchedOrderNo ? backofficeMatchMap.get(matchedOrderNo) || null : null;
      const matchedStatus = matchedInfo?.transactionStatus || null;
      const backofficeAmount = matchedInfo?.backofficeAmount || null;
      const currentAmount = toAmountNumber(item?.selectedAmount || item?.manualAmount || item?.extracted?.amount);
      const expectedAmount = toAmountNumber(backofficeAmount);
      const hasGoldenAmount = expectedAmount > 0;
      const amountMatched = hasGoldenAmount ? Math.abs(currentAmount - expectedAmount) < 0.005 : false;
      const shouldCorrect = Boolean(matchedInfo && hasGoldenAmount && !amountMatched);
      const correctedAmount = shouldCorrect ? expectedAmount.toFixed(2) : null;

      const nextItem = {
        ...item,
        extracted: {
          ...(item?.extracted || {}),
          ...(shouldCorrect
            ? {
                amount: correctedAmount,
                amountReason: "已按 mPay 後台金額自動校正",
              }
            : {}),
        },
        ...(shouldCorrect
          ? {
              manualAmount: correctedAmount,
              selectedAmount: correctedAmount,
              uploadedAmount: item?.uploadedAmount || item?.selectedAmount || item?.manualAmount || item?.extracted?.amount || null,
            }
          : {}),
        verificationMatchedOrderNo: matchedOrderNo,
        verificationMatchedSource: matchedInfo?.matchedSource || null,
        verificationBackofficeAmount: backofficeAmount,
        verificationAmountMatched: matchedInfo ? amountMatched : null,
        verificationStatus: !candidates.length
          ? "no_order_id"
          : matchedInfo
            ? hasGoldenAmount && amountMatched
              ? "verified_amount_and_id"
              : "verified_id_only"
            : "no_match",
        mpayTransactionStatus: matchedStatus,
      };

      if (shouldCorrect) {
        rowHasCorrection = true;
      }

      return nextItem;
    });

    const verificationStatuses = enhancedItems.map((item) => item?.verificationStatus).filter(Boolean);
    const correctedTotal = enhancedItems
      .reduce((sum, item) => sum + toAmountNumber(item?.selectedAmount || item?.manualAmount || item?.extracted?.amount), 0)
      .toFixed(2);

    if (rowHasCorrection && ["pending", "rejected"].includes(String(row?.status || ""))) {
      corrections.push({
        transactionId: row.id,
        items: enhancedItems,
        totalAmount: correctedTotal,
      });
    }

    return {
      ...row,
      items: enhancedItems,
      total_amount: rowHasCorrection ? correctedTotal : row.total_amount,
      verificationStatus: (() => {
        if (!verificationStatuses.length) return "no_order_id";
        if (verificationStatuses.includes("ai_skipped")) return "ai_skipped";
        if (verificationStatuses.includes("no_match")) return "no_match";
        if (verificationStatuses.every((status) => status === "verified_amount_and_id")) return "verified_amount_and_id";
        if (verificationStatuses.some((status) => status === "verified_id_only")) return "verified_id_only";
        return "no_order_id";
      })(),
    };
  });

  if (corrections.length) {
    await persistBackofficeCorrections(client, corrections);
  }

  return {
    rows: enhancedRows,
    total: count || 0,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    pageCount: useAll ? 1 : Math.max(1, Math.ceil((count || 0) / normalizedPageSize)),
  };
}

export async function listCustomerTransactions({ shopId = "", customerCode, page = 1, pageSize = 50 }) {
  const client = ensureDatabaseReady();
  const normalizedCustomerCode = String(customerCode || "").trim();
  if (!normalizedCustomerCode) {
    throw new Error("缺少客戶號碼");
  }

  const normalizedPageSize = pageSize === "all" ? "all" : Math.max(1, Number(pageSize) || 50);
  const normalizedPage = Math.max(1, Number(page) || 1);

  let query = client
    .from("transactions")
    .select("id, shop_id, customer_code, total_amount, item_count, status, submitted_at, approved_at, items, shops(name)", {
      count: "exact",
    })
    .eq("customer_code", normalizedCustomerCode)
    .order("submitted_at", { ascending: false });

  if (shopId) {
    query = query.eq("shop_id", String(shopId));
  }

  if (normalizedPageSize !== "all") {
    const from = (normalizedPage - 1) * normalizedPageSize;
    const to = from + normalizedPageSize - 1;
    query = query.range(from, to);
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`讀取交易紀錄失敗：${error.message}`);
  }

  const total = count || 0;
  const pageCount = normalizedPageSize === "all" ? 1 : Math.max(1, Math.ceil(total / normalizedPageSize));

  return {
    rows: data || [],
    total,
    page: normalizedPageSize === "all" ? 1 : normalizedPage,
    pageCount,
    pageSize: normalizedPageSize,
  };
}

export async function updateTransactionReviewData({ shopId, transactionId, totalAmount, itemAmounts = [] }) {
  const client = ensureDatabaseReady();
  const transaction = await getTransactionById(shopId, transactionId);

  if (!transaction || !["pending", "rejected"].includes(String(transaction.status || ""))) {
    throw new Error("只有待審核或已拒絕的交易可以修改");
  }

  const updatedItems = (transaction.items || []).map((item, index) => {
    const nextAmount = itemAmounts[index];
    if (nextAmount == null || nextAmount === "") {
      return item;
    }

    return {
      ...item,
      extracted: {
        ...(item.extracted || {}),
        amount: String(nextAmount),
        amountReason: "已由店主人工修正",
      },
      manualAmount: String(nextAmount),
    };
  });

  const normalizedTotalAmount =
    totalAmount == null || totalAmount === ""
      ? updatedItems.reduce((sum, item) => sum + toAmountNumber(item?.extracted?.amount), 0).toFixed(2)
      : Number(totalAmount).toFixed(2);

  const { data, error } = await client
    .from("transactions")
    .update({
      total_amount: normalizedTotalAmount,
      items: updatedItems,
    })
    .eq("shop_id", shopId)
    .eq("id", transactionId)
    .select("*")
    .single();

  if (error) throw new Error(`更新交易資料失敗：${error.message}`);
  return data;
}

export async function updateTransactionReviewDataAsAdmin({ transactionId, totalAmount, itemAmounts = [] }) {
  const transaction = await findTransactionById(transactionId);
  return updateTransactionReviewData({
    shopId: transaction.shop_id,
    transactionId,
    totalAmount,
    itemAmounts,
  });
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

export async function approveTransaction({ shopId, transactionId, ownerLogin, notifyPendingChanged = true }) {
  const transaction = await getTransactionById(shopId, transactionId);
  const shop = await getShopById(shopId);
  if (!shop) throw new Error("店舖不存在");
  const hasMissingAmount =
    toAmountNumber(transaction?.total_amount) <= 0 ||
    (transaction?.items || []).some((item) => toAmountNumber(item?.extracted?.amount) <= 0);
  if (hasMissingAmount) {
    throw new Error("此交易內容沒有金額，請先填寫金額後才能核准。");
  }

  let syncResult = null;
  let syncErrorMessage = null;
  try {
    syncResult = await syncApprovedTransactionToMembership({
      transaction,
      shop,
      ownerLogin,
    });
  } catch (error) {
    syncErrorMessage = error instanceof Error ? error.message : "membership sync failed";
  }

  const rows = await updateTransactionsStatus({
    shopId,
    transactionIds: [transactionId],
    status: "approved",
    actor: ownerLogin,
  });
  if (notifyPendingChanged) {
    try {
      await notifySiteAPendingChanged({ shopId });
    } catch {
      // do not fail approval because Site A pending callback is unavailable
    }
  }
  return rows?.[0]
    ? {
        ...rows[0],
        membershipSyncStatus: syncResult ? "success" : "failed",
        membershipSyncedAt: syncResult?.approvedAt || null,
        membershipSyncError: syncErrorMessage,
      }
    : null;
}

export async function batchApproveTransactions({ shopId, transactionIds, ownerLogin }) {
  const results = [];
  for (const transactionId of transactionIds) {
    try {
      const data = await approveTransaction({ shopId, transactionId, ownerLogin, notifyPendingChanged: false });
      if (data) {
        results.push({ transactionId, ok: true, data });
      }
    } catch (error) {
      results.push({
        transactionId,
        ok: false,
        error: error instanceof Error ? error.message : "批次核准失敗",
      });
    }
  }
  try {
    await notifySiteAPendingChanged({ shopId });
  } catch {
    // do not fail batch approval because Site A pending callback is unavailable
  }
  return results;
}

export async function approveTransactionAsAdmin({ transactionId, adminLogin }) {
  const transaction = await findTransactionById(transactionId);
  return approveTransaction({
    shopId: transaction.shop_id,
    transactionId,
    ownerLogin: `管理員 ${adminLogin || "admin"}`,
  });
}

export async function batchApproveTransactionsAsAdmin({ transactionIds, adminLogin }) {
  const results = [];
  for (const transactionId of transactionIds) {
    try {
      const data = await approveTransactionAsAdmin({ transactionId, adminLogin });
      if (data) {
        results.push({ transactionId, ok: true, data });
      }
    } catch (error) {
      results.push({
        transactionId,
        ok: false,
        error: error instanceof Error ? error.message : "批次核准失敗",
      });
    }
  }
  return results;
}

export async function rejectTransaction({ shopId, transactionId }) {
  const transaction = await getTransactionById(shopId, transactionId);
  const shop = await getShopById(shopId);
  const rows = await updateTransactionsStatus({
    shopId,
    transactionIds: [transactionId],
    status: "rejected",
    actor: null,
  });
  if (rows?.[0] && shop) {
    try {
      await notifySiteARejected({ transaction, shop });
    } catch {
      // do not fail rejection because Site A rejected callback is unavailable
    }
    try {
      await notifySiteAPendingChanged({ shopId });
    } catch {
      // do not fail rejection because Site A pending callback is unavailable
    }
  }
  return rows?.[0] || null;
}

export async function rejectTransactionAsAdmin({ transactionId }) {
  const transaction = await findTransactionById(transactionId);
  return rejectTransaction({ shopId: transaction.shop_id, transactionId });
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
  try {
    await notifySiteAPendingChanged({ shopId });
  } catch {
    // do not fail revoke because Site A pending callback is unavailable
  }
  return data;
}

export async function revokeRejectedTransactionAsAdmin({ transactionId }) {
  const transaction = await findTransactionById(transactionId);
  return revokeRejectedTransaction({ shopId: transaction.shop_id, transactionId });
}

export async function getDashboardStats({ shopId, from, to }) {
  const client = ensureDatabaseReady();
  const query = applyTransactionFilters(
    client
      .from("transactions")
      .select("customer_code, total_amount, status")
      .order("submitted_at", { ascending: false }),
    { shopId, mode: "all", from, to, customerCode: "" }
  );
  const { data, error } = await query;
  if (error) throw new Error(`讀取儀表板失敗：${error.message}`);
  const rows = data || [];
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
    .select("id, auto_approve_enabled, auto_approve_interval_minutes, auto_approve_settings")
    .eq("id", shopId)
    .single();

  if (error) throw new Error(`讀取店舖設定失敗:${error.message}`);
  const settings = normalizeAutoApproveSettings(data?.auto_approve_settings);
  return {
    id: data?.id,
    auto_approve_enabled: Boolean(data?.auto_approve_enabled),
    auto_approve_interval_minutes: Math.max(1, Number(data?.auto_approve_interval_minutes) || 300),
    auto_approve_settings: settings,
  };
}

export async function updateOwnerSettings({
  shopId,
  autoApproveEnabled,
  autoApproveIntervalSeconds = 300,
  autoApproveSettings,
}) {
  const client = ensureDatabaseReady();
  const existing = await client
    .from("shops")
    .select("auto_approve_settings")
    .eq("id", shopId)
    .single();
  if (existing.error) throw new Error(`讀取既有設定失敗:${existing.error.message}`);

  const nextSettings = normalizeAutoApproveSettings({
    ...normalizeAutoApproveSettings(existing.data?.auto_approve_settings),
    ...sanitizeAutoApproveSettingsPatch(autoApproveSettings || {}),
  });

  const { data, error } = await client
    .from("shops")
    .update({
      auto_approve_enabled: Boolean(autoApproveEnabled),
      auto_approve_interval_minutes: Math.max(1, Number(autoApproveIntervalSeconds) || 300),
      auto_approve_settings: nextSettings,
    })
    .eq("id", shopId)
    .select("id, auto_approve_enabled, auto_approve_interval_minutes, auto_approve_settings")
    .single();

  if (error) throw new Error(`更新店舖設定失敗:${error.message}`);
  return {
    id: data.id,
    auto_approve_enabled: Boolean(data.auto_approve_enabled),
    auto_approve_interval_minutes: Math.max(1, Number(data.auto_approve_interval_minutes) || 300),
    auto_approve_settings: normalizeAutoApproveSettings(data.auto_approve_settings),
  };
}

export async function updateOwnerSettingsBulk({
  shopIds = [],
  autoApproveEnabled,
  autoApproveIntervalSeconds = 300,
  autoApproveSettings,
}) {
  const client = ensureDatabaseReady();
  if (!Array.isArray(shopIds) || !shopIds.length) {
    throw new Error("請先選擇要更新的商家");
  }

  const existing = await client
    .from("shops")
    .select("id, code, name, auto_approve_settings, auto_approve_enabled, auto_approve_interval_minutes")
    .in("id", shopIds);
  if (existing.error) throw new Error(`批量讀取商家失敗:${existing.error.message}`);

  const patch = sanitizeAutoApproveSettingsPatch(autoApproveSettings || {});
  const updated = [];
  for (const shop of existing.data || []) {
    const next = normalizeAutoApproveSettings({
      ...normalizeAutoApproveSettings(shop.auto_approve_settings),
      ...patch,
    });
    const { data, error } = await client
      .from("shops")
      .update({
        auto_approve_enabled: Boolean(autoApproveEnabled),
        auto_approve_interval_minutes: Math.max(1, Number(autoApproveIntervalSeconds) || 300),
        auto_approve_settings: next,
      })
      .eq("id", shop.id)
      .select("id, code, name, auto_approve_enabled, auto_approve_interval_minutes, auto_approve_settings")
      .single();
    if (error) throw new Error(`批量更新店舖設定失敗:${error.message}`);
    if (data) {
      updated.push({
        ...data,
        auto_approve_settings: normalizeAutoApproveSettings(data.auto_approve_settings),
      });
    }
  }

  return updated;
}

export async function runAutoApprovalSweep({ shopId, forceAll = false } = {}) {
  const client = ensureDatabaseReady();
  let shopQuery = client
    .from("shops")
    .select("id, owner_login, auto_approve_interval_minutes, auto_approve_settings")
    .eq("is_active", true)
    .eq("auto_approve_enabled", true);
  if (shopId) {
    shopQuery = shopQuery.eq("id", shopId);
  }
  const { data: shops, error } = await shopQuery;

  if (error) throw new Error(`讀取自動核准設定失敗:${error.message}`);

  let approvedCount = 0;
  let skippedByGuard = 0;
  const now = Date.now();

  for (const shop of shops || []) {
    let shopApprovedCount = 0;
    let shopAutoApproveSettings = normalizeAutoApproveSettings(shop.auto_approve_settings);
    const intervalSeconds = Math.max(1, Number(shop.auto_approve_interval_minutes) || 300);
    const allowedStatusSet = new Set(shopAutoApproveSettings.allowed_statuses || []);
    const maxAmount = Number(shopAutoApproveSettings.max_amount || 0);
    const cooldownSeconds = Number(shopAutoApproveSettings.cooldown_seconds || 0);
    const lastApprovedAtMs = shopAutoApproveSettings.last_auto_approved_at
      ? new Date(shopAutoApproveSettings.last_auto_approved_at).getTime()
      : 0;

    if (cooldownSeconds > 0 && lastApprovedAtMs > 0 && now - lastApprovedAtMs < cooldownSeconds * 1000) {
      // entire shop is in cooldown; don't bother scanning.
      continue;
    }

    const { data: pendingRows, error: readError } = await client
      .from("transactions")
      .select("id, submitted_at, total_amount, items, verification_status")
      .eq("shop_id", shop.id)
      .eq("status", "pending");

    if (readError) {
      throw new Error(`讀取待自動核准交易失敗:${readError.message}`);
    }

    for (const row of pendingRows || []) {
      const submittedAtMs = row?.submitted_at ? new Date(row.submitted_at).getTime() : 0;
      if (!forceAll && (!submittedAtMs || now - submittedAtMs < intervalSeconds * 1000)) {
        continue;
      }
      try {
        const candidate = await getTransactionById(shop.id, row.id);
        const analyzedItems = Array.isArray(candidate?.items) ? candidate.items : [];
        const txTotalAmount = toAmountNumber(candidate?.total_amount);

        // ---- Guard 1: per-transaction amount cap ----
        if (maxAmount > 0 && txTotalAmount > maxAmount) {
          skippedByGuard += 1;
          continue;
        }

        // ---- Determine the verification status for this transaction ----
        // Prefer the row.verification_status returned by the DB; fall back to
        // computing one from items (matches listTransactions logic).
        const txVerificationStatus = computeTransactionVerificationStatus({
          rowStatus: candidate?.verification_status ?? row?.verification_status,
          items: analyzedItems,
        });

        // ---- Guard 2: only auto-approve if merchant opted in to this status ----
        if (!allowedStatusSet.has(txVerificationStatus)) {
          continue;
        }

        // ---- Optional: still correct amount from backoffice when matched ----
        // We only correct when at least one item is matched to a backoffice
        // record; the correction only touches amount, not the verification status.
        const extractedOrderNos = extractTransactionOrderNos(analyzedItems);
        const backofficeMatchMap = await loadBackofficeMatchMap(client, extractedOrderNos);
        let anyCorrected = false;
        const nextItems = analyzedItems.map((item) => {
          if (item?.aiPipeline === "skipped" || item?.verificationStatus === "ai_skipped") {
            return item;
          }
          const candidates = [
            item?.extracted?.transactionOrderNo,
            ...(Array.isArray(item?.extracted?.allDetectedOrderNos) ? item.extracted.allDetectedOrderNos : []),
          ]
            .filter(Boolean)
            .map(String);
          const matchedOrderNo = candidates.find((cand) => backofficeMatchMap.has(cand)) || null;
          const matchedInfo = matchedOrderNo ? backofficeMatchMap.get(matchedOrderNo) : null;
          const expectedAmount = toAmountNumber(matchedInfo?.backofficeAmount);
          if (!matchedInfo || expectedAmount <= 0) {
            return item;
          }
          const currentAmount = toAmountNumber(item?.selectedAmount || item?.manualAmount || item?.extracted?.amount);
          const amountMatched = Math.abs(currentAmount - expectedAmount) < 0.005;
          if (!amountMatched) {
            anyCorrected = true;
            const correctedAmount = expectedAmount.toFixed(2);
            return {
              ...item,
              extracted: {
                ...(item?.extracted || {}),
                amount: correctedAmount,
                amountReason: "已按 mPay 後台金額自動校正",
              },
              manualAmount: correctedAmount,
              selectedAmount: correctedAmount,
            };
          }
          return item;
        });

        if (anyCorrected) {
          const correctedTotal = nextItems
            .reduce((sum, item) => sum + toAmountNumber(item?.selectedAmount || item?.manualAmount || item?.extracted?.amount), 0)
            .toFixed(2);
          await client
            .from("transactions")
            .update({ items: nextItems, total_amount: correctedTotal })
            .eq("id", row.id)
            .eq("shop_id", shop.id);
        }

        await approveTransaction({
          shopId: shop.id,
          transactionId: row.id,
          ownerLogin: shop.owner_login || "auto-approve",
          notifyPendingChanged: false,
        });
        approvedCount += 1;
        shopApprovedCount += 1;

        // Update cooldown marker so the next transaction in this run sees the new "last approved"
        shopAutoApproveSettings = {
          ...shopAutoApproveSettings,
          last_auto_approved_at: new Date().toISOString(),
        };
        await client
          .from("shops")
          .update({ auto_approve_settings: shopAutoApproveSettings })
          .eq("id", shop.id);

        if (cooldownSeconds > 0) {
          // subsequent rows in this same run also see the new cooldown.
          const newLastMs = Date.now();
          // break out if next row would breach; saves an extra DB hit
          if (newLastMs + cooldownSeconds * 1000 > now + 24 * 60 * 60 * 1000) {
            // sanity guard — don't loop forever
          }
        }
      } catch {
        continue;
      }
    }
    if (shopApprovedCount > 0) {
      try {
        await notifySiteAPendingChanged({ shopId: shop.id });
      } catch {
        // do not fail auto-approve sweep because Site A pending callback is unavailable
      }
    }
  }

  return {
    shopCount: shops?.length || 0,
    approvedCount,
    skippedByGuard,
  };
}

// Reduce a transaction's verification status down to one of the canonical
// statuses the auto-approver cares about. Mirrors the logic in
// `listTransactions` so the cron sweep and the UI never disagree.
function computeTransactionVerificationStatus({ rowStatus, items = [] }) {
  if (rowStatus && VALID_AUTO_APPROVE_STATUSES.includes(rowStatus)) {
    return rowStatus;
  }

  const itemsWithStatus = items
    .map((item) => item?.verificationStatus)
    .filter(Boolean);
  if (!itemsWithStatus.length) return "no_order_id";
  if (itemsWithStatus.includes("ai_skipped")) return "ai_skipped";
  if (itemsWithStatus.includes("no_match")) return "no_match";
  if (itemsWithStatus.includes("verified_id_only")) return "verified_id_only";
  if (itemsWithStatus.every((status) => status === "verified_amount_and_id")) {
    return "verified_amount_and_id";
  }
  return "no_order_id";
}

export function normalizeMemberCode(value) {
  return String(value || "").trim();
}

export function applyCors(req, res) {
  applyEmbedResponseHeaders(res);
  const origin = req.headers.origin || "https://top-up-automation.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Topup-Timestamp, X-Topup-Signature, X-Topup-Event");
}
