# Integration and delivery status

This report describes evidence from the current **Linux x86-64 / Node 24.19** cloud instance. It does not claim a published environment snapshot, native Mac acceptance, live retailer coverage, or a finished implementation of every requirement in the master prompt.

## Implemented and tested locally

| Capability                                                                                            | Evidence / bounds                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite persistence, WAL, prepared SQL, initial schema migration                                       | Real close/reopen integration test; integrity/foreign-key checks                                                                                     |
| Three named household profiles                                                                        | Shared passphrase, salted scrypt, 14-day HttpOnly sessions, CSRF/origin checks and login rate limit; no separate profile passwords                   |
| 60 original recipes                                                                                   | Unique titles, validated complete ingredients/steps, 20 dinners; estimated nutrition/costs; illustrations rather than claimed photography            |
| Recipe discovery, favorites, rejection, ratings, notes and editing                                    | Real API operations; desktop/mobile browser selection workflow; strict filters can return fewer candidates                                           |
| Weekly calendar, batch selection, single-meal changes, approval, history restore and linked leftovers | API tests for atomic rollback, version conflict, restoration and portion relationships; browser plans six meals                                      |
| Grocery aggregation, conversion, serving scale, pantry deductions                                     | Tests include 1 lb + 2 lb + 8 oz = 3.5 lb; different cuts and dimensions remain distinct                                                             |
| Shared shopping and optimistic conflict handling                                                      | Two independent browser clients synchronize a checkoff; stale edits return 409; UUID retries are idempotent                                          |
| Offline PWA shell/data and shopping queue                                                             | Desktop and iPhone-sized Chromium reload offline and replay edits on reconnect; actual Safari/Home Screen install remains untested                   |
| Manual grocery additions, price fields, notes, store/shopper assignments                              | Real records; checkout requires actual prices and records purchases once                                                                             |
| Recalculation after a purchase flag or price                                                          | A changed requirement resets the stale flag/price and preserves prior values in notes/audit history                                                  |
| Pantry CRUD / historical inventory adjustments                                                        | Unexpired compatible quantities only; no assumption that an old shopping checkbox means stock exists                                                 |
| Manual price observations and reviewed JSON imports                                                   | Historical observations retained; expired/ineligible/quality-mismatched offers excluded; no invented prices                                          |
| Package/eligibility/basket comparison                                                                 | Package rounding, minimum purchase, loyalty and membership checks, explicit unpriced items and user-specified travel costs; no map routing claim     |
| Integer-cent finances and Reality Check                                                               | Actual transactions kept separate from recipe estimates, budget remainder and hypothetical takeout avoidance; leftover portions allocated once       |
| Goals and linked rewards                                                                              | Cooked-meal / budget / custom measures; persisted progress and claim validation; weekly rhythm rather than a complete historical streak engine       |
| Persistent household chat and typed tool registry                                                     | Deterministic default helper is clearly labeled; financial proposals require confirmation, validated mutations are idempotent and audited            |
| Opt-in persistent schedules                                                                           | Planning suggestions never approve a week; restart recovery plus at most three retries and visible failure status tested                             |
| Automatic/manual backup, export and transactional restore                                             | Real snapshot/export/restore tests; secrets/auth excluded from JSON export; retention currently user-managed                                         |
| Production frontend and server bundle                                                                 | TypeScript/Vite build, responsive screens; bundled server also runs in Electron's embedded Node 22.22 with SQLite/static serving/sign-in/persistence |

Automated commands: `npm test` (51 unit/API/scheduler/offline tests), `npm run test:e2e` (16 Chromium tests across desktop and iPhone-sized viewports), `npm run test:runtime`, `npm run build`. Read the terminal result for the latest execution, rather than treating this document as a substitute for running them.

## Everyday usability improvements

Quick search (⌘/Ctrl-K), page/week URL navigation, browser Back/Forward, retained recipe filters/selections, shortcut filters and sorting, direct calendar-slot recipe picking, shopping search/focus mode, checkoff Undo, atomic one-screen price checkout, and dollar-based assistant expense review are implemented. Completed assistant actions remain marked completed after reload. Offline conflicts pause only the affected item's edits. Tests exercise these flows at desktop and phone sizes, including exact transaction totals and concurrent-checkout rollback.

## Additional everyday features

