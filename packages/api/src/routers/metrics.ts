import { getMetrics } from "../services/metrics-collector";

/**
 * GET /api/metrics
 * Exposes Prometheus metrics endpoint
 */
export async function GET(): Promise<Response> {
  try {
    const metrics = await getMetrics();
    return new Response(metrics, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
      },
    });
  } catch (error) {
    console.error("Failed to get metrics:", error);
    return new Response("Internal Server Error", {
      status: 500,
    });
  }
}
