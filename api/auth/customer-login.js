import { applyCors, findCustomerByCode } from "../../lib/topup-service.js";
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
    const { memberCode, password } = req.body || {};
    if (!/^\d{8}$/.test(String(memberCode || ""))) {
      return res.status(400).json({ error: "請輸入 8 位數會員編號" });
    }
    if (!/^\d{4}$/.test(String(password || ""))) {
      return res.status(400).json({ error: "請輸入 4 位數密碼" });
    }

    const customer = await findCustomerByCode(memberCode);
    if (!customer || !customer.is_active || String(customer.password || "") !== String(password || "")) {
      return res.status(401).json({ error: "會員編號或密碼錯誤" });
    }

    writeSession(res, {
      role: "customer",
      memberCode: String(memberCode),
      authSource: customer.auth_source || "local",
      externalMemberId: customer.external_member_id || null,
      fullName: customer.full_name || null,
      phone: customer.phone || null,
    });

    return res.status(200).json({
      user: {
        role: "customer",
        memberCode: String(memberCode),
        authSource: customer.auth_source || "local",
        externalMemberId: customer.external_member_id || null,
        fullName: customer.full_name || null,
        phone: customer.phone || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "客戶登入失敗",
    });
  }
}
