import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { nextCookies } from "better-auth/next-js";

// Persist the in-memory store across Next.js dev hot-reloads.
// The memory adapter throws if it is asked to read a model before it exists,
// so we pre-seed the core tables as empty arrays.
const globalForDb = globalThis as unknown as {
  memoryDB?: Record<string, unknown[]>;
};
const memoryDB =
  globalForDb.memoryDB ??
  (globalForDb.memoryDB = {
    user: [],
    session: [],
    account: [],
    verification: [],
    rateLimit: [],
  });

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: memoryAdapter(memoryDB),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
