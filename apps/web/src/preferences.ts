import { useRef, useState, type SetStateAction } from "react";
/** Device-only UI preferences. Never store credentials or authoritative records. */
export function useSessionState<T>(key: string, initial: T) {
  const storageKey = `hearth.ui.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved === null ? initial : (JSON.parse(saved) as T);
    } catch {
      return initial;
    }
  });
  const current = useRef(value);
  current.current = value;
  const update = (next: SetStateAction<T>) => {
    const resolved =
      typeof next === "function"
        ? (next as (v: T) => T)(current.current)
        : next;
    current.current = resolved;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(resolved));
    } catch {
      /* Device UI preferences are optional. */
    }
    setValue(resolved);
  };
  return [value, update] as const;
}
export function clearUIPreferences() {
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith("hearth.ui.")) sessionStorage.removeItem(key);
}
