import fs from "fs";
import express from "express";
import path from "path";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import cors from "cors";
import dotenv from "dotenv";
import { sendWelcomeEmail } from "./emailService.js";

dotenv.config();

// --- Firebase Admin Setup ---
const getFirebaseConfig = () => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading firebase config:", e);
  }
  return null;
};

const getDb = (useDefault = false) => {
  const config = getFirebaseConfig();
  const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const databaseId = config?.firestoreDatabaseId;
  const APP_NAME = "gestor-cnl-backend";
  
  let app = admin.apps.find(a => a?.name === APP_NAME);
  
  if (!app) {
    console.log(`[Firebase] Initializing named admin app [${APP_NAME}] - Project: ${projectId}`);
    app = admin.initializeApp({
      projectId: projectId,
    }, APP_NAME);
  }
  
  // Use named database if available and not specifically asking for default
  if (!useDefault && databaseId && databaseId !== "(default)") {
    try {
      return getFirestore(app, databaseId);
    } catch (e: unknown) {
      const err = e as Error;
      console.warn(`[Firebase] Named database access failed: ${err.message}. Using default firestore.`);
    }
  }

  return getFirestore(app);
};

// --- Mercado Pago Setup ---
let mpClient: MercadoPagoConfig | null = null;
const getMpClient = () => {
  if (!mpClient) {
    mpClient = new MercadoPagoConfig({
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "placeholder",
    });
  }
  return mpClient;
};

