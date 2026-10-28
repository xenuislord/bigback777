# Architecture

The Mac is the household host. Electron starts one loopback Fastify process and opens the same React application used by the PWA. Tailscale Serve terminates private HTTPS and forwards to that host. The phone never has a separate authoritative database.

## Modules

- `apps/desktop`: isolated renderer, sandboxed preload, narrowly scoped launch-at-login IPC, external HTTPS links in the system browser, single-instance lock, server-instance readiness check.
- `apps/server`: validated HTTP routes, sessions, CSRF checks, SSE change notifications, assistant tool registry and persistent scheduler.
- `apps/web`: React application, TanStack Query, responsive layouts, IndexedDB household cache and offline operation queue, installable service worker.
- `packages/shared`: versioned input schemas and domain types.
- `packages/database`: typed repository methods using Node's maintained built-in SQLite driver and prepared SQL; the driver replaces a separate ORM. First migration is `schema.sql` / schema version 1.
- `packages/recipes`: 60 original recipe definitions and explicitly estimated nutrient/cost averages.
- `packages/grocery`: canonical names, dimension-safe conversions, scaling and pantry deductions.
- `packages/deals`: offer eligibility, package comparisons, documented links, opt-in Kroger product-candidate adapter.
- `packages/finance`: integer-cent transaction accounting and separate hypothetical meal comparisons.
- `packages/ai`: protected host vault, Ollama and opt-in Responses API clients, timeout and stream-completion handling.

The database normalizes recipes and ingredients, meal plans and version snapshots, completions, pantry transactions, shared lists and purchase snapshots, historical price observations, exact expenses, goals/rewards, conversations/tool calls, jobs/notifications, sessions, idempotency receipts and audit events. Some less-developed domains use validated JSON within relational records. It does not yet implement every entity in the master model (see STATUS.md); there are no empty retailer-product or coupon tables pretending to supply missing integrations.

## Consistency

Important mutations use `BEGIN IMMEDIATE` transactions. Selected meal batches are atomic. Approved-plan revisions record the preceding version and rebuild derived groceries. Grocery edits require the expected item version and an operation UUID; successful retries return the same result. A stale or deleted target returns a conflict without overwriting another member's edit. IndexedDB retains that edit until the user explicitly retries against the current record or discards it. A conflict pauses later edits to the same item while unrelated items continue to sync.

SSE invalidates client queries after committed changes; periodic queries recover from dropped connections. SSE sessions are rechecked on events and heartbeats. Live processes do not survive host shutdown and must restart.

Ingredient aggregation uses grams, milliliters or item counts as canonical bases. Volume is never converted to mass without a density rule. Different beef cuts are distinct. Leftovers point to an original cooking batch, rather than adding ingredients again. Portion allocations prevent counting reserved leftovers twice in hypothetical financial comparisons.

If requirements change after a checkoff or entered price, a revised grocery record resets the old purchased flag/price, retains the old information in notes/audit history, and forces review. Completed purchase snapshots stay historical. Pantry is not automatically inflated by earlier grocery checkoffs.

## Authentication and security

This release uses a shared household passphrase with three named profiles, not private accounts with separate passwords or permissions. The password uses salted scrypt; session identifiers are random, hashed in SQLite, expire after 14 days and use HttpOnly/SameSite=Strict cookies. HTTPS requests receive Secure cookies. Rate limits apply to sign-in and requests. Writes require a custom CSRF header and matching origin. Secrets are never included in household exports or browser state.

Only the host loopback can perform first setup. Finish setup before enabling remote serving. Tailscale must restrict access to the household. Do not expose the backend to the public internet; this implementation has not had a third-party security audit.

Provider text is untrusted. Operations are parsed against a typed allowlist, stored as proposals and individually confirmed. Important changes are audited. No tool can run shell commands or arbitrary SQL. Financial proposals do not create transactions until confirmation.

## Offline

The service worker preloads the built HTML and its hashed JavaScript/CSS assets as well as icons and original food illustrations. Household data is cached in IndexedDB after successful authenticated loads. Tokens and keys are never cached. Recipes, the last viewed week, pantry and last-known financial records can be viewed offline. Conversation history and notifications are not retained in that cache. Only grocery record edits are queued; financial, settings and plan writes require the live host.

Offline access is device-local cached access, not a fresh server authentication. Protect the phone with its device lock. Explicit sign-out clears private cache and warns about unsynchronized edits. A full household restore requires resolving the current device's pending edits first; other devices must also synchronize before restore.

## Jobs and backups

Opt-in schedules persist their next run, status and attempts. Startup resets interrupted running jobs. A maximum of three exponential-backoff attempts ends in a visible failed status. No schedule approves a meal plan or spends money. Planning jobs produce reviewable library suggestions, not an approved calendar. Backups run on startup and once per UTC date while the process is running. Manual snapshots and exports are available in Settings. Backups currently need owner-managed retention.

## Client navigation and drafts

The selected page and week are represented in the URL hash, with browser history support. Session storage retains UI filters and a recipe selection draft within the current tab. Those preferences are written immediately so navigating away after a selection change cannot resurrect a stale draft. Signing out clears them. They contain no provider credentials and are not authoritative household records.

Checkout can accept the reviewed item IDs, expected versions and integer-cent prices together. It verifies the entire checked-item set and applies all prices plus the expense in one transaction; any concurrent modification rolls back the whole operation. Its operation UUID makes a repeated submission idempotent. Purchase history is exposed as a computed recorded flag without changing the existing database schema.

## Regular items, pantry coverage and saved leftovers

Migration 2 adds `shopping_staple`, `leftover_batch` and `leftover_event` without rewriting existing household records. An existing pre-v2 database is backed up before the additive migration. JSON exports include these records; older v1 exports can omit the new tables and still restore, with those newer domains empty. Export/restore retains foreign-key order and validates remaining portions.

Enabled regular shopping targets are canonicalized by ingredient and unit dimension. Their net requirement is the target less usable stock; merging with recipe requirements takes the larger net quantity, preventing duplicate purchases or a second pantry deduction. Draft weeks may create a regulars-only list without approving recipes. Manual additions remain extras.

Pantry recipe coverage merges duplicate ingredient requirements, scales portions, and compares compatible base units to unexpired recorded stock. A partial quantity does not count as a fully covered ingredient. Suggestions rank use-soon ingredient matches before overall coverage and time. This is deterministic calculation, independent of AI providers.

Leftovers represent actual saved portions, independently of the calendar's planned leftover relationships. Version checks and transactions protect usage and edits; operation IDs make repeated consumption requests idempotent. Restoring cannot exceed the original batch, and editing a batch preserves consumed portions. Events record the member, delta, reason and timestamp. No expense or ingredient consumption is inferred from a saved batch. Recipe allergens are copied as a snapshot.

Cooking progress and kitchen timers are device UI state in session storage. Timers store deadlines rather than decrementing a persisted counter, and use a shared React provider to continue across screen navigation. Browser audio is optional and depends on supported user activation. No background daemon or OS notification permission is requested.
