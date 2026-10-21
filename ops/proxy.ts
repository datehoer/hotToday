import { NextResponse, type NextRequest } from "next/server"

import { readSession, SESSION_COOKIE } from "@/lib/auth"

// Every page needs a login. Pages and data reads check again (requireUser), so this is the fast path.
export function proxy(req: NextRequest) {
  if (readSession(req.cookies.get(SESSION_COOKIE)?.value))
    return NextResponse.next()
  const url = req.nextUrl.clone()
  const next = url.pathname + url.search
  url.pathname = "/login"
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
}
