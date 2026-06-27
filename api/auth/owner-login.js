import { applyCors, findOwnerByLogin } from "../../lib/topup-service.js";
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
    const owner = await findOwnerByLogin(String(login || "").trim());

    if (!owner || !owner.is_active) {
      return res.status(401).json({ error: "帳號或密碼錯誤" });
    }

    if (String(password || "") !== String(owner.owner_password || "")) {
      return res.status(401).json({ error: "帳號或密碼錯誤" });
    }

    writeSession(res, {
      role: "owner",
      ownerLogin: owner.owner_login,
      shopId: owner.id,
      shopName: owner.name,
    });

    return res.status(200).json({
      user: {
        role: "owner",
        ownerLogin: owner.owner_login,
        shopId: owner.id,
        shopName: owner.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "店主登入失敗",
    });
  }
}
