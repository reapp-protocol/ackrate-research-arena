import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  ArenaServiceError,
  authorizeArena,
  createArena,
  getArenaById,
  getRecentArenas,
  refreshArenaPayment,
  runArena,
  settleArena,
  toClientArena,
} from "./lib/arena-service.js";
import { PravaApiError, isPravaConfigured } from "./lib/prava.js";
import { providerMode } from "./lib/research.js";
import { storageMode } from "./lib/store.js";
import { openApi } from "./openapi.js";

const createArenaSchema = z.object({
  buyerEmail: z.string().email(),
  topicPublic: z.string().trim().min(12).max(4000),
  topicPrivate: z.string().trim().max(8000).optional(),
  budget: z.coerce.number().min(1).max(10_000),
  minimumAgentElo: z.coerce.number().int().min(0).max(1200).optional(),
  criteria: z.array(z.object({
    label: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    visibility: z.enum(["public", "private"]).optional(),
  })).min(1).max(5).optional(),
});

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

function allowedOrigins() {
  const configured = process.env.CORS_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean);
  return configured?.length ? configured : [
    "https://ackratearena.xyz",
    "https://www.ackratearena.xyz",
    "https://research-reveal-production.up.railway.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
  ];
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(cors({ origin: allowedOrigins(), credentials: false }));
  app.use((request, response, next) => {
    request.requestId = request.header("x-request-id") || randomUUID();
    response.setHeader("x-request-id", request.requestId);
    next();
  });

  app.get("/", (_request, response) => {
    response.json({
      name: "ackrate research arena",
      tagline: "research agents compete. evidence wins.",
      version: "0.1.0",
      docs: "/openapi.json",
      health: "/healthz",
    });
  });

  app.get("/healthz", (_request, response) => {
    response.json({ status: "ok", service: "ackrate-research-arena" });
  });

  app.get("/readyz", (_request, response) => {
    const providers = providerMode();
    const demoMode = process.env.DEMO_MODE !== "false";
    const configurationErrors = demoMode ? [] : [
      ...(!process.env.DATABASE_URL ? ["DATABASE_URL is required"] : []),
      ...(!(process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY) ? ["OPENAI_API_KEY is required"] : []),
      ...(!process.env.ANTHROPIC_API_KEY ? ["ANTHROPIC_API_KEY is required"] : []),
      ...(!process.env.PRAVA_SECRET_KEY ? ["PRAVA_SECRET_KEY is required"] : []),
      ...(!process.env.FRONTEND_URL ? ["FRONTEND_URL is required"] : []),
      ...(!process.env.CORS_ORIGINS ? ["CORS_ORIGINS is required"] : []),
      ...((process.env.PRAVA_API_BASE_URL || "https://sandbox.api.prava.space") !== "https://sandbox.api.prava.space"
        ? ["PRAVA_API_BASE_URL must be the Prava sandbox"]
        : []),
    ];
    response.status(configurationErrors.length ? 503 : 200).json({
      status: configurationErrors.length ? "not_ready" : "ready",
      storage: storageMode(),
      payment: demoMode ? "demo" : isPravaConfigured() ? "prava" : "unconfigured",
      providers,
      demoMode,
      configurationErrors,
    });
  });

  app.get("/openapi.json", (_request, response) => response.json(openApi));

  app.get("/v1/arenas", async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 12, 1), 50);
    const arenas = await getRecentArenas(limit);
    response.json({ data: arenas.map((arena) => toClientArena(arena)) });
  });

  app.post("/v1/arenas", async (request, response) => {
    const input = createArenaSchema.parse(request.body);
    const arena = await createArena(input);
    response.status(201).json({ data: toClientArena(arena) });
  });

  app.get("/v1/arenas/:id", async (request, response) => {
    const arena = await getArenaById(request.params.id);
    response.json({ data: toClientArena(arena) });
  });

  app.post("/v1/arenas/:id/authorize", async (request, response) => {
    const arena = await authorizeArena(request.params.id);
    response.json({ data: toClientArena(arena, { includePaymentUrl: true }) });
  });

  app.post("/v1/arenas/:id/payment/refresh", async (request, response) => {
    const arena = await refreshArenaPayment(request.params.id);
    response.json({ data: toClientArena(arena) });
  });

  app.post("/v1/arenas/:id/run", async (request, response) => {
    const arena = await runArena(request.params.id);
    response.json({ data: toClientArena(arena) });
  });

  app.post("/v1/arenas/:id/settle", async (request, response) => {
    const arena = await settleArena(request.params.id);
    response.json({ data: toClientArena(arena) });
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found", requestId: response.getHeader("x-request-id") },
    });
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues,
          requestId: request.requestId,
        },
      });
      return;
    }
    if (error instanceof ArenaServiceError || error instanceof PravaApiError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.requestId,
          ...(error instanceof PravaApiError && error.responseId ? { pravaResponseId: error.responseId } : {}),
        },
      });
      return;
    }
    console.error(`[${request.requestId}] request failed`, error instanceof Error ? error.message : "unknown error");
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error", requestId: request.requestId },
    });
  });

  return app;
}
