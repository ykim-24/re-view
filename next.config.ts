import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root — there are other lockfiles higher up in $HOME.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Native module: keep it external so it isn't bundled by the server build.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
