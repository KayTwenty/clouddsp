import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// The commit this build came from, shown in the footer. Vercel provides it at
// build time; locally it comes from git.
function gitCommit() {
  // COMMIT_SHA is for Docker builds, which don't include the .git folder.
  const provided = process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  if (provided) return provided;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const repo =
  process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : "";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The Docker image sets this to ship a self-contained server.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_COMMIT_SHA: gitCommit(),
    // Only set for GitHub-connected Vercel builds; used to link the commit.
    NEXT_PUBLIC_COMMIT_REPO: process.env.VERCEL_GIT_PROVIDER === "github" ? repo : "",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
