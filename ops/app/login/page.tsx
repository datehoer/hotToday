import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/ops-client"
import { getUser } from "@/lib/auth"

export const metadata: Metadata = { title: "登录" }

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (await getUser()) redirect("/")
  const { next = "/" } = await searchParams
  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar p-4">
      <LoginForm next={next} />
    </main>
  )
}
