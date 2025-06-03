// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
    // Server configuration
    experimental: {
      serverComponentsExternalPackages: ['ws']
    }
  };
  
  export default nextConfig;