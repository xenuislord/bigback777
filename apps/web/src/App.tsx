import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Flame,
  House,
  BookOpen,
  CalendarDays,
  ShoppingBasket,
  Package,
  Wallet,
  Target,
  MessageCircle,
  Settings,
  PanelRightOpen,
  Menu,
  X,
  ArrowRight,
  Wifi,
  WifiOff,
  LogOut,
  Search,
} from "lucide-react";
import { api, APIError } from "./api.ts";
import {
  read,
  write,
  cacheState,
  nextQueuedEdit,
  clearPrivateCache,
  type PendingEdit,
} from "./offline.ts";
import { Ctx, Field, type Page } from "./context.tsx";
import { Home, Recipes, RecipeDetail, MealPlanner } from "./Kitchen.tsx";
import { Groceries, Pantry, DealsPanel } from "./Shopping.tsx";
import { Spending, Goals, SettingsPage, Assistant } from "./Household.tsx";
import {
  weekStart,
  type AppState,
  type Recipe,
} from "../../../packages/shared/src/index.ts";
import { useNavigation } from "./navigation.ts";
import { clearUIPreferences } from "./preferences.ts";
import { KitchenTimers } from "./KitchenTimers.tsx";
import { QuickSearch } from "./QuickSearch.tsx";
const nav: [Page, typeof House][] = [
  ["Home", House],
  ["Recipes", BookOpen],
  ["Meal planner", CalendarDays],
  ["Groceries", ShoppingBasket],
  ["Pantry", Package],
  ["Spending", Wallet],
  ["Goals & rewards", Target],
  ["Assistant", MessageCircle],
  ["Settings", Settings],
];
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className={wide ? "modal wide" : "modal"}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function SignIn({
  auth,
  onSuccess,
}: {
  auth: any;
  onSuccess: (v: any) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="signin">
      <div className="signin-story">
        <Flame size={48} />
        <p className="eyebrow">A little more home.</p>
        <h1>
          Good food.
          <br />A calmer week.
        </h1>
        <p>
          Your recipes, your people, your kitchen.
          <br />
          Make room for the things that matter.
        </p>
        <img
          src="/art/meal-0.svg"
          alt="Original illustration of a home-cooked meal"
        />
      </div>
      <div className="signin-form">
        <div className="brand">
          <Flame />
          HEARTH
        </div>
        <p className="eyebrow">Eat well. Spend less. Feel better.</p>
        <h2>{auth.setup ? "Welcome home." : "Make this kitchen yours."}</h2>
        <p>
          {auth.setup
            ? "Choose your profile and sign in to your shared household."
            : "Set a household passphrase and name your three profiles. Everyone shares one kitchen; changes are attributed to their profile."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const data = await api(
                auth.setup ? "/auth/login" : "/auth/setup",
                {
                  password: f.get("password"),
                  memberId: f.get("memberId") || "member-1",
                  ...(!auth.setup
                    ? {
                        names: [f.get("name1"), f.get("name2"), f.get("name3")],
                      }
                    : {}),
                },
              );
              onSuccess({
                ...auth,
                setup: true,
                authenticated: true,
                memberId: data.memberId,
              });
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!auth.setup ? (
            <div className="form-grid">
              {[1, 2, 3].map((i) => (
                <Field key={i} label={`Adult ${i}`}>
                  <input
                    name={`name${i}`}
                    defaultValue={["Alex", "Jamie", "Sam"][i - 1]}
                    required
                    maxLength={40}
                  />
                </Field>
              ))}
            </div>
          ) : (
            <Field label="Your profile">
              <select name="memberId">
                {auth.members.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Household passphrase">
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={200}
              autoComplete={auth.setup ? "current-password" : "new-password"}
              placeholder="At least 12 characters"
            />
          </Field>
          <p className="fine">
            Use a passphrase you can share privately with your household. All
            profiles can edit shared records.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy
              ? "Opening your kitchen…"
              : auth.setup
                ? "Open my kitchen"
                : "Create our household"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="fine">
          Local first. Your household data stays on your host computer.
        </p>
      </div>
    </div>
  );
}
export default function App() {
  const qc = useQueryClient();
  const [auth, setAuth] = useState<any>(null);
  const [authError, setAuthError] = useState("");
  const { week, setWeek, page, navigate: goTo } = useNavigation();
  const [mobileNav, setMobileNav] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [toast, setToastText] = useState("");
  const [toastAction, setToastAction] = useState<
    { label: string; onClick: () => void } | undefined
  >();
  const setToast = (
    text: string,
    action?: { label: string; onClick: () => void },
  ) => {
    setToastText(text);
    setToastAction(action);
  };
  const [quickSearch, setQuickSearch] = useState(false);
  const confirmedVersions = useRef<Record<string, number>>({});
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickSearch((v) => !v);
      }
      if (e.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<PendingEdit[]>([]);
  const queueRef = useRef<PendingEdit[]>([]);
  const flushing = useRef(false);
  const queueReady = useRef(false);
  const loadAuth = useCallback(
    () =>
      api("/auth/status")
        .then((a) => {
          setAuth(a);
          setOnline(true);
        })
        .catch(async (e) => {
          const cached = await read<AppState>("state");
          if (cached) {
            setAuth({
              setup: true,
              authenticated: true,
              memberId: (await read("memberId")) || "member-1",
            });
            setOnline(false);
          } else setAuthError(e.message);
        }),
    [],
  );
  useEffect(() => {
    void loadAuth();
    void read<PendingEdit[]>("queue").then((q) => {
      queueRef.current = q || [];
      setQueue(q || []);
      queueReady.current = true;
    });
  }, [loadAuth]);
  const query = useQuery<AppState>({
    queryKey: ["state", week],
    enabled: !!auth?.authenticated,
    queryFn: async () => {
      try {
        const s = await api<AppState>("/state?week=" + week);
        setOnline(true);
        await cacheState(s);
        return s;
      } catch (e: any) {
        if (e.status === 401) {
          setAuth((a: any) => ({ ...a, authenticated: false }));
          throw e;
        }
        setOnline(false);
        const cached = await read<AppState>("state");
        if (cached && cached.plan.week === week) return cached;
        throw e;
      }
    },
    retry: false,
    refetchInterval: 20000,
  });
  const saveQueue = async (q: PendingEdit[]) => {
    queueRef.current = q;
    setQueue(q);
    await write("queue", q);
  };
  const flush = useCallback(async () => {
    if (flushing.current || !queueReady.current || !auth?.authenticated) return;
    flushing.current = true;
    try {
      while (queueRef.current.length) {
        const op = nextQueuedEdit(queueRef.current);
        if (!op) break;
        try {
          const saved = await api("/sync", op);
          confirmedVersions.current[op.itemId] = saved.version;
          setOnline(true);
          await saveQueue(
            queueRef.current.filter((x) => x.operationId !== op.operationId),
          );
          await qc.invalidateQueries({ queryKey: ["state"] });
        } catch (e: any) {
          if (e.status === 409 || e.status === 404) {
            await saveQueue(
              queueRef.current.map((x) =>
                x.operationId === op.operationId
                  ? { ...x, conflict: e.message }
                  : x,
              ),
            );
            continue;
          }
          if (e.status === 0) setOnline(false);
          else setToast(e.message);
          break;
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [auth?.authenticated, qc]);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void loadAuth();
      void flush();
      void qc.invalidateQueries({ queryKey: ["state"] });
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const timer = setInterval(() => {
      if (navigator.onLine) void flush();
    }, 6000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(timer);
    };
  }, [flush, loadAuth, qc]);
  useEffect(() => {
    if (!auth?.authenticated) return;
    const events = new EventSource("/api/events");
    events.onmessage = () => {
      setOnline(true);
      void qc.invalidateQueries({ queryKey: ["state"] });
    };
    events.onerror = () => setOnline(false);
    return () => events.close();
  }, [auth?.authenticated, qc]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const state = query.data;
  useEffect(() => {
    document.title = `${page} · HEARTH`;
  }, [page]);
  useEffect(() => {
    if (!state) return;
    const t = state.settings.theme;
    document.documentElement.dataset.theme =
      t === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
  }, [state?.settings.theme]);
  const navigate = (p: Page) => {
    goTo(p);
    setMobileNav(false);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      document.getElementById("main")?.focus({ preventScroll: true }),
    );
  };
  const act = async (path: string, data?: unknown, method?: string) => {
    try {
      const r = await api(path, data, method);
      await qc.invalidateQueries({ queryKey: ["state"] });
      return r;
    } catch (e: any) {
      setToast(e.message);
      throw e;
    }
  };
  const editGrocery = async (id: string, patch: Record<string, unknown>) => {
    const i = state?.groceries.find((i) => i.id === id);
    if (!i) return;
    const pending = queueRef.current.filter((q) => q.itemId === id);
    await saveQueue([
      ...queueRef.current,
      {
        operationId: crypto.randomUUID(),
        itemId: id,
        version: pending.length
          ? pending[pending.length - 1].version + 1
          : Math.max(i.version, confirmedVersions.current[id] || 0),
        patch,
        label: i.name,
      },
    ]);
    void flush();
  };
  const resolveEdit = async (id: string, retry: boolean) => {
    const op = queueRef.current.find((q) => q.operationId === id);
    if (!op) return;
    if (retry) {
      const fresh = await api<AppState>("/state?week=" + week);
      const item = fresh.groceries.find((i) => i.id === op.itemId);
      if (!item) {
        setToast(
          "This item was removed. Copy your note before discarding this edit.",
        );
        return;
      }
      await saveQueue(
        queueRef.current.map((x) =>
          x.operationId === id
            ? { ...x, version: item.version, conflict: undefined }
            : x,
        ),
      );
    } else
      await saveQueue(queueRef.current.filter((x) => x.operationId !== id));
    void flush();
  };
  const logout = async () => {
    if (
      queueRef.current.length &&
      !confirm(
        "There are unsynchronized shopping edits. Signing out clears this device’s private cache and pending edits. Continue?",
      )
    )
      return;
    await api("/auth/logout", {});
    await clearPrivateCache();
    clearUIPreferences();
    window.dispatchEvent(new Event("hearth:clear-timers"));
    confirmedVersions.current = {};
    await caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("hearth-shell-"))
            .map((k) => caches.delete(k)),
        ),
      );
    queueRef.current = [];
    setQueue([]);
    qc.clear();
    await loadAuth();
  };
  if (authError && !auth)
    return (
      <main className="startup">
        <Flame />
        <h1>Waiting for your kitchen</h1>
        <p>{authError}</p>
        <button
          className="primary"
          onClick={() => {
            setAuthError("");
            void loadAuth();
          }}
        >
          Try again
        </button>
      </main>
    );
  if (!auth)
    return (
      <main className="startup">
        <Flame className="breathe" />
        <p>Warming up your kitchen…</p>
      </main>
    );
  if (!auth.authenticated)
    return (
      <SignIn
        auth={auth}
        onSuccess={(a) => {
          setAuth(a);
          void write("memberId", a.memberId);
          void qc.invalidateQueries();
        }}
      />
    );
  if (!state)
    return (
      <main className="startup">
        <Flame />
        <p>{query.error?.message || "Opening your household…"}</p>
        {query.error && <button onClick={() => query.refetch()}>Retry</button>}
      </main>
    );
  const s = {
    ...state,
    staples: state.staples || [],
    leftovers: state.leftovers || [],
    groceries: state.groceries.map((i) => {
      const ops = queue.filter((q) => q.itemId === i.id);
      return ops.reduce(
        (v, q) => ({ ...v, ...q.patch, version: v.version + 1 }),
        i,
      );
    }),
  };
  return (
    <Ctx.Provider
      value={{
        s,
        week,
        setWeek,
        page,
        navigate,
        act,
        toast: setToast,
        openRecipe: setDetail,
        online,
        queue,
        editGrocery,
        resolveEdit,
        refresh: () => void qc.invalidateQueries({ queryKey: ["state"] }),
        logout: () => void logout(),
        memberId: auth.memberId,
      }}
    >
      <div className="app-shell">
        {mobileNav && (
          <button
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside className={"sidebar " + (mobileNav ? "is-open" : "")}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("Home");
            }}
          >
            <Flame size={30} />
            HEARTH<span className="brand-dot">·</span>
          </a>
          <p className="sidebar-caption">YOUR HOUSEHOLD KITCHEN</p>
          <nav>
            {nav.map(([name, Icon], i) => (
              <button
                key={name}
                className={
                  (page === name ? "active " : "") +
                  (i === 5 ? "nav-break" : "")
                }
                aria-current={page === name ? "page" : undefined}
                onClick={() => navigate(name)}
              >
                <Icon size={19} />
                {name}
                {name === "Groceries" &&
                  s.groceries.filter((i) => !i.purchased).length > 0 && (
                    <span className="nav-count">
                      {s.groceries.filter((i) => !i.purchased).length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="household-avatars">
              {s.members.map((m, i) => (
                <span title={m.name} className={`avatar a${i}`} key={m.id}>
                  {m.name.slice(0, 1)}
                </span>
              ))}
              <div>
                <strong>{s.settings.householdName}</strong>
                <small>
                  {s.settings.adults} adults · {s.settings.city}
                </small>
              </div>
            </div>
            <p>
              <span className={"status-dot " + (!online ? "offline" : "")} />
              {online
                ? "Connected to your kitchen"
                : "Host offline · cached view"}
            </p>
            <button className="text-button" onClick={() => void logout()}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div>
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobileNav((v) => !v)}
                aria-label="Open navigation"
              >
                <Menu size={22} />
              </button>
              <span className="breadcrumb">
                Our kitchen <span>/</span> <strong>{page}</strong>
              </span>
            </div>
            <div className="topbar-actions">
              <button
                className="quick-search-trigger"
                aria-label="Quick search"
                onClick={() => setQuickSearch(true)}
              >
                <Search size={16} />
                <span>Find anything</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className="connection-label">
                {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
                {online
                  ? queue.length
                    ? `${queue.length} edit(s) queued`
                    : "All changes saved"
                  : "Offline · edits stay on this device"}
              </span>
              <button
                className="assistant-toggle"
                onClick={() => setAssistant((v) => !v)}
              >
                <MessageCircle size={16} />
                <span>Hearth Assistant</span>
              </button>
              <span className="avatar current">
                {s.members
                  .find((m) => m.id === auth.memberId)
                  ?.name.slice(0, 1) || "H"}
              </span>
            </div>
          </header>
          {(!online || s.sampleMode) && (
            <div className="notice">
              {s.sampleMode
                ? "Sample-data mode is enabled. Imported sample offers must remain labeled."
                : "Your Mac host is unavailable. Cached recipes and groceries are available. Shopping edits are queued; other changes need the host."}
            </div>
          )}
          <main className="main-content" id="main" tabIndex={-1}>
            {page === "Home" ? (
              <Home />
            ) : page === "Recipes" ? (
              <Recipes />
            ) : page === "Meal planner" ? (
              <MealPlanner />
            ) : page === "Groceries" ? (
              <Groceries />
            ) : page === "Pantry" ? (
              <Pantry />
            ) : page === "Spending" ? (
              <Spending />
            ) : page === "Goals & rewards" ? (
              <Goals />
            ) : page === "Assistant" ? (
              <Assistant />
            ) : (
              <SettingsPage />
            )}
          </main>
          <footer className="app-footer">
            <span>Made for the everyday, shared around the table.</span>
            <span>HEARTH · Eat well. Spend less. Feel better.</span>
          </footer>
        </div>
        {assistant && (
          <aside className="assistant-drawer">
            <div className="drawer-top">
              <span>
                <Flame size={20} />
                Hearth Assistant
              </span>
              <button
                className="icon-button"
                aria-label="Close assistant"
                onClick={() => setAssistant(false)}
              >
                <X size={20} />
              </button>
            </div>
            <Assistant compact />
          </aside>
        )}
        <nav className="bottom-nav">
          {nav.slice(0, 4).map(([name, Icon]) => (
            <button
              className={page === name ? "active" : ""}
              key={name}
              onClick={() => navigate(name)}
            >
              <Icon size={20} />
              <span>{name === "Meal planner" ? "Plan" : name}</span>
            </button>
          ))}
          <button onClick={() => setMobileNav((v) => !v)}>
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
      </div>
      <KitchenTimers />
      {quickSearch && <QuickSearch onClose={() => setQuickSearch(false)} />}
      {detail && (
        <RecipeDetail
          recipe={s.recipes.find((r) => r.id === detail.id) || detail}
          onClose={() => setDetail(null)}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          <span>{toast}</span>
          {toastAction && (
            <button
              className="toast-action"
              onClick={() => {
                const action = toastAction;
                setToast("");
                action.onClick();
              }}
            >
              {toastAction.label}
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
