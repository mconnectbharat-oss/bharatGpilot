const ALLOWED_EVENTS = new Set([
  "conversation.completed",
  "memory.created",
  "repository.analysis.completed",
  "agent.review.requested"
]);

const configured = () => Boolean(
  process.env.N8N_WEBHOOK_URL &&
  /^https:\/\//i.test(process.env.N8N_WEBHOOK_URL) &&
  process.env.N8N_WEBHOOK_SECRET &&
  !process.env.N8N_WEBHOOK_SECRET.startsWith("your_")
);

export function getAutomationStatus() {
  return {
    configured: configured(),
    mode: "explicit-webhook-dispatch",
    allowedEvents: [...ALLOWED_EVENTS],
    safety: {
      userDataIncludedOnlyInExplicitPayload: true,
      destructiveActions: "not-executed-by-this-webhook",
      timeoutMs: 5000
    }
  };
}

export async function dispatchAutomationEvent({ userId, event, payload = {} } = {}) {
  if (!ALLOWED_EVENTS.has(event)) throw new Error("Unsupported automation event.");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be an object.");
  if (JSON.stringify(payload).length > 10000) throw new Error("Automation payload is too large.");
  if (!configured()) return { dispatched: false, reason: "n8n is not configured." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BharatGPilot-Event": event,
        "X-BharatGPilot-Signature": process.env.N8N_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        event,
        userId,
        occurredAt: new Date().toISOString(),
        payload
      }),
      signal: controller.signal
    });
    if (!response.ok) return { dispatched: false, reason: "n8n returned HTTP " + response.status };
    return { dispatched: true, event };
  } catch {
    return { dispatched: false, reason: "n8n could not be reached." };
  } finally {
    clearTimeout(timeout);
  }
}
