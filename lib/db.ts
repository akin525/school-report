import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set. Please set it in your environment variables.");
}

// Create a connection pool
const poolConnection = mysql.createPool(connectionString || "");

export const db = drizzle(poolConnection, { schema, mode: 'default' });

// For backward compatibility during migration (though it returns the same drizzle instance)
// Note: This will now return an async-capable object, so all calls must be updated to await.
export function getDb() {
  return db;
}

export default getDb;
