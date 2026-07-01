import { Request, Response, Express } from "express";
import { createExpressApp } from "../server";

let cachedApp: Express | null = null;

export default async function handler(req: Request, res: Response) {
  if (!cachedApp) {
    console.log("[Vercel] Initializing Express app...");
    cachedApp = await createExpressApp();
  }
  return cachedApp(req, res);
}

