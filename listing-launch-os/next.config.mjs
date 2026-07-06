/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plan usage (free campaign limit) is gated on dynamically-rendered pages
  // like /campaigns/new and /dashboard. Next's client router cache would
  // otherwise reuse a stale render of these pages for up to 30s after a
  // navigation, which can show outdated usage right after creating a
  // campaign — disable that caching for dynamic routes so usage is always
  // read fresh from Supabase.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
