/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optionally also ignore TypeScript errors during build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
