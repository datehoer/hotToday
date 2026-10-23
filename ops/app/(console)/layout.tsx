import { AppSidebar } from "@/components/ops-client"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"
import { failing, getBoard, getT, nextRound, phase, PHASE } from "@/lib/ops"

// Everything in (console) needs a login; /login lives outside it.
export default async function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()
  const t = await getT()
  const { latest, running, progress, sources } = await getBoard()
  const round = running ?? latest
  const ok = running
    ? progress.filter((r) => r.status === "ok").length
    : sources.filter((s) => s.run.status === "ok").length
  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        failing={sources.filter(failing).length}
        round={
          round && {
            label: t(
              `${t.time(round.started_at)} round`,
              `${t.time(round.started_at)} 这一轮`
            ),
            state:
              t(...PHASE[phase(round)]) +
              (running ? ` ${progress.length}/${round.sources}` : ""),
            ok,
            total: round.sources,
            next: t.time(nextRound(round)),
          }
        }
      />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
