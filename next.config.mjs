/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // _legacy holds the Vite POC for porting reference; keep it out of the build.
  outputFileTracingExcludes: { '*': ['./_legacy/**'] },
};
export default nextConfig;