Enabled weekly regular items merge with recipe needs as minimum requirements and deduct usable stock once. A regulars-only list can be created without approving recipes. Quantity-aware pantry suggestions expose missing amounts, prioritize use-soon ingredients, and exclude expired or incompatible stock. Actual leftover batches support shared remaining portions, undo, discard, and safe concurrent updates without inventing expenses. Cooking mode includes scaled ingredient checklists, saved step progress and up to six pauseable timers with deadline-based reload recovery and optional browser sound. Timers and cooking progress are device-local and do not provide OS/push notifications.

The additive v2 database migration, legacy-export compatibility, regular-item calculations and leftover idempotency are covered by tests. Browser tests exercise these features at desktop and phone sizes; physical audible alerts and OS behavior are not claimed as verified.

## Implemented interfaces/adapters, live verification outstanding

| Integration                                     | Current state                                                                                                                                   | Requirement to verify                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ollama                                          | Local `/api/tags` discovery and structured chat client with explicit model selection and timeouts                                               | Ollama running with a suitable installed model on the Mac; none reachable here. Insufficient-memory/model failures surface as provider errors, not a fake fallback.        |
| OpenAI API                                      | Opt-in host-only encrypted credential, authorized model discovery, public Responses API with `store:false`, streaming, required completed event | User explicitly enables separate API billing and saves a key securely in app Settings; no key was requested in chat or used here.                                          |
| Routine AI routing                              | Distinct provider/model settings and routing support in the provider module                                                                     | Automatic classification/substitution workflows are not yet wired into all screens; normal chat uses the assistant route.                                                  |
| Kroger                                          | Opt-in official-endpoint OAuth client-credential/product-candidate adapter; raw candidates go to review, not directly to price matching         | Approved developer application, product scope, store location ID and allowed network access. Live API and current terms/docs were not verified here. No access is claimed. |
| iPhone access                                   | Private HTTPS-origin setting, QR code, PWA, Tailscale Serve instructions and host-status panel                                                  | A Mac and iPhone on the intended private network. Saved origin is explicitly not remote-health verification.                                                               |
| macOS shell / Keychain / login item / packaging | Electron code, Keychain-protected encryption-key path, narrow IPC, DMG/ZIP build configuration and launcher                                     | Run on a real Mac; sign/notarize a distributable build. Linux runtime testing does not verify those OS functions.                                                          |

## Blocked: official ChatGPT subscription sign-in

All five official SIWC documentation URLs from the request were attempted through the configured HTTPS proxy. They returned **403 domain forbidden**. The running environment still reports the original enforced package-manager-only allowlist. The documentation and provider domains were saved to the configuration draft, but saving a draft does not change the running network policy.

No official maintained OpenAI SIWC library was identified in the npm registry search. Third-party packages claiming SIWC support were not substituted for the requested official documentation.

Consequently **the Continue with ChatGPT control currently explains the blocker; it does not authenticate**. Dynamic registration, stable installation host registration, loopback OAuth, PKCE, nonce/state/issuer/audience/signature verification, refresh/revocation, subscription model discovery and plan-backed inference are **not implemented**. No ChatGPT plan access, usage allowance, or conversation access is claimed. The code does not borrow Codex/GitHub credentials, use cookies, or invoke hidden ChatGPT endpoints. OpenAI API billing never activates as a fallback.

Required next action: in cloud environment settings, review and save the domain additions including `developers.openai.com`, `auth.openai.com` and `api.openai.com`; publish the environment configuration as appropriate. Then re-check official documentation and implement/verify the exact current local-app contract. Merely opening the domains does not itself finish OAuth.

## Additional specification work not yet delivered

- USDA FoodData Central integration, verified micronutrients and licensed external recipe import; current estimates are explicitly labeled.
- Verified live coupons/weekly-ad ingestion, licensed Flipp integration, complete retailer product/store/eligibility catalogs, independently verified farmers-market schedules, maps/travel-time routing and all requested shopping-optimization views. Existing comparisons use standard-quality recorded observations and explicit travel assumptions only.
- Automated receipt/flyer image extraction and camera barcode scanning; manual price/ingredient entry and reviewed JSON imports are the working alternatives.
- Full historical streak/milestone engine, native/push notification delivery, receipt attachments, richer longitudinal/annual forecasts, source-linked verified deal savings, and a complete implementation of every data entity listed in the master specification.
- More extensive plan-swapping interactions and arbitrary recipe import automation. Single-meal editing, day changes, copying an empty week, leftover reservations and history restoration are implemented.
- Native Safari/iPhone tests, physical Mac installation and signing/notarization, network/OS integration acceptance, independent security review and full accessibility audit.

These items remain separate from the verified local workflows. The app never represents the missing integrations or optional hardware capabilities as operational.
