import { applyCors, exchangeMembershipLoginToken } from "../../lib/topup-service.js";
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
    const { token, ssoToken } = req.body || {};
    const finalToken = String(ssoToken || token || "");
    if (!finalToken) {
      return res.status(400).json({ error: "缺少 SSO token" });
    }

    const payload = await exchangeMembershipLoginToken({
      token: finalToken,
      req,
    });

    writeSession(res, {
      role: payload.user.role,
      memberCode: payload.user.memberCode || null,
      ownerLogin: payload.user.ownerLogin || null,
      authSource: payload.user.authSource || "membership",
      externalMemberId: payload.user.externalMemberId || null,
      fullName: payload.user.fullName || null,
      phone: payload.user.phone || null,
      shopId: payload.user.shopId || null,
      shopName: payload.user.shopName || null,
      shopCode: payload.user.shopCode || null,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "SSO 登入失敗",
    });
  }
}
