import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensure transpilePackages if needed for modern Web3/GSAP libs
  transpilePackages: ["gsap", "@gsap/react", "framer-motion", "lucide-react"],
};

export default nextConfig;
