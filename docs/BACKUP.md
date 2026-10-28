# Backups and recovery

Use **Settings → Keep your kitchen safe**.

- **Back up now:** produces a consistent SQLite snapshot using `VACUUM INTO`, under `<data directory>/backups/`.
- **Export household data:** downloads versioned JSON including recipes, versions, plans, lists, purchases, pantry, prices, finances, conversations and schedules. Authentication and saved provider secrets are excluded. Treat it as private household data.
- **Restore export:** select a `hearth-v1` JSON export, review the confirmation, and replace household content transactionally. HEARTH validates the export, creates a database backup first, and rolls back failed restores. Current passphrase, sessions and provider credentials remain on the host.

Synchronize or explicitly review pending edits on **every** device before restoring. Current-device restoration is blocked while it has queued grocery edits. Other devices should reconnect and refresh afterward.

## Database file recovery

Stop HEARTH completely. Preserve the existing data directory before replacing anything. Copy a known-good SQLite backup to `hearth.sqlite` in the correct launch mode's data directory. Do not combine another database with stale `hearth.sqlite-wal` / `hearth.sqlite-shm` files; retain them with the preserved original and start the restored database cleanly. Restart HEARTH and verify recipes, plans and spending.

- Standalone server: `<repository>/.hearth/`, unless `HEARTH_DATA_DIR` is set.
- macOS desktop: `~/Library/Application Support/HEARTH/data/`.

A full SQLite backup includes encrypted secrets and authentication records. Provider credentials additionally require the original encryption key. The macOS key is in Keychain (`local.hearth.encryption`, account `HEARTH`); Linux uses `vault.key` in the private data directory. Keep that key protected. A household JSON export intentionally excludes credentials; re-enter provider credentials through Settings on a replacement machine.

Automatic snapshots run daily while the host runs. Backups currently have no automatic deletion policy: copy important snapshots to your own backup system and manage retention. A backup on the same disk does not protect against disk failure.
