import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ConfigStore } from "../../../../../src/crawler/store";
import { CrawlPlanRun } from "../../../../../src/crawler/plan-run";
import { collectSearchGroup } from "../../../../../src/crawler/sources";
import prisma from "@/lib/db";

export const projectRoot = process.env.JBCN_ROOT ?? path.resolve(process.cwd(), "../..");
export const configStore = new ConfigStore(path.join(projectRoot, "data", "crawler"));
const shared = globalThis as typeof globalThis & { jbcnCrawler?: CrawlPlanRun };
const localSearchGroup = (config: Parameters<typeof collectSearchGroup>[0], group: Parameters<typeof collectSearchGroup>[1], signal: AbortSignal, log: (text: string) => void) => collectSearchGroup(config, group, signal, log, async (jobUrl) => Boolean(await prisma.job.findFirst({ where: { jobUrl }, select: { id: true } })));

export const crawler = shared.jbcnCrawler ??= new CrawlPlanRun(localSearchGroup, async (signal, log) => {
  log("本组结束，等待 3 分钟后轮转下一个平台。");
  await delay(180_000, undefined, { signal });
}, (checkpoint) => configStore.saveCheckpoint(checkpoint));
