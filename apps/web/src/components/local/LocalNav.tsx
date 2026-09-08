"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LocalNav() {
  const pathname = usePathname();
  return <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-4 sm:px-6">
      <Link href="/dashboard/myjobs" className="flex items-center gap-3 py-4 text-xl font-bold tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm text-primary-foreground">J</span>JBCN</Link>
      <nav className="flex gap-1 rounded-xl bg-muted/60 p-1" aria-label="主导航">
        {[["/dashboard/myjobs", "我的岗位"], ["/dashboard/crawler", "爬虫采集"], ["/dashboard/profile", "个人资料"], ["/dashboard/settings", "AI 设置"]].map(([href, label]) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${pathname.startsWith(href) ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</Link>)}
      </nav>
      <span className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-primary" />本地工作空间</span>
    </div>
  </header>;
}
