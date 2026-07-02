import { Request, Response, Express } from "express";
import { createExpressApp } from "../server";

let cachedApp: Express | null = null;

export default async function handler(req: Request, res: Response) {
  console.log(`[Vercel Serverless] Incoming request: ${req.method} ${req.url}`);

  // Restore the original URL if Vercel's routing rewrote it
  const matchedPath = req.headers["x-matched-path"] as string;
  if (matchedPath && matchedPath !== req.url && matchedPath.startsWith("/api")) {
    console.log(`[Vercel Serverless] Correcting req.url from ${req.url} to ${matchedPath}`);
    req.url = matchedPath;
  }

  if (!cachedApp) {
    console.log("[Vercel] Initializing Express app...");
    cachedApp = await createExpressApp();
  }
  return cachedApp(req, res);
}

