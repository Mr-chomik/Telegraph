import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import type { NextConfig } from "next";

// Load root workspace .env so server env (DB URL, secrets) is available here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@fun/core", "@fun/db"],
  images: {
    // Telegram-hosted media is referenced by absolute https URLs.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;