import { exchangeMembershipLoginToken, applyCors } from "../../lib/topup-service.js";
import { writeSession } from "../../lib/session.js";

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
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: "缺少 membership token" });
    }

    const payload = await exchangeMembershipLoginToken({
      token: String(token),
      req,
    });

    writeSession(res, {
      role: "customer",
      memberCode: payload.user.memberCode,
      authSource: payload.user.authSource || "membership",
      externalMemberId: payload.user.externalMemberId || null,
      fullName: payload.user.fullName || null,
      phone: payload.user.phone || null,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "會員系統登入失敗",
    });
  }
}
