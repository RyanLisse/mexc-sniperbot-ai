import type { Effect } from "effect";
import { TradingLogger } from "../lib/effect";

export type SecurityEventType =
  | "API_KEY_ACCESS"
  | "CREDENTIAL_VALIDATION"
  | "IP_BLOCKED"
  | "IP_ALLOWED"
  | "AUTHENTICATION_FAILURE"
  | "AUTHENTICATION_SUCCESS"
  | "CONFIGURATION_CHANGE"
  | "CREDENTIAL_ROTATION_ATTEMPT";

export type SecurityEvent = {
  type: SecurityEventType;
  timestamp: Date;
  ipAddress?: string;
  userId?: string;
  details?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
};

class SecurityLogger {
  private logEvent(event: SecurityEvent): Effect.Effect<void, never> {
    const logData = {
      security: true,
      eventType: event.type,
      timestamp: event.timestamp.toISOString(),
      ipAddress: event.ipAddress,
      userId: event.userId,
      severity: event.severity,
      ...event.details,
    };

    switch (event.severity) {
      case "critical":
      case "high":
        return TradingLogger.logError(`Security Event: ${event.type}`, logData);
      case "medium":
        return TradingLogger.logWarning(
          `Security Event: ${event.type}`,
          logData
        );
      case "low":
        return TradingLogger.logInfo(`Security Event: ${event.type}`, logData);
    }
  }

  logApiKeyAccess(
    ipAddress?: string,
    userId?: string
  ): Effect.Effect<void, never> {
    return this.logEvent({
      type: "API_KEY_ACCESS",
      timestamp: new Date(),
      ipAddress,
      userId,
      severity: "medium",
      details: {
        message: "API key accessed",
      },
    });
  }

  logCredentialValidation(
    success: boolean,
    ipAddress?: string
  ): Effect.Effect<void, never> {
    return this.logEvent({
      type: "CREDENTIAL_VALIDATION",
      timestamp: new Date(),
      ipAddress,
      severity: success ? "low" : "high",
      details: {
        success,
        message: success
          ? "Credentials validated successfully"
          : "Credential validation failed",
      },
    });
  }

  logIPBlocked(ipAddress: string, reason: string): Effect.Effect<void, never> {
    return this.logEvent({
      type: "IP_BLOCKED",
      timestamp: new Date(),
      ipAddress,
      severity: "high",
      details: {
        reason,
        message: `IP address blocked: ${ipAddress}`,
      },
    });
  }

  logIPAllowed(ipAddress: string): Effect.Effect<void, never> {
    return this.logEvent({
      type: "IP_ALLOWED",
      timestamp: new Date(),
      ipAddress,
      severity: "low",
      details: {
        message: `IP address allowed: ${ipAddress}`,
      },
    });
  }

  logAuthenticationFailure(
    reason: string,
    ipAddress?: string,
    userId?: string
  ): Effect.Effect<void, never> {
    return this.logEvent({
      type: "AUTHENTICATION_FAILURE",
      timestamp: new Date(),
      ipAddress,
      userId,
      severity: "high",
      details: {
        reason,
        message: `Authentication failed: ${reason}`,
      },
    });
  }

  logAuthenticationSuccess(
    ipAddress?: string,
    userId?: string
  ): Effect.Effect<void, never> {
    return this.logEvent({
      type: "AUTHENTICATION_SUCCESS",
      timestamp: new Date(),
      ipAddress,
      userId,
      severity: "low",
      details: {
        message: "Authentication successful",
      },
    });
  }

  logConfigurationChange(
    changeType: string,
    userId?: string,
    details?: Record<string, unknown>
  ): Effect.Effect<void, never> {
    return this.logEvent({
      type: "CONFIGURATION_CHANGE",
      timestamp: new Date(),
      userId,
      severity: "medium",
      details: {
        changeType,
        ...details,
        message: `Configuration changed: ${changeType}`,
      },
    });
  }

  logCredentialRotationAttempt(
    success: boolean,
    userId?: string,
    error?: string
  ): Effect.Effect<void, never> {
    return this.logEvent({
      type: "CREDENTIAL_ROTATION_ATTEMPT",
      timestamp: new Date(),
      userId,
      severity: success ? "medium" : "high",
      details: {
        success,
        error,
        message: success
          ? "Credential rotation attempted"
          : `Credential rotation failed: ${error ?? "Unknown error"}`,
      },
    });
  }
}

export const securityLogger = new SecurityLogger();
