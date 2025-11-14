// Test environment variables
console.log("Testing environment variables...");
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

// Test basic MEXC API call without our wrapper
async function testDirectMEXC() {
  try {
    const https = await import("node:https");

    // Test server time endpoint
    const options = {
      hostname: "api.mexc.com",
      port: 443,
      path: "/api/v3/time",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await new Promise((resolve, reject) => {
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

    console.log("Direct MEXC API test successful:", response);
    return response;
  } catch (error) {
    console.error("Direct MEXC API test failed:", error);
    return null;
  }
}

testDirectMEXC()
  .then(() => {
    console.log("Test completed");
  })
  .catch(console.error);
