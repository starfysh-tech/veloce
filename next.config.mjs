import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: appDir,
  // _legacy holds the Vite POC for porting reference; keep it out of the build.
  outputFileTracingExcludes: { '*': ['./_legacy/**'] },
};
export default nextConfig;
