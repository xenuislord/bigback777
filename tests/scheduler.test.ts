import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HearthDB } from "../packages/database/src/index.ts";
import { Vault } from "../packages/ai/src/providers.ts";
import { startScheduler } from "../apps/server/src/scheduler.ts";
afterEach(() => vi.useRealTimers());
describe("persistent opt-in scheduler", () => {
  it("creates reviewable suggestions without approving or changing the calendar", () => {
    const dir = mkdtempSync(join(tmpdir(), "hearth-jobs-"));
    const db = new HearthDB(dir);
    const vault = new Vault(db);
    try {
      db.run(
        "INSERT INTO scheduled_job(id,data,next_run) VALUES(?,?,?)",
        "weekly",
        JSON.stringify({ kind: "planning", intervalDays: 7, enabled: true }),
        "2000-01-01T00:00:00.000Z",
      );
      const stop = startScheduler(db, vault);
      stop();
      expect(db.state().notifications[0].title).toContain("next week");
      expect(db.state().plan.approved).toBe(false);
      expect(db.state().plan.meals).toHaveLength(0);
      expect(
        new Date(
          db.one("SELECT next_run FROM scheduled_job").next_run,
        ).getTime(),
      ).toBeGreaterThan(Date.now());
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("limits failures to three attempts and persists visible failure state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const dir = mkdtempSync(join(tmpdir(), "hearth-jobs-"));
    const db = new HearthDB(dir);
    const vault = new Vault(db);
    let stop = () => {};
    try {
      db.run(
        "INSERT INTO scheduled_job(id,data,next_run) VALUES(?,?,?)",
        "deals",
        JSON.stringify({ kind: "deals", intervalDays: 7, enabled: true }),
        "2000-01-01T00:00:00.000Z",
      );
      stop = startScheduler(db, vault);
      await vi.advanceTimersByTimeAsync(7 * 60000);
      const row = db.one("SELECT * FROM scheduled_job");
      expect(row.status).toBe("failed");
      expect(row.attempts).toBe(3);
      expect(db.state().notifications).toHaveLength(3);
    } finally {
      stop();
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
