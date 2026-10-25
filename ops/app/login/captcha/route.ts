import { NextRequest, NextResponse } from "next/server"

import {
  CAPTCHA_COOKIE,
  CAPTCHA_COOKIE_OPTIONS,
  CAPTCHA_SECONDS,
  createCaptcha,
} from "@/lib/captcha"
import { captchaImage } from "@/lib/captcha-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "?"
  const challenge = createCaptcha(
    ip,
    request.cookies.get(CAPTCHA_COOKIE)?.value
  )
  if (!challenge)
    return new NextResponse(
      "Too many verification images. Try again in five minutes.",
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(CAPTCHA_SECONDS),
        },
      }
    )

  const image = await captchaImage(challenge.answer)
  const response = new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  })
  response.cookies.set(CAPTCHA_COOKIE, challenge.token, {
    ...CAPTCHA_COOKIE_OPTIONS,
    maxAge: CAPTCHA_SECONDS,
  })
  return response
}
