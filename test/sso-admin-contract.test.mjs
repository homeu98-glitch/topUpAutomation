// Verification test for the Admin SSO contract (Phase 4).
//
// Goal: prove that the REAL lib/topup-service.js ACCEPTS an admin login token
// minted with the ALIGNED contract (iss=site-a, aud=site-b, role:"admin") and
// REJECTS every wrong-shaped token (bad issuer/audience, customer role without
// shop/member, expired, tampered signature).
//
// It also confirms the existing owner path still validates (regression guard)
// and that the `portal_role` alias is accepted.
//
// Run:  node test/sso-admin-contract.test.mjs   (uses the stub loader)

import { register } from "node:module";
import crypto from "node:crypto";

// Register the stub loader BEFORE importing the production module.
register("./sso-loader.mjs", import.meta.url);

// The SSO contract env MUST be set before import (constants are read at load).
const SECRET = "test-shared-secret-for-verification-only";
process.env.SITEA_SSO_SECRET = SECRET;
process.env.SITEA_SSO_ISSUER = "site-a";
process.env.SITEA_SSO_AUDIENCE = "site-b";
process.env.SITEA_SSO_ENABLED = "true";

const { verifyMembershipLoginToken } = await import("../lib/topup-service.js");

function mintToken(payloadOverrides, secret = SECRET) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 300, jti: crypto.randomUUID(), ...payloadOverrides };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${sig}`;
}

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

// 1. Aligned admin contract accepted
try {
  const t = mintToken({
    iss: "site-a",
    aud: "site-b",
    sub: "ledger-admin-1",
    role: "admin",
    member_code: "60000000",
    full_name: "Ledger 管理員",
  });
  const { claims } = verifyMembershipLoginToken(t);
  check("admin token (site-a / site-b / role:admin) accepted", claims.portal_role === "admin", `got ${claims.portal_role}`);
} catch (e) {
  check("admin token (site-a / site-b / role:admin) accepted", false, e.message);
}

// 2. Wrong issuer rejected
try {
  const t = mintToken({ iss: "main-membership-system", aud: "site-b", sub: "x", role: "admin", member_code: "60000000" });
  verifyMembershipLoginToken(t);
  check("wrong issuer rejected", false, "should have thrown");
} catch (e) {
  check("wrong issuer rejected", /issuer/i.test(e.message), e.message);
}

// 3. Wrong audience rejected
try {
  const t = mintToken({ iss: "site-a", aud: "topup-portal", sub: "x", role: "admin", member_code: "60000000" });
  verifyMembershipLoginToken(t);
  check("wrong audience rejected", false, "should have thrown");
} catch (e) {
  check("wrong audience rejected", /audience/i.test(e.message), e.message);
}

// 4. Customer token (no shop/member) must NOT be accepted on the admin path
try {
  const t = mintToken({ iss: "site-a", aud: "site-b", sub: "cust", role: "customer" });
  verifyMembershipLoginToken(t);
  check("customer token rejected (missing shop/member)", false, "should have thrown");
} catch (e) {
  check("customer token rejected (missing shop/member)", true, e.message);
}

// 5. Expired token rejected
try {
  const t = mintToken({
    iss: "site-a",
    aud: "site-b",
    sub: "x",
    role: "admin",
    member_code: "60000000",
    exp: Math.floor(Date.now() / 1000) - 100,
  });
  verifyMembershipLoginToken(t);
  check("expired token rejected", false, "should have thrown");
} catch (e) {
  check("expired token rejected", /過期|expired/i.test(e.message), e.message);
}

// 6. portal_role alias accepted
try {
  const t = mintToken({ iss: "site-a", aud: "site-b", sub: "x", portal_role: "admin", member_code: "60000000" });
  const { claims } = verifyMembershipLoginToken(t);
  check("portal_role alias accepted", claims.portal_role === "admin", `got ${claims.portal_role}`);
} catch (e) {
  check("portal_role alias accepted", false, e.message);
}

// 7. Owner token still validates (regression)
try {
  const t = mintToken({
    iss: "site-a",
    aud: "site-b",
    sub: "x",
    role: "owner",
    shop_id: "65273599",
    shop_code: "65273599",
    shop_name: "表嫂美食",
  });
  const { claims } = verifyMembershipLoginToken(t);
  check("owner token still accepted (regression)", claims.portal_role === "owner", `got ${claims.portal_role}`);
} catch (e) {
  check("owner token still accepted (regression)", false, e.message);
}

// 8. Tampered signature rejected
try {
  const t = mintToken({ iss: "site-a", aud: "site-b", sub: "x", role: "admin", member_code: "60000000" });
  const tampered = t.slice(0, -4) + "AAAA";
  verifyMembershipLoginToken(tampered);
  check("tampered signature rejected", false, "should have thrown");
} catch (e) {
  check("tampered signature rejected", /驗證失敗|格式錯誤/i.test(e.message), e.message);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
