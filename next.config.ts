import type {NextConfig} from 'next';

// Base path for GitHub Pages project-site deployment:
// https://pdfly-source.github.io/cineflow/
const BASE_PATH = '/cineflow';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // GitHub Pages serves static files only — export a fully static site.
  output: 'export',
  basePath: BASE_PATH,
  trailingSlash: true,
  // Exposed to client code (e.g. service-worker registration path).
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  // Static export cannot use the Next.js image optimization server.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
