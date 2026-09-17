import { useSearchParams } from "react-router-dom";

export const FILTER_KEYS = [
  "date", "tpm", "pod", "role", "employment", "project", "status", "search",
  "attention", "completeness",
];

// URL-persisted global filter state.
export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters = {};
  FILTER_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) filters[k] = v;
  });

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value == null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: false });
  };

  const clearAll = () => {
    const next = new URLSearchParams(params);
    FILTER_KEYS.forEach((k) => next.delete(k));
    setParams(next, { replace: false });
  };

  const queryString = () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => q.set(k, v));
    return q.toString();
  };

  const activeChips = Object.entries(filters).filter(([k]) => k !== "date");

  return { filters, setFilter, clearAll, queryString, activeChips, params };
}
