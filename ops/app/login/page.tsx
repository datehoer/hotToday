import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LangSwitch, LoginForm } from "@/components/ops-client"
import { getUser } from "@/lib/auth"
import { getT } from "@/lib/ops"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("Sign in", "登录") }
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (await getUser()) redirect("/")
  const { next = "/" } = await searchParams
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-sidebar p-4">
      <LoginForm next={next} />
      <LangSwitch />
    </main>
  )
}
