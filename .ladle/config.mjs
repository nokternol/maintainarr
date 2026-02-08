import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.{tsx,jsx}',
  viteConfig: path.resolve(__dirname, '../vitest.config.ts'),
};
