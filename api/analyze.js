import fs from "node:fs/promises";

import formidable from "formidable";

import { normalizeMemberCode, processUploadedFiles } from "../lib/topup-service.js";

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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fields, files } = await parseForm(req);
    const uploadedFiles = normalizeArray(files.images);

    if (!uploadedFiles.length) {
      return res.status(400).json({ error: "請先選擇圖片" });
    }

    if (uploadedFiles.length > 10) {
      return res.status(400).json({ error: "一次最多只可上傳 10 張圖片" });
    }

    const normalizedFiles = await Promise.all(
      uploadedFiles.map(async (file) => {
        const buffer = await fs.readFile(file.filepath);
        return {
          buffer,
          size: file.size,
          originalname: file.originalFilename || "upload.jpg",
          mimetype: file.mimetype || "image/jpeg",
        };
      })
    );

    const memberCode = normalizeMemberCode(normalizeArray(fields.memberCode)[0]);
    const payload = await processUploadedFiles(normalizedFiles, memberCode);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "系統錯誤，請稍後再試",
    });
  }
}
