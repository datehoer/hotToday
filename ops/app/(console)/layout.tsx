import { AppSidebar } from "@/components/ops-client"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"
import { getBoard, nextRound, phase } from "@/lib/ops"
import { fmtTime } from "@/lib/utils"

// Everything in (console) needs a login; /login lives outside it.
export default async function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()
  const { latest, running, progress, sources } = await getBoard()
  const round = running ?? latest
  const ok = running
    ? progress.filter((r) => r.status === "ok").length
    : sources.filter((s) => s.run.status === "ok").length
  const failing = sources.filter(
    (s) => s.run.status === "empty" || s.run.status === "error"
  ).length
  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        failing={failing}
        round={
          round && {
            label: `${fmtTime(round.started_at)} 这一轮`,
            state: running
              ? `${phase(round)} ${progress.length}/${round.sources}`
              : phase(round),
            ok,
            total: round.sources,
            next: fmtTime(nextRound(round)),
          }
        }
      />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
