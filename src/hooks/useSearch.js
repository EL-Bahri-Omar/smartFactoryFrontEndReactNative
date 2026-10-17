// src/hooks/useSearch.js
//
// Generic client-side full-text search across all columns.
// Usage:
//   const filtered = useSearch(data, ['name', 'code', 'type', 'zoneName', 'status'], query);
//
// Matches any field containing the query string (case-insensitive).
// Supports nested access with dot notation: 'user.email'.
// Splits query by spaces for AND matching: "CNC running" matches items
// that have "CNC" in any field AND "running" in any field.

import { useMemo } from "react";

function getNestedValue(obj, path) {
  if (!obj || !path) return "";
  const parts = path.split(".");
  let val = obj;
  for (const part of parts) {
    if (val == null) return "";
    val = val[part];
  }
  return val == null ? "" : String(val);
}

/**
 * @param {any[]} data — array of objects to search through
 * @param {string[]} fields — list of field paths to search in
 * @param {string} query — the search string (space-separated AND terms)
 * @returns {any[]} — filtered array
 */
export function useSearch(data, fields, query) {
  return useMemo(() => {
    if (!query || !query.trim() || !data || !fields?.length) return data || [];

    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (terms.length === 0) return data || [];

    return (data || []).filter((item) => {
      // Build a combined searchable string from all fields
      const searchable = fields
        .map((field) => getNestedValue(item, field))
        .join(" ")
        .toLowerCase();

      // Every term must appear somewhere in the searchable string (AND logic)
      return terms.every((term) => searchable.includes(term));
    });
  }, [data, fields, query]);
}

/**
 * Highlight matching terms in a string by wrapping them in markers.
 * Returns an array of { text, highlight } segments for rendering.
 *
 * @param {string} text — the original text
 * @param {string} query — the search query
 * @returns {{ text: string, highlight: boolean }[]}
 */
export function highlightTerms(text, query) {
  if (!text || !query?.trim()) return [{ text: text || "", highlight: false }];

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) return [{ text, highlight: false }];

  // Build a regex that matches any of the terms
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts.map((part) => ({
    text: part,
    highlight: terms.some((t) => part.toLowerCase() === t),
  }));
}
