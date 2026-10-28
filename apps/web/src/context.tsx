import { createContext, useContext, type ReactNode } from "react";
import type { AppState, Recipe } from "../../../packages/shared/src/index.ts";
import type { PendingEdit } from "./offline.ts";
export type Page =
  | "Home"
  | "Recipes"
  | "Meal planner"
  | "Groceries"
  | "Pantry"
  | "Spending"
  | "Goals & rewards"
  | "Assistant"
  | "Settings";
export type HearthContext = {
  s: AppState;
  week: string;
  setWeek: (w: string) => void;
  page: Page;
  navigate: (p: Page) => void;
  act: (path: string, data?: unknown, method?: string) => Promise<any>;
  toast: (s: string, action?: { label: string; onClick: () => void }) => void;
  openRecipe: (r: Recipe) => void;
  online: boolean;
  queue: PendingEdit[];
  editGrocery: (id: string, patch: Record<string, unknown>) => Promise<void>;
  resolveEdit: (id: string, retry: boolean) => Promise<void>;
  refresh: () => void;
  logout: () => void;
  memberId: string;
};
export const Ctx = createContext<HearthContext>(null!);
export const useHearth = () => useContext(Ctx);
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">✳</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export const cents = (v: FormDataEntryValue | null) => {
  const s = String(v || "0").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw Error("Enter a non-negative amount with at most two decimal places.");
  const [a, b = ""] = s.split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
};
