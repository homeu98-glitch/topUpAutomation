import crypto from "node:crypto";

const COOKIE_NAME = "topup_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
}

export function readSession(req) {
  const cookies = parseCookies(req);
  const cookieValue = cookies[COOKIE_NAME];
  if (!cookieValue) return null;

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function writeSession(res, payload) {
  const value = {
    ...payload,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(value));
  const signature = sign(encodedPayload);
  const cookie = `${COOKIE_NAME}=${encodedPayload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Secure`;
  res.setHeader("Set-Cookie", cookie);
}

export function clearSession(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`
  );
}
