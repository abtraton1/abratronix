import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decode HTML entities and strip any remaining tags from a string.
 * Used as a client-side safety net for summaries that may contain
 * raw HTML from external sources.
 */
export function decodeHtml(text: string): string {
  if (!text) return "";
  // Use a textarea element to decode HTML entities natively
  const el = document.createElement("textarea");
  el.innerHTML = text;
  const decoded = el.value;
  // Strip any remaining HTML tags
  return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
