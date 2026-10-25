import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["svg-captcha"],
  outputFileTracingIncludes: {
    "/login/captcha": ["./lib/fonts/Geist-Regular.ttf", "./lib/fonts/OFL.txt"],
  },
}

export default nextConfig
