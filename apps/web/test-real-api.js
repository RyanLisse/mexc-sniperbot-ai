// Load environment variables and test real MEXC API

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, ".env") });

console.log("Environment variables loaded:");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("MEXC_API_KEY:", process.env.MEXC_API_KEY ? "SET" : "NOT SET");
console.log(
  "MEXC_SECRET_KEY:",
  process.env.MEXC_SECRET_KEY ? "SET" : "NOT SET"
);
console.log(
  "NEXTAUTH_SECRET:",
  process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET"
);

// Test MEXC API with real authentication
async function testMEXCAuth() {
  try {
    const https = await import("node:https");
    const crypto = await import("node:crypto");

    // Test server time first (no auth required)
    console.log("\n=== Testing MEXC Server Time ===");
    const timeResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.mexc.com",
        port: 443,
        path: "/api/v3/time",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", reject);
      req.end();
    });

    console.log("Server Time Response:", timeResponse);

    // Test account info (requires auth)
    if (process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY) {
      console.log("\n=== Testing MEXC Account Info ===");

      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;

      // Create signature
      const hmac = crypto.createHmac("sha256", process.env.MEXC_SECRET_KEY);
      hmac.update(queryString);
      const signature = hmac.digest("hex");

      const accountOptions = {
        hostname: "api.mexc.com",
        port: 443,
        path: `/api/v3/account?${queryString}&signature=${signature}`,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-MEXC-APIKEY": process.env.MEXC_API_KEY,
        },
      };

      const accountResponse = await new Promise((resolve, reject) => {
        const req = https.request(accountOptions, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ status: res.statusCode, data: parsed });
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on("error", reject);
        req.end();
      });

      console.log("Account Info Response:", accountResponse);

      // Test symbols to get trading pairs
      console.log("\n=== Testing MEXC Symbols ===");
      const symbolsResponse = await new Promise((resolve, reject) => {
        const symbolsOptions = {
          hostname: "api.mexc.com",
          port: 443,
          path: "/api/v3/ticker/24hr",
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        };

        const req = https.request(symbolsOptions, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              resolve({
                status: res.statusCode,
                count: parsed.length,
                sample: parsed.slice(0, 5),
              });
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on("error", reject);
        req.end();
      });

      console.log("Symbols Response:", symbolsResponse);
    } else {
      console.log("\n❌ MEXC API credentials not available");
    }
  } catch (error) {
    console.error("API test failed:", error);
  }
}

testMEXCAuth()
  .then(() => {
    console.log("\n✅ Real API test completed");
  })
  .catch(console.error);
