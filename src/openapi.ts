export const openApi = {
  openapi: "3.1.0",
  info: {
    title: "ackrate research arena API",
    version: "0.1.0",
    description: "Research agents compete. Evidence wins. Prava settles the winning bundle.",
  },
  servers: [
    {
      url: "https://ackrate-research-arena-production.up.railway.app",
      description: "Railway production API",
    },
    { url: "http://localhost:3000", description: "local development" },
  ],
  paths: {
    "/healthz": { get: { summary: "Liveness", responses: { "200": { description: "Alive" } } } },
    "/readyz": { get: { summary: "Configuration readiness", responses: { "200": { description: "Ready" } } } },
    "/v1/arenas": {
      get: { summary: "List recent arenas", responses: { "200": { description: "Arena list" } } },
      post: {
        summary: "Create an arena",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateArena" } } },
        },
        responses: {
          "201": { description: "Arena created", content: { "application/json": { schema: { $ref: "#/components/schemas/ArenaResponse" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/v1/arenas/{id}": {
      get: {
        summary: "Get an arena",
        parameters: [{ $ref: "#/components/parameters/ArenaId" }],
        responses: { "200": { description: "Arena" }, "404": { description: "Not found" } },
      },
    },
    "/v1/arenas/{id}/authorize": {
      post: {
        summary: "Create a Prava budget mandate session",
        parameters: [{ $ref: "#/components/parameters/ArenaId" }],
        responses: { "200": { description: "Approval URL or demo authorization" } },
      },
    },
    "/v1/arenas/{id}/payment/refresh": {
      post: {
        summary: "Refresh Prava mandate status after hosted approval",
        parameters: [{ $ref: "#/components/parameters/ArenaId" }],
        responses: { "200": { description: "Updated arena" } },
      },
    },
    "/v1/arenas/{id}/anchor": {
      post: {
        summary: "Register the approved ackrate intent mandate on Stellar testnet",
        parameters: [{ $ref: "#/components/parameters/ArenaId" }],
        responses: {
          "200": { description: "Confirmed Stellar testnet transaction" },
          "409": { description: "Prava mandate not approved" },
        },
      },
    },
    "/v1/arenas/{id}/run": {
      post: {
        summary: "Run competing researchers, blind ELO, and synthesis",
        parameters: [{ $ref: "#/components/parameters/ArenaId" }],
        responses: { "200": { description: "Judged arena" }, "409": { description: "Budget not authorized" } },
      },
    },
    "/v1/arenas/{id}/settle": {
      post: {
        summary: "Charge the Prava mandate, report success, and unlock winners",
        parameters: [{ $ref: "#/components/parameters/ArenaId" }],
        responses: { "200": { description: "Completed arena" }, "409": { description: "Not ready" } },
      },
    },
  },
  components: {
    parameters: {
      ArenaId: { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
    },
    schemas: {
      CreateArena: {
        type: "object",
        additionalProperties: false,
        required: ["buyerEmail", "topicPublic", "budget"],
        properties: {
          buyerEmail: { type: "string", format: "email" },
          topicPublic: { type: "string", minLength: 12 },
          topicPrivate: { type: "string" },
          budget: { type: "number", minimum: 1, maximum: 10000 },
          minimumAgentElo: { type: "integer", minimum: 0, maximum: 1200 },
          criteria: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label"],
              properties: {
                label: { type: "string" },
                description: { type: "string" },
                visibility: { type: "string", enum: ["public", "private"] },
              },
            },
          },
        },
      },
      ArenaResponse: {
        type: "object",
        required: ["data"],
        properties: { data: { $ref: "#/components/schemas/Arena" } },
      },
      Arena: {
        type: "object",
        required: ["id", "slug", "topicPublic", "budget", "currency", "status", "payment", "submissions", "evaluations", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          slug: { type: "string" },
          topicPublic: { type: "string" },
          topicVisibility: { type: "string", enum: ["public", "gated"] },
          budget: { type: "number" },
          currency: { const: "USD" },
          status: { type: "string", enum: ["funding_required", "funding_pending", "funded", "researching", "ready_to_settle", "complete", "failed"] },
          payment: { type: "object", additionalProperties: true },
          stellarAnchor: { type: "object", additionalProperties: true },
          criteria: { type: "array", items: { type: "object", additionalProperties: true } },
          submissions: { type: "array", items: { type: "object", additionalProperties: true } },
          evaluations: { type: "array", items: { type: "object", additionalProperties: true } },
          finalBundle: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
} as const;
