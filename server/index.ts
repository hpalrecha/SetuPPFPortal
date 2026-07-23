import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { whatsappService } from "./services/whatsapp-service";

const app = express();

// Allow the VAS UI to be embedded in an <iframe> by the Pulse app (single-login
// embed). We deliberately do NOT emit X-Frame-Options (which has no allow-list
// and would block framing); instead we scope framing via CSP frame-ancestors.
// PULSE_APP_ORIGINS is a space/comma-separated list of allowed parent origins.
const PULSE_APP_ORIGINS = (process.env.PULSE_APP_ORIGINS || "http://localhost:5173 http://localhost:8080")
  .split(/[\s,]+/)
  .filter(Boolean)
  .join(" ");
app.use((_req, res, next) => {
  // Remove any framing denial a proxy/other layer might have set.
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${PULSE_APP_ORIGINS}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Log WhatsApp service status on startup
  console.log('📱 WhatsApp Service Status:', whatsappService.getStatus());
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  // reusePort is Linux/macOS-only; Windows throws ENOTSUP. Skip it on win32.
  const listenOpts: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };
  if (process.platform !== 'win32') {
    listenOpts.reusePort = true;
  }
  server.listen(listenOpts, () => {
    log(`serving on port ${port}`);
  });
})();
