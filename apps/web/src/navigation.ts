import { useEffect, useState } from "react";
import { weekStart } from "../../../packages/shared/src/index.ts";
import type { Page } from "./context.tsx";
const pages: Record<string, Page> = {
  home: "Home",
  recipes: "Recipes",
  plan: "Meal planner",
  groceries: "Groceries",
  pantry: "Pantry",
  spending: "Spending",
  goals: "Goals & rewards",
  assistant: "Assistant",
  settings: "Settings",
};
export function parseRoute(hash: string) {
  const [slug, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const value = new URLSearchParams(query).get("week");
  const week =
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
      ? value
      : weekStart();
  return { page: pages[slug] || "Home", week };
}
export function useNavigation() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const change = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const go = (page: Page, week = parseRoute(location.hash).week) => {
    const slug = Object.keys(pages).find((k) => pages[k] === page) || "home";
    const hash = `#/${slug}?week=${week}`;
    if (location.hash !== hash) {
      location.hash = hash;
      setRoute({ page, week });
    }
  };
  return {
    ...route,
    navigate: (page: Page) => go(page),
    setWeek: (week: string) => go(parseRoute(location.hash).page, week),
  };
}
