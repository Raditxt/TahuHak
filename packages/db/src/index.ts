import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

export * as schema from "./schema.ts";

export const URL_DEFAULT = "postgres://tahuhak:tahuhak@localhost:54329/tahuhak";

export function sambung(url = process.env.DATABASE_URL ?? URL_DEFAULT) {
  const client = postgres(url, { max: 4, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, tutup: () => client.end() };
}

export type Db = ReturnType<typeof sambung>["db"];

export async function migrasi(db: Db) {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
}
