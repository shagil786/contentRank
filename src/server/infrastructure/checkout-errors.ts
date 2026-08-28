export function checkoutFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("merchant_not_live") || message.includes("merchant not live")) return "merchant_not_live";
  if (message.includes("401") || message.includes("403") || message.includes("unauthorized")) return "dodo_auth_failed";
  if (message.includes("timeout") || message.includes("aborted")) return "payment_provider_timeout";
  if (message.includes("not configured")) return "checkout_not_configured";
  return "checkout_unavailable";
}
