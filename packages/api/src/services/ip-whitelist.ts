import { Effect } from "effect";
import { SecurityError, TradingLogger } from "../lib/effect";

export type IPWhitelistConfig = {
  enabled: boolean;
  allowedIPs: string[];
};

const DEFAULT_WHITELIST: IPWhitelistConfig = {
  enabled: false, // Disabled by default for development
  allowedIPs: [],
};

// Parse IP whitelist from environment variable
const parseIPWhitelist = (): IPWhitelistConfig => {
  const enabled = process.env.IP_WHITELIST_ENABLED === "true";
  const ips =
    process.env.IP_WHITELIST?.split(",")
      .map((ip) => ip.trim())
      .filter(Boolean) ?? [];

  return {
    enabled,
    allowedIPs: ips,
  };
};

let cachedConfig: IPWhitelistConfig | null = null;

export const ipWhitelist = {
  getConfig(): IPWhitelistConfig {
    if (cachedConfig) {
      return cachedConfig;
    }

    cachedConfig = parseIPWhitelist();
    return cachedConfig;
  },

  isIPAllowed(ip: string): Effect.Effect<boolean, SecurityError> {
    return Effect.gen(function* () {
      const config = this.getConfig();

      // If whitelist is disabled, allow all IPs
      if (!config.enabled) {
        return true;
      }

      // If whitelist is enabled but empty, deny all
      if (config.allowedIPs.length === 0) {
        yield* TradingLogger.logWarning("IP whitelist enabled but empty", {
          ip,
        });
        return false;
      }

      // Check if IP is in whitelist
      const isAllowed = config.allowedIPs.includes(ip);

      if (!isAllowed) {
        yield* TradingLogger.logWarning("IP address not in whitelist", {
          ip,
          allowedIPs: config.allowedIPs,
        });
      }

      return isAllowed;
    }).bind(undefined, this);
  },

  validateIP(ip: string): Effect.Effect<void, SecurityError> {
    return Effect.gen(function* () {
      const isAllowed = yield* this.isIPAllowed(ip);

      if (!isAllowed) {
        throw new SecurityError({
          message: `IP address ${ip} is not in whitelist`,
          code: "IP_NOT_WHITELISTED",
          timestamp: new Date(),
        });
      }
    }).bind(undefined, this);
  },

  addIP(ip: string): Effect.Effect<void, SecurityError> {
    return Effect.gen(function* () {
      // Validate IP format
      if (!this.isValidIP(ip)) {
        throw new SecurityError({
          message: `Invalid IP address format: ${ip}`,
          code: "INVALID_IP_FORMAT",
          timestamp: new Date(),
        });
      }

      const config = this.getConfig();
      if (!config.allowedIPs.includes(ip)) {
        config.allowedIPs.push(ip);
        cachedConfig = config;
        yield* TradingLogger.logInfo("IP added to whitelist", { ip });
      }
    }).bind(undefined, this);
  },

  removeIP(ip: string): Effect.Effect<void, SecurityError> {
    return Effect.gen(function* () {
      const config = this.getConfig();
      const index = config.allowedIPs.indexOf(ip);
      if (index > -1) {
        config.allowedIPs.splice(index, 1);
        cachedConfig = config;
        yield* TradingLogger.logInfo("IP removed from whitelist", { ip });
      }
    }).bind(undefined, this);
  },

  isValidIP(ip: string): boolean {
    // IPv4 validation
    const ipv4Pattern =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Pattern.test(ip)) {
      return true;
    }

    // IPv6 validation (simplified)
    const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Pattern.test(ip)) {
      return true;
    }

    // Localhost variants
    if (ip === "localhost" || ip === "127.0.0.1" || ip === "::1") {
      return true;
    }

    return false;
  },

  reset(): void {
    cachedConfig = { ...DEFAULT_WHITELIST };
  },
};
