import fs from "node:fs/promises";

import formidable from "formidable";

import { applyCors, createTransactionSubmission, getShopById } from "../../lib/topup-service.js";
import { readSession, refreshSession } from "../../lib/session.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req) {
  const form = formidable({
    multiples: true,
    maxFiles: 10,
    maxFileSize: 12 * 1024 * 1024,
    allowEmptyFiles: false,
    filter: ({ mimetype }) => Boolean(mimetype && mimetype.startsWith("image/")),
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

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
    if (!session || session.role !== "customer" || !session.memberCode) {
      return res.status(401).json({ error: "請先從澳門會員通進入並完成驗證登入" });
    }
    refreshSession(res, session);

    const { fields, files } = await parseForm(req);
    const uploadedFiles = normalizeArray(files.images);
    const requestedShopId = String(normalizeArray(fields.shopId)[0] || "");
    const shopId = String(session.shopId || requestedShopId || "");

    if (!uploadedFiles.length) {
      return res.status(400).json({ error: "請先上傳圖片" });
    }

    const shop = await getShopById(shopId);
    if (!shop) {
      return res.status(400).json({ error: "請先選擇有效店舖" });
    }

    const normalizedFiles = await Promise.all(
      uploadedFiles.map(async (file) => ({
        buffer: await fs.readFile(file.filepath),
        size: file.size,
        originalname: file.originalFilename || "upload.jpg",
        mimetype: file.mimetype || "image/jpeg",
      }))
    );

    const analyzedItems = normalizedFiles.map(() => ({
      aiPipeline: "skipped",
      verificationStatus: "ai_skipped",
      extracted: {
        merchantName: null,
        transactionOrderNo: null,
        amount: null,
        transactionTime: null,
        orderStatus: null,
        paymentMethod: null,
        allDetectedAmounts: [],
        allDetectedOrderNos: [],
        amountReason: "AI 暫時不可用，已改為人工審核",
        confidence: null,
        rawLabels: {},
      },
    }));

    const payload = await createTransactionSubmission({
      shopId: shop.id,
      customerCode: session.memberCode,
      files: normalizedFiles,
      analyzedItems,
    });

    return res.status(200).json({
      ok: true,
      message: "AI 暫時不可用，已直接送出給店主人工審核",
      transactionId: payload.transactionId,
      totalAmount: payload.totalAmount,
      status: payload.status,
      aiSkipped: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "送出審核失敗",
    });
  }
}