export async function createExpressApp() {
  const app = express();

  // --- Middleware ---
  app.use(express.json());
  app.use(cors());

  // Request logger for debugging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // --- API Routes ---
  app.get("/api/health", (req, res) => {
    console.log("Health check request received");
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development", time: new Date().toISOString() });
  });

  app.get("/api/ping", (req, res) => {
    res.send("pong");
  });

  app.post("/api/payments/create-preference", async (req, res) => {
    const { userId, userEmail } = req.body;
    if (!userId || !userEmail) return res.status(400).json({ error: "Missing userId or userEmail" });

    try {
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = process.env.PUBLIC_URL || `${protocol}://${req.get("host")}`;
      console.log(`[MP] Creating preference for user ${userId} (${userEmail}) using host: ${host}`);
      
      const preference = new Preference(getMpClient());
      const result = await preference.create({
        body: {
          items: [{
            id: "plano-unico",
            title: "Gestor CNL - Plano Único",
            quantity: 1,
            unit_price: 39.90,
            currency_id: "BRL",
          }],
          payer: { email: userEmail },
          external_reference: userId,
          back_urls: {
            success: `${host}/#access-granted`,
            failure: `${host}/#payment-failed`,
            pending: `${host}/#payment-pending`,
          },
          auto_return: "approved",
          notification_url: `${host}/api/webhooks/mercadopago`,
        },
      });
      res.json({ init_point: result.init_point });
    } catch (error: unknown) {
      console.error("MP Preference Error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/webhooks/mercadopago", async (req, res) => {
    console.log("[MP Webhook] Received notification:", JSON.stringify(req.body));
    console.log("[MP Webhook] Query params:", JSON.stringify(req.query));
    console.log("[MP Webhook] Headers:", JSON.stringify(req.headers));
    
    // topic and id can come in query params or body depending on notification version
    const action = req.body.action || req.query.topic || req.body.type || req.query.type;
    const dataId = (req.body.data && req.body.data.id) || req.query.id || req.body.id;

    res.sendStatus(200);

    if ((action === "payment.created" || action === "payment.updated" || action === "payment" || action === "opened_dispute") && dataId) {
      try {
        console.log(`[MP Webhook] Processing payment ID: ${dataId}`);
        const payment = new Payment(getMpClient());
        const paymentData = await payment.get({ id: dataId });
        
        console.log(`[MP Webhook] Payment Status: ${paymentData.status}, External Ref: ${paymentData.external_reference}`);
        
        if (paymentData.status === "approved" && paymentData.external_reference) {
          const userId = paymentData.external_reference;
          console.log(`[MP Webhook] Granting access to user: ${userId}`);
          
          const updatePayload = {
            status: "APPROVED",
            hasAccess: true, 
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentId: dataId,
            paymentMethod: paymentData.payment_method_id,
            paymentType: paymentData.payment_type_id
          };

          try {
            const db = getDb();
            const userRef = db.collection("system_profiles").doc(userId);
            const userDoc = await userRef.get();
            const userData = userDoc.data();

            await userRef.set(updatePayload, { merge: true });

            // Send email if status was NOT approved before
            if (userData && userData.status !== "APPROVED") {
              console.log(`[MP Webhook] Status changed to APPROVED for ${userId}. Sending welcome email.`);
              sendWelcomeEmail(userData.email || paymentData.payer?.email, userData.displayName || userData.name || "Cliente").catch(e => console.error("Email send error:", e));
            }
          } catch (dbErr: unknown) {
             const err = dbErr as Error;
             console.warn("[MP Webhook] Primary DB update failed, trying fallback to (default):", err.message);
             const fallbackDb = getDb(true);
             const userRef = fallbackDb.collection("system_profiles").doc(userId);
             const userDoc = await userRef.get();
             const userData = userDoc.data();
             
             await userRef.set(updatePayload, { merge: true });

             if (userData && userData.status !== "APPROVED") {
               sendWelcomeEmail(userData.email || paymentData.payer?.email, userData.displayName || userData.name || "Cliente").catch(e => console.error("Email send error:", e));
             }
          }
          
          console.log(`[MP Webhook] SUCCESS: Access granted to ${userId}`);
        } else {
          console.log(`[MP Webhook] Payment not approved or missing external_reference. Status: ${paymentData.status}`);
        }
      } catch (error) {
        console.error("[MP Webhook] Error fetching/updating payment:", error);
      }
    } else {
      console.log(`[MP Webhook] Ignored notification. Action: ${action}, DataId: ${dataId}`);
    }
  });

  app.get("/api/payments/verify/:userId", async (req, res) => {
    const { userId } = req.params;
    const { paymentId, email } = req.query;
    console.log(`[Manual Verify] Checking status for user: ${userId}${paymentId ? ` with PaymentID: ${paymentId}` : ""}${email ? ` and Email: ${email}` : ""}`);
    
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const configStatus = (!token || token === "placeholder") ? "missing" : "ok";
    
    if (configStatus === "missing") {
        console.error("[Manual Verify] MERCADO_PAGO_ACCESS_TOKEN is missing!");
    }

    // 1. Check DB first (optional, don't fail if DB is down)
    let dbData: admin.firestore.DocumentData | undefined = undefined;
    
    try {
      try {
        const dbToUse = getDb();
        const doc = await dbToUse.collection("system_profiles").doc(userId).get();
        dbData = doc.data();
      } catch (dbErr: unknown) {
        const err = dbErr as Error;
        console.warn("[Manual Verify] Primary DB fetch failed, trying default:", err.message);
        const fallbackDb = getDb(true);
        const fallbackDoc = await fallbackDb.collection("system_profiles").doc(userId).get();
        dbData = fallbackDoc.data();
      }
    } catch (finalDbErr: unknown) {
      const err = finalDbErr as Error;
      console.error("[Manual Verify] DB fetch failed entirely:", err.message);
      // Fallback email from query if DB fetch failed
      if (!dbData && email) {
        dbData = { email: String(email).toLowerCase() };
        console.log(`[Manual Verify] Using email from query: ${dbData.email}`);
      }
    }
    
    if (dbData && (dbData.status === "APPROVED" || dbData.hasAccess)) {
      return res.json({ status: "APPROVED", hasAccess: true, source: "database", configStatus });
    }

    try {
      if (configStatus === "missing") {
        return res.json({ status: dbData?.status || "PENDING", hasAccess: false, source: "none", configStatus });
      }

      const payment = new Payment(getMpClient());
      let foundApproved = false;
      
      interface SearchPaymentResult {
        id?: string | number;
        status?: string;
        status_detail?: string;
        payment_method_id?: string;
        payment_type_id?: string;
        payer?: { email?: string };
        external_reference?: string;
      }

      let approvedData: SearchPaymentResult | null = null;

      // 2. If paymentId is provided, check it directly
      if (paymentId) {
        try {
          const finalId = String(paymentId).trim();
          if (finalId.length >= 8) {
            console.log(`[Manual Verify] Directly checking payment ID: ${finalId}`);
            const pData = await payment.get({ id: finalId });
            console.log(`[Manual Verify] Payment ${finalId} found. Status: ${pData.status}`);
            
            if (pData.status === "approved" || pData.status === "APPROVED") {
              const isRefMatch = pData.external_reference && String(pData.external_reference) === String(userId);
              const isEmailMatch = pData.payer?.email && dbData?.email && String(pData.payer.email).toLowerCase() === String(dbData.email).toLowerCase();
              
              if (isRefMatch || isEmailMatch) {
                foundApproved = true;
                approvedData = pData;
              } else {
                console.warn(`[Manual Verify] Payment ${finalId} is APPROVED but belongs to another customer (Ref: ${pData.external_reference}, Email: ${pData.payer?.email})`);
              }
            } else if (pData.status) {
              approvedData = pData; 
            }
          }
        } catch (idErr: unknown) {
          const err = idErr as Error;
          console.warn(`[Manual Verify] Direct ID lookup failed:`, err.message);
        }
      }

      if (!foundApproved) {
        // 3. Proactively check Mercado Pago using correct options filter
        console.log(`[Manual Verify V3] Searching for approved payments for user: ${userId}`);
        
        try {
          // In SDK v2, query filters go in the "options" object
          const searchByRef = await payment.search({
            options: {
              external_reference: userId,
              status: 'approved'
            }
          });

          let matchedPayment = null;

          if (searchByRef.results && searchByRef.results.length > 0) {
            // Strict check: make sure the search result actually matches this user
            matchedPayment = searchByRef.results.find((p: SearchPaymentResult) => 
              p && 
              p.external_reference && 
              String(p.external_reference) === String(userId) && 
              (String(p.status).toLowerCase() === 'approved')
            );
            
            if (matchedPayment) {
              console.log(`[Manual Verify V3] Found and matched by external_reference: ${matchedPayment.id}`);
            }
          }

          if (!matchedPayment && dbData?.email) {
            // Fallback 1: Search by email
            console.log(`[Manual Verify V3] Searching by email: ${dbData.email}`);
            const searchByEmail = await payment.search({
              options: {
                "payer.email": dbData.email,
                status: 'approved'
              }
            });
            
            if (searchByEmail.results && searchByEmail.results.length > 0) {
              matchedPayment = searchByEmail.results.find((p: SearchPaymentResult) => 
                p && 
                p.payer && 
                String(p.payer.email).toLowerCase() === String(dbData.email).toLowerCase() && 
                (String(p.status).toLowerCase() === 'approved')
              );
              
              if (matchedPayment) {
                console.log(`[Manual Verify V3] Found and matched by email fallback: ${matchedPayment.id}`);
              }
            }
          }

          if (matchedPayment) {
            foundApproved = true;
            approvedData = matchedPayment;
          }
        } catch (searchErr: unknown) {
          const err = searchErr as Error;
          console.error("[Manual Verify V3] Search failed:", err.message);
        }
      }

      if (foundApproved && approvedData) {
        console.log(`[Manual Verify] Granting access for payment: ${approvedData.id}`);
        const updateData = {
          status: "APPROVED",
          hasAccess: true, 
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentId: String(approvedData.id),
          mercadoPagoId: String(approvedData.id),
          paymentMethod: approvedData.payment_method_id,
          paymentType: approvedData.payment_type_id
        };
        
        let syncResult = "none";
        try {
          const syncDb = getDb();
          const dbId = (syncDb as admin.firestore.Firestore & { databaseId?: string }).databaseId || '(default)';
          const currentApp = admin.apps.find(a => a?.name === "gestor-cnl-backend") || admin.apps[0];
          
          // Get current data to check status transition
          const userRef = syncDb.collection("system_profiles").doc(userId);
          const userDoc = await userRef.get();
          const dbData = userDoc.data();
          
          console.log(`[Manual Verify] Target DB: ${dbId}. Project: ${currentApp?.options.projectId || 'unknown'}`);
          
          await userRef.set(updateData, { merge: true });
          syncResult = "success";
          console.log(`[Manual Verify] Sync SUCCESS on ${dbId}`);

          // Send welcome email if transitioning to APPROVED or if we forced it
          if (!dbData || dbData.status !== "APPROVED") {
            const email = dbData?.email || approvedData?.payer?.email || approvedData?.external_reference;
            const name = dbData?.displayName || dbData?.name || "Cliente";
            
            if (email) {
              console.log(`[Manual Verify] Sending welcome email to ${email}`);
              sendWelcomeEmail(email, name).catch(e => console.error("[Email] Send error:", e));
            } else {
              console.warn("[Manual Verify] No email found for user, skipping welcome email.");
            }
          }
        } catch (dbErr: unknown) {
          const err = dbErr as Error;
          syncResult = `failed: ${err.message}`;
          console.error(`[Manual Verify] SYNC FAILED: ${err.message}`, dbErr);
          
          // One last desperate try to default
          try {
            console.log("[Manual Verify] Desperate fallback to default...");
            await getDb(true).collection("system_profiles").doc(userId).set(updateData, { merge: true });
            syncResult = "success_on_default_desperate";
          } catch {
            console.error("[Manual Verify] Desperate fallback also failed.");
          }
        }
        
        return res.json({ 
          status: "APPROVED", 
          hasAccess: true, 
          source: "mercado_pago", 
          paymentId: String(approvedData.id),
          syncResult 
        });
      }

      // Final fallback
      if (approvedData) {
        return res.json({ 
            status: approvedData.status, 
            statusDetail: approvedData.status_detail,
            hasAccess: false, 
            source: "found_not_approved" 
        });
      }

      res.json({ status: dbData?.status || "PENDING", hasAccess: dbData?.hasAccess || false, source: "none", configStatus });
    } catch (routeErr: unknown) {
      const err = routeErr as Error;
      console.error("[Manual Verify V3] Route ERROR:", err);
      res.status(500).json({ error: "Erro interno na verificação", details: err.message });
    }
  });

  // --- Welcome Email Trigger ---
  app.post("/api/admin/trigger-welcome-email", async (req, res) => {
    const { userId, email, name } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    console.log(`[Admin Trigger] Sending welcome email to ${email} (User: ${userId})`);
    
    try {
      const result = await sendWelcomeEmail(email, name || "Cliente");
      if (result.success) {
        res.json({ success: true });
      } else {
        res.json({ 
          success: false, 
          error: result.error || "O servidor de e-mail não está configurado corretamente." 
        });
      }
    } catch (err: unknown) {
      const errorVal = err as Error;
      console.error("[Admin Trigger] Error:", errorVal.message);
      res.status(500).json({ error: "Falha técnica ao enviar e-mail: " + errorVal.message });
    }
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    console.log("Starting in DEV mode with Vite middleware");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "custom",
    });
    
    app.use(vite.middlewares);

    app.get("/", (req, res, next) => {
      console.log("[DEV SERVER] Root request - serving index.html");
      next();
    });

    app.get("*all", async (req, res, next) => {
      const url = req.originalUrl;
      console.log(`[DEV SERVER] Raw Route: ${url}`);

      // Forward API requests
      if (url.startsWith("/api")) return next();
      
      // Handle static files handled by vite middlewares
      if (path.extname(url) && !url.endsWith(".html")) return next();

      try {
        const templatePath = path.resolve(process.cwd(), "index.html");
        if (!fs.existsSync(templatePath)) {
          console.error(`[DEV SERVER] template not found at ${templatePath}`);
          return res.status(500).send("index.html not found");
        }
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error(`[DEV SERVER] Error serving ${url}:`, e);
        if (e instanceof Error) vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else if (!process.env.VERCEL) {
    console.log("Starting in PROD mode");
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*all", (req, res) => {
        const url = req.originalUrl;
        if (url.startsWith("/api")) return res.status(404).send("API Not found");
        
        // Serve index.html for SPA routes
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      app.get("*all", (req, res) => res.status(500).send("Build missing. Run npm run build."));
    }
  }

  return app;
}

async function startServer() {
  const app = await createExpressApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
