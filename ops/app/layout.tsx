import type { Metadata } from "next"
import { Geist_Mono, Raleway } from "next/font/google"

import "./globals.css"
import { LangProvider } from "@/components/ops-client"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getT } from "@/lib/ops"
import { cn } from "@/lib/utils"

const fontSans = Raleway({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  const site = t("hotToday crawler ops", "hotToday 爬虫运维")
  return {
    title: { default: site, template: `%s · ${site}` },
    robots: { index: false, follow: false },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getT()
  return (
    <html
      lang={t("en", "zh-CN")}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        <LangProvider lang={t.lang}>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </LangProvider>
      </body>
    </html>
  )
}
