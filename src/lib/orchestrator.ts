export type ModelProvider = "openai" | "anthropic";

export type ProviderAttempt = {
  provider: ModelProvider;
  message: string;
};

export class ProviderOrchestrationError extends Error {
  constructor(
    readonly operation: string,
    readonly attempts: ProviderAttempt[],
  ) {
    const summary = attempts.length
      ? attempts.map((attempt) => `${attempt.provider}: ${attempt.message}`).join("; ")
      : "model providers not configured";
    super(`${operation} failed across every available provider (${summary})`);
    this.name = "ProviderOrchestrationError";
  }
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown provider error";
  return message.replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function runWithProviderFailover<T>(input: {
  operation: string;
  preferred: ModelProvider;
  available: Record<ModelProvider, boolean>;
  execute: (provider: ModelProvider) => Promise<T>;
  onFailover?: (attempt: ProviderAttempt, next: ModelProvider) => void;
}): Promise<{ value: T; provider: ModelProvider; attempts: ProviderAttempt[] }> {
  const alternate: ModelProvider = input.preferred === "openai" ? "anthropic" : "openai";
  const order = [input.preferred, alternate].filter((provider) => input.available[provider]);
  const attempts: ProviderAttempt[] = [];

  for (const [index, provider] of order.entries()) {
    try {
      return {
        value: await input.execute(provider),
        provider,
        attempts,
      };
    } catch (error) {
      const attempt = { provider, message: safeErrorMessage(error) };
      attempts.push(attempt);
      const next = order[index + 1];
      if (next) input.onFailover?.(attempt, next);
    }
  }

  throw new ProviderOrchestrationError(input.operation, attempts);
}
