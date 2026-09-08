import CrawlerPanel from "@/components/local/CrawlerPanel";
import { notFound } from "next/navigation";

export const metadata = { title: "爬虫" };
export default function CrawlerPage() {
  if (process.env.JBCN_LOCAL !== "1") notFound();
  return <CrawlerPanel />;
}
