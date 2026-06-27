import { ensureStorageDir, getHealthPayload } from "../lib/topup-service.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  await ensureStorageDir();
  return res.status(200).json(getHealthPayload());
}
