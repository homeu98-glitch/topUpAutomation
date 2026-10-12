import { applyCors, findAdminByLogin } from "../../lib/topup-service.js";
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
    const { login, password } = req.body || {};
    const admin = await findAdminByLogin(String(login || "").trim());

    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: "帳號或密碼錯誤" });
    }

    if (String(password || "") !== String(admin.admin_password || "")) {
      return res.status(401).json({ error: "帳號或密碼錯誤" });
    }

    writeSession(res, {
      role: "admin",
      adminLogin: admin.admin_login,
      fullName: admin.name,
    });

    return res.status(200).json({
      user: {
        role: "admin",
        adminLogin: admin.admin_login,
        fullName: admin.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "管理員登入失敗",
    });
  }
}
