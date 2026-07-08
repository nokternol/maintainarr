import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Load environment variables following the same priority hierarchy as Next.js:
 *
 *   .env.{NODE_ENV}.local   ← highest priority (gitignored, developer override)
 *   .env.local              ← gitignored (skipped in test env)
 *   .env.{NODE_ENV}         ← committed, environment-specific defaults
 *   .env                    ← committed base defaults
 *   process.env             ← system / CI-injected vars (always wins)
 *
 * Rules:
 *  - Files are loaded highest-priority-first with override:false so a variable
 *    set by process.env or a higher-priority file is never overwritten.
 *  - Missing files are silently skipped; no error is thrown.
 *  - .env.local is intentionally not loaded in test environments (prevents
 *    personal dev secrets from leaking into the test run).
 */
export function loadEnv(nodeEnv = process.env.NODE_ENV ?? 'development'): void {
  const root = process.cwd();

  const files: string[] = [
    `.env.${nodeEnv}.local`, // developer overrides for this environment
    ...(nodeEnv !== 'test' ? ['.env.local'] : []), // personal base overrides (not in test)
    `.env.${nodeEnv}`, // committed environment defaults
    '.env', // committed base defaults
  ];

  for (const file of files) {
    const filePath = path.resolve(root, file);
    if (existsSync(filePath)) {
      // override: false — system env vars (CI) always take precedence
      loadDotenv({ path: filePath, override: false });
    }
  }
}
