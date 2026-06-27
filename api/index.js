import serverless from "serverless-http";

import app from "../server.js";

const handler = serverless(app);

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function vercelHandler(req, res) {
  return handler(req, res);
}
