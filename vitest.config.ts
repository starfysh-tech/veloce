import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*": ["./*"]. Anchored to "@/" so scoped packages
    // like "@supabase/ssr" are left untouched.
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
});
