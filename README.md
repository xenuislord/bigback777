# HEARTH

**Eat well. Spend less. Feel better.**

A local household kitchen: 60 original recipes, weekly meal planning, pantry-aware groceries, shared shopping, weekly regular items, quantity-aware pantry suggestions, actual leftovers, step-by-step cooking with timers, recorded-price comparisons, spending, goals, reminders, and a persistent assistant. React/TypeScript PWA, Fastify, SQLite WAL, and an Electron desktop shell.

**Status:** the local planning, shopping, spending, persistence and offline workflows are implemented and tested. This is an initial working release, not completion of every item in the master specification. **ChatGPT subscription sign-in is not implemented** because the required official preview documentation was blocked by this environment's network policy. Ollama, optional API access, and the Kroger adapter need their respective services/authorization for live verification. See [the integration and delivery report](docs/STATUS.md) for exact limits.

## Run on your Mac

Install Node.js **24 LTS** and obtain this repository. Both Intel and Apple Silicon use the same source; npm downloads the matching Electron architecture. Native macOS packaging and Keychain behavior still require verification on a Mac.

```sh
npm ci
npm run build
npm run desktop
```

After the initial setup, double-click **[Start HEARTH.command](scripts/Start%20HEARTH.command)** to open the desktop app. macOS may require allowing a downloaded script through its normal security UI. No provider key is necessary for recipes, planning, shopping, or financial records. Create a household passphrase (12+ characters) in the app and name the three profiles. Use **Settings** for subsequent preferences and connections.

The desktop app owns its server on port **4310**. Do not also run the standalone server on that port. Closing the Mac window keeps HEARTH running; quitting the app stops its server. Launch at login is optional in the desktop Settings screen.

## Run in a browser / develop

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4310` **on the computer running HEARTH**. This serves the real production PWA and backend together. For frontend hot reload, use two terminals:

```sh
npm run dev        # API and server watcher, port 4310
npm run dev:web    # Vite, port 5173, same-origin API proxy
```

The cloud build environment is Linux x86-64, not a Mac. It was used for compilation, backend tests, Chromium desktop/mobile tests, and an Electron Node-runtime smoke test. It cannot establish macOS signing, Keychain prompts, iPhone Safari installation, or actual private-network connectivity.

## The everyday workflow

1. **Recipes:** enter cravings, ask for six meals, and review at least 12 library candidates when the filters permit. Select recipes; compare up to four. Favorite, rate, hide, edit, or add your own complete recipes and photos.
2. **Meal planner:** assign days, meal types, and portions. Add all selected meals atomically. Drag meals on desktop or edit their day on mobile. Reserve leftovers against a larger original batch. Approve the week to generate groceries.
3. **Groceries:** compatible units merge; recorded unexpired stock is deducted. Keep different meat cuts separate. Shop by department or store. Check items, enter actual prices, notes and shopper assignments. Record purchased items once as one expense.
4. **Grocery intelligence:** record observed prices and package sizes or import reviewed JSON. Compare eligible packages and travel assumptions. Unknown prices stay unknown; manual observations never become retailer-verified offers.
5. **Spending / goals:** log groceries, takeout, fees, tax and tips. Review the Reality Check or disable it. Actual expenses, remaining budget and hypothetical takeout avoidance remain separate.
6. **Assistant:** the default is a clearly labeled local recipe helper, not simulated AI. Connect a supported provider explicitly. Assistant mutations are proposed and validated; confirm before applying them.

Read the [user guide](docs/USER-GUIDE.md), [iPhone setup](docs/IPHONE.md), [architecture](docs/ARCHITECTURE.md), and [backup guide](docs/BACKUP.md).

## Tests and packaging

```sh
npm run check
npm test
npm run build
npm run test:e2e       # production build required; uses system Chromium if present
npm run test:runtime   # bundles backend and tests Electron's Node/SQLite runtime
npm run format:check
npm run package:mac    # run on macOS; creates release/DMG and ZIP
```

If no system Chromium is installed, run `npx playwright install chromium` once. The browser download domains must be allowed by your network. Browser tests use independent temporary households on ports 4311 (desktop) and 4313 (phone); the runtime smoke test uses port 4312. Never point tests at a real household database. Test fixtures use their own sessions and honor login/request rate limits; the suite pauses at window boundaries rather than weakening production limits.

The macOS package is configured but **has not been built, signed, notarized or installed on macOS here**. A distributable release needs Apple signing credentials and an actual macOS verification pass. The desktop source launch process is provided above. The server bundle retains `node:sqlite` and is tested against Electron's embedded Node 22.22 runtime.

## Data and credentials

| Launch mode                 | Default data directory                       |
| --------------------------- | -------------------------------------------- |
| `npm start` / `npm run dev` | `<repository>/.hearth/`                      |
| Electron on macOS           | `~/Library/Application Support/HEARTH/data/` |
| Override for server         | `HEARTH_DATA_DIR`                            |

`hearth.sqlite` is the primary database, with SQLite `-wal` and `-shm` files while open. Backups are in `backups/` inside the data directory. On macOS, the encryption key for saved provider credentials is stored in Keychain under service `local.hearth.encryption`, account `HEARTH`. On Linux, the encryption key is an owner-only `vault.key` inside the owner-only data directory. Provider secrets are AES-256-GCM-encrypted in SQLite and never returned to frontend JavaScript. Keep the data directory private and backed up; encryption is not a replacement for securing the host.

`.env.example` lists optional configuration. `npm start` inherits environment variables; it does not silently load `.env`. All everyday household/provider settings are available in the UI. `HEARTH_SAMPLE_MODE=1` labels the environment as sample mode; it never inserts fake current promotions.

## External integrations

- **ChatGPT subscription:** unavailable pending official protocol verification and implementation; no copied session cookies or unofficial endpoints are used, and no usage balance is invented.
- **Ollama:** install/start Ollama on the Mac and download a suitable model yourself. HEARTH lists installed models. No automatic model downloads.
- **OpenAI API:** separately billed, off by default; save a key on the host and explicitly enable it. No automatic billing fallback.
- **Kroger:** requires approved developer credentials, appropriate product scope, and a store location ID. Its product search candidates require human review; they do not silently become verified comparable offers.
- **Other retailers, Flipp, farmers markets:** official links and manual observations. No presumed free feed, scraping bypass, verified schedules, or invented price coverage.
- **USDA:** no live FoodData Central connector is implemented; starter recipe nutrition remains explicitly estimated.

The cloud environment draft contains setup/start instructions and domain additions for documentation, optional providers, and Playwright downloads. Saving that draft does not apply its network policy or publish an environment snapshot. Review and save it in environment settings, then publish when appropriate.
