import { copyFileSync } from "node:fs";
copyFileSync("packages/database/src/schema.sql", "dist-server/schema.sql");
