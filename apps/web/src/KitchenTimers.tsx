import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Timer, Pause, Play, X, Bell, Plus } from "lucide-react";
import { useSessionState } from "./preferences.ts";
import { Modal } from "./App.tsx";
import { Field } from "./context.tsx";
export type KitchenTimer = {
  id: string;
  label: string;
  endAt: number | null;
  remainingMs: number;
  sound: boolean;
};
export function timerSeconds(timer: KitchenTimer, now = Date.now()) {
  return Math.max(
    0,
    Math.ceil(
      (timer.endAt === null ? timer.remainingMs : timer.endAt - now) / 1000,
    ),
  );
}
export function clockLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    secs = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}
type TimersAPI = {
  timers: KitchenTimer[];
  now: number;
  start: (label: string, seconds: number, sound: boolean) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  remove: (id: string) => void;
};
const TimersContext = createContext<TimersAPI>(null!);
export const useKitchenTimers = () => useContext(TimersContext);
export function KitchenTimersProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useSessionState<KitchenTimer[]>(
    "cooking.timers",
    [],
  );
  const [now, setNow] = useState(Date.now());
  const audio = useRef<AudioContext | null>(null);
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (!timers.length) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [timers.length]);
  useEffect(() => {
    const clear = () => {
      setTimers([]);
      notified.current.clear();
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
    window.addEventListener("hearth:clear-timers", clear);
    return () => window.removeEventListener("hearth:clear-timers", clear);
  }, []);
  useEffect(() => {
    for (const timer of timers) {
      if (
        timer.endAt !== null &&
        timer.endAt <= now &&
        !notified.current.has(timer.id)
      ) {
        notified.current.add(timer.id);
        if (timer.sound && audio.current?.state === "running") {
          try {
            const ctx = audio.current;
            for (let i = 0; i < 3; i++) {
              const tone = ctx.createOscillator(),
                volume = ctx.createGain();
              tone.frequency.value = 880;
              tone.connect(volume);
              volume.connect(ctx.destination);
              const at = ctx.currentTime + i * 0.45;
              volume.gain.setValueAtTime(0.12, at);
              volume.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
              tone.start(at);
              tone.stop(at + 0.25);
            }
          } catch {
            /* Visual alerts remain available. */
          }
        }
      }
    }
  }, [timers, now]);
  const start = (label: string, seconds: number, sound: boolean) => {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400)
      throw Error("Choose a timer between one second and 24 hours.");
    if (timers.length >= 6)
      throw Error(
        "Dismiss a timer before adding another. You can keep six at once.",
      );
    if (sound) {
      try {
        audio.current ||= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch {
        /* Browser audio can be unavailable. */
      }
    }
    const endAt = Date.now() + seconds * 1000;
    setTimers((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        label: label.trim().slice(0, 80) || "Kitchen timer",
        endAt,
        remainingMs: seconds * 1000,
        sound,
      },
    ]);
    setNow(Date.now());
  };
  return (
    <TimersContext.Provider
      value={{
        timers,
        now,
        start,
        pause: (id) =>
          setTimers((list) =>
            list.map((t) =>
              t.id === id && t.endAt !== null
                ? {
                    ...t,
                    remainingMs: Math.max(
                      0,
                      (t.endAt ?? Date.now()) - Date.now(),
                    ),
                    endAt: null,
                  }
                : t,
            ),
          ),
        resume: (id) => {
          setTimers((list) =>
            list.map((t) =>
              t.id === id && t.endAt === null
                ? { ...t, endAt: Date.now() + t.remainingMs }
                : t,
            ),
          );
          setNow(Date.now());
        },
        remove: (id) => setTimers((list) => list.filter((t) => t.id !== id)),
      }}
    >
      {children}
    </TimersContext.Provider>
  );
}
export function TimerForm({ label = "Kitchen timer" }: { label?: string }) {
  const { start } = useKitchenTimers();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <form
      className="timer-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          start(
            String(f.get("label")),
            Number(f.get("minutes")) * 60 + Number(f.get("seconds")),
            f.get("sound") === "on",
          );
          setError("");
          setMessage(
            "Timer started. It keeps running when you leave this recipe.",
          );
        } catch (e: any) {
          setError(e.message);
        }
      }}
    >
      <Field label="Timer label">
        <input
          name="label"
          aria-label="Kitchen timer label"
          defaultValue={label}
          maxLength={80}
        />
      </Field>
      <div className="timer-duration">
        <Field label="Minutes">
          <input
            name="minutes"
            aria-label="Kitchen timer minutes"
            type="number"
            min={0}
            max={1440}
            defaultValue={5}
            required
          />
        </Field>
        <Field label="Seconds">
          <input
            name="seconds"
            aria-label="Kitchen timer seconds"
            type="number"
            min={0}
            max={59}
            defaultValue={0}
            required
          />
        </Field>
        <button className="secondary">
          <Timer size={15} />
          Start timer
        </button>
      </div>
      <label className="checkbox-label">
        <input name="sound" type="checkbox" defaultChecked />
        Play a sound when finished
      </label>
      <p className="fine">
        Timers stay on this device and survive reloads in this tab. Keep HEARTH
        open for alerts; browser sound may need a new user action after
        reloading.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="fine">
          {message}
        </p>
      )}
    </form>
  );
}
export function KitchenTimers() {
  const { timers, now, pause, resume, remove } = useKitchenTimers();
  const [open, setOpen] = useState(false);
  if (!timers.length) return null;
  const due = timers.filter(
    (t) => t.endAt !== null && timerSeconds(t, now) === 0,
  );
  const next =
    due[0] ||
    [...timers].sort((a, b) => timerSeconds(a, now) - timerSeconds(b, now))[0];
  return (
    <>
      <button
        className={"kitchen-timer-pill " + (due.length ? "finished" : "")}
        onClick={() => setOpen(true)}
        aria-label="Open kitchen timers"
      >
        <Timer size={17} />
        <span>
          {due.length
            ? `${due.length} timer${due.length === 1 ? "" : "s"} finished`
            : `${next.label} · ${clockLabel(timerSeconds(next, now))}`}
        </span>
        {timers.length > 1 && <small>{timers.length}</small>}
      </button>
      <span className="sr-only" role="status">
        {due.length
          ? `${due.length} kitchen timer${due.length === 1 ? " has" : "s have"} finished.`
          : ""}
      </span>
      {open && (
        <Modal title="Your kitchen timers" onClose={() => setOpen(false)}>
          <div className="kitchen-timer-list">
            {timers.map((t) => {
              const remaining = timerSeconds(t, now);
              return (
                <article key={t.id}>
                  <div>
                    <h3>{t.label}</h3>
                    <strong>{clockLabel(remaining)}</strong>
                    <small>
                      {remaining === 0
                        ? "Finished"
                        : t.endAt === null
                          ? "Paused"
                          : "Running"}
                    </small>
                  </div>
                  <div className="button-row">
                    {remaining > 0 && (
                      <button
                        className="secondary"
                        aria-label={`${t.endAt === null ? "Resume" : "Pause"} timer ${t.label}`}
                        onClick={() =>
                          t.endAt === null ? resume(t.id) : pause(t.id)
                        }
                      >
                        {t.endAt === null ? (
                          <Play size={15} />
                        ) : (
                          <Pause size={15} />
                        )}
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Dismiss timer ${t.label}`}
                      onClick={() => {
                        remove(t.id);
                        if (timers.length === 1) setOpen(false);
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <details>
            <summary>Add another timer</summary>
            <TimerForm />
          </details>
        </Modal>
      )}
    </>
  );
}

export function InlineKitchenTimers() {
  const { timers, now, pause, resume, remove } = useKitchenTimers();
  if (!timers.length) return null;
  return (
    <div className="inline-kitchen-timers" aria-label="Active kitchen timers">
      {timers.map((t) => (
        <div
          className={timerSeconds(t, now) === 0 ? "finished" : ""}
          key={t.id}
        >
          <span>
            <strong>{t.label}</strong>
            <small>
              {t.endAt === null
                ? "Paused"
                : timerSeconds(t, now) === 0
                  ? "Finished"
                  : "Running"}
            </small>
          </span>
          <b>{clockLabel(timerSeconds(t, now))}</b>
          {timerSeconds(t, now) > 0 && (
            <button
              className="icon-button"
              aria-label={`${t.endAt === null ? "Resume" : "Pause"} timer ${t.label}`}
              onClick={() => (t.endAt === null ? resume(t.id) : pause(t.id))}
            >
              {t.endAt === null ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
          <button
            className="icon-button"
            aria-label={`Dismiss timer ${t.label}`}
            onClick={() => remove(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
