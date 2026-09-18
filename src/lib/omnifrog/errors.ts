/**
 * OmniFrog AI — consistent, user-safe error shape.
 * Never carries secrets, tokens or internal server detail.
 */

export interface OmniFrogError {
  /** Safe message for the user. */
  message: string;
  /** Internal identifier for correlation. */
  errorId: string;
  timestamp: string;
  operation: string;
  recoverable: boolean;
}

function newErrorId(): string {
  return `OF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function omniError(
  operation: string,
  message: string,
  recoverable = true,
): OmniFrogError {
  return {
    message,
    errorId: newErrorId(),
    timestamp: new Date().toISOString(),
    operation,
    recoverable,
  };
}

export function isOmniError(value: unknown): value is OmniFrogError {
  return (
    typeof value === "object" &&
    value !== null &&
    "errorId" in value &&
    "message" in value &&
    "operation" in value
  );
}
