/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.financialmodelingprep.com' }] },
  /*
   * Next streams metadata into <body> for browsers it does not class as bots.
   * iOS only reads the manifest link and apple-mobile-web-app tags from
   * <head>, so a streamed page added to the home screen opened in Safari's
   * chrome instead of full screen. Treating every agent as "limited" keeps all
   * metadata in <head>; it is static here, so nothing is lost by not streaming.
   */
  htmlLimitedBots: /.*/,
  // Baked into the client so an open app can notice a newer deployment.
  env: { NEXT_PUBLIC_BUILD_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
};
export default nextConfig;
