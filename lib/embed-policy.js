/** CSP frame-ancestors for POS / Ledger iframe embed. Comma or space separated. */
const DEFAULT_FRAME_ANCESTORS = [
  "'self'",
  "https://macau-ledger.vercel.app",
  "https://macau-pos-system.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export function buildFrameAncestorsDirective() {
  const raw = process.env.TOPUP_FRAME_ANCESTORS?.trim();
  const sources = raw
    ? raw.split(/[\s,]+/).filter(Boolean)
    : DEFAULT_FRAME_ANCESTORS;
  return `frame-ancestors ${sources.join(" ")}`;
}

/** Allow owner/customer pages to load inside POS or Ledger iframe. */
export function applyEmbedResponseHeaders(res) {
  if (!res || typeof res.setHeader !== "function") return;
  res.setHeader("Content-Security-Policy", buildFrameAncestorsDirective());
}
