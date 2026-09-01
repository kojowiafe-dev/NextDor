/**
 * Custom HTTP error classes.
 *
 * DESIGN DECISION: Why custom errors instead of throwing plain objects?
 * ──────────────────────────────────────────────────────────────────────
 * A central error hierarchy means:
 *   1. The global error handler can detect error TYPE (instanceof check)
 *      and format the HTTP response accordingly.
 *   2. Every error has a machine-readable `code` field clients can
 *      switch on — avoiding brittle string matching on `message`.
 *   3. Stack traces are preserved (plain objects don't have them).
 *   4. Extra metadata (field, resourceId) can be attached for richer
 *      error responses without polluting the message string.
 *
 * WHAT IF: What if a programmer forgets to throw an AppError and throws
 * a raw Error instead? → The global handler has a fallback that maps
 * unknown errors to 500 Internal Server Error, so the client always
 * gets a consistent JSON shape, never a raw stack trace.
 *
 * 📚 Read: "Clean Code" by Robert C. Martin — Chapter 7: Error Handling.
 *    Specifically "Use Exceptions Rather Than Return Codes".
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Common HTTP error factories ────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, "UNPROCESSABLE", message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please slow down") {
    super(429, "RATE_LIMITED", message);
  }
}

export class InternalError extends AppError {
  constructor(message = "An unexpected error occurred") {
    super(500, "INTERNAL_ERROR", message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(503, "SERVICE_UNAVAILABLE", `${service} is temporarily unavailable`);
  }
}

// ── Type guard ────────────────────────────────────────────────────────────

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
