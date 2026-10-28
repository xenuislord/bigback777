import { randomUUID } from "node:crypto";
import { HearthDB } from "../../../packages/database/src/index.ts";
import { weekStart } from "../../../packages/shared/src/index.ts";
import { scanKroger } from "../../../packages/deals/src/kroger.ts";
import { Vault } from "../../../packages/ai/src/providers.ts";
import { search } from "./tools.ts";
export function startScheduler(db: HearthDB, vault: Vault) {
  let running = false;
  let lastBackup = "";
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      if (lastBackup !== date) {
        db.backup();
        lastBackup = date;
        db.run("DELETE FROM session WHERE expires_at<?", Date.now());
      }
      for (const row of db.all(
        "SELECT * FROM scheduled_job WHERE next_run<=? AND status='idle' AND attempts<3",
        now.toISOString(),
      )) {
        const job = JSON.parse(row.data);
        if (!job.enabled) continue;
        db.run("UPDATE scheduled_job SET status='running' WHERE id=?", row.id);
        try {
          if (job.kind === "planning") {
            const recipes = search(db, db.settings().dietNotes, 12);
            db.notify(
              "Your next week is ready to explore",
              `Review these draft suggestions: ${recipes.map((r) => r.title).join(", ")}. No meals were approved.`,
            );
          } else if (job.kind === "deals") {
            await scanKroger(db, vault, weekStart());
            db.notify(
              "Price check finished",
              "Review the available provider candidates and record comparable observations.",
            );
          } else
            db.notify(
              `${job.kind[0].toUpperCase() + job.kind.slice(1)} reminder`,
              "Open HEARTH to review your household records.",
            );
          db.run(
            "UPDATE scheduled_job SET status='idle',attempts=0,next_run=? WHERE id=?",
            new Date(now.getTime() + job.intervalDays * 86400000).toISOString(),
            row.id,
          );
        } catch (e: any) {
          const attempts = row.attempts + 1;
          db.run(
            "UPDATE scheduled_job SET status=?,attempts=?,next_run=? WHERE id=?",
            attempts >= 3 ? "failed" : "idle",
            attempts,
            new Date(now.getTime() + 60000 * 2 ** attempts).toISOString(),
            row.id,
          );
          db.notify(
            "Scheduled task needs attention",
            `${job.kind}: ${e.message}. Attempt ${attempts} of 3.`,
          );
        }
        db.changed("scheduler.run", null, { jobId: row.id });
        db.broadcast();
      }
    } finally {
      running = false;
    }
  };
  const run = () =>
    void tick().catch(() => {
      try {
        db.notify(
          "Scheduler needs attention",
          "A background task could not complete. Check host storage and database access.",
        );
        db.broadcast();
      } catch {}
    });
  const timer = setInterval(run, 30000);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
