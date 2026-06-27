import analyzeHandler, { config as analyzeConfig } from "./analyze.js";
import healthHandler from "./health.js";

export const config = analyzeConfig;

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/health")) {
    return healthHandler(req, res);
  }

  if (pathname.endsWith("/analyze")) {
    return analyzeHandler(req, res);
  }

  return res.status(200).json({
    ok: true,
    route: "api/index",
    message: "API is reachable",
  });
}
