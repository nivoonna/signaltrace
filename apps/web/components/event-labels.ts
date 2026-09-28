import type { EventName } from "../lib/analytics";

export const names: Record<EventName, string> = { product_viewed: "Product viewed", product_added_to_cart: "Added to cart" };
export function timeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

