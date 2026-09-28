import type { IncomingMessage, ServerResponse } from "node:http";
import { handleLocalApi } from "../local-api";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await handleLocalApi(req, res);
  } catch (err: any) {
    console.error("Unhandled API error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Internal Server Error",
          message: err?.message || String(err),
        })
      );
    }
  }
}
