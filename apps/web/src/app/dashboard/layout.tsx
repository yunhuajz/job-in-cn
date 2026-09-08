import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";
import { ActivityProvider } from "@/context/ActivityContext";
import { GlobalActivityBanner } from "@/components/activities/GlobalActivityBanner";
import LocalNav from "@/components/local/LocalNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.JBCN_LOCAL === "1") return <div className="min-h-screen bg-muted/30 [--primary:166_65%_28%] [--primary-foreground:0_0%_100%]"><LocalNav /><main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main><Toaster /></div>;
  return (
    <ActivityProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <Sidebar />
        <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <Header />
          <GlobalActivityBanner />
          <main className="flex-1 md:block lg:grid items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-4 lg:grid-cols-3 xl:grid-cols-3">
            {children}
          </main>
          <Toaster />
        </div>
      </div>
    </ActivityProvider>
  );
}
