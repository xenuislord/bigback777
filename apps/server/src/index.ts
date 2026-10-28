import { createApp } from "./app.ts";
import { startScheduler } from "./scheduler.ts";
const { app, db, vault } = await createApp();
const stop = startScheduler(db, vault);
await app.listen({
  host: process.env.HEARTH_HOST || "127.0.0.1",
  port: Number(process.env.HEARTH_PORT || 4310),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    stop();
    await app.close();
    process.exit(0);
  });
