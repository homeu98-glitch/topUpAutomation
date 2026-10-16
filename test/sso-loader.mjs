// ESM loader used ONLY by the verification test so that lib/topup-service.js
// can be imported without its heavy/optional top-level deps (supabase, dotenv,
// sharp, embed-policy). The JWT verification path we are testing never calls
// any of those at runtime, so stubbing them is safe for this probe.
const STUBS = {
  "@supabase/supabase-js": `export function createClient(){ return {}; }`,
  dotenv: `const dotenv = { config(){ return {}; } }; export default dotenv; export function config(){ return {}; }`,
  sharp: `const sharp = function(){ return {}; }; export default sharp;`,
};

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) {
    const url = "data:text/javascript;base64," + Buffer.from(STUBS[specifier]).toString("base64");
    return { url, shortCircuit: true };
  }
  if (specifier.endsWith("embed-policy.js")) {
    const src = `export function applyEmbedResponseHeaders(){}`;
    const url = "data:text/javascript;base64," + Buffer.from(src).toString("base64");
    return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
