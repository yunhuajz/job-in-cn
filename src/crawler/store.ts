import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crawlerConfigSchema, crawlerPlanSchema, platforms, type CrawlerConfig, type CrawlerPlan, type Platform } from './config.js';
import type { CrawlCheckpoint } from './plan-run.js';

export class ConfigStore {
  constructor(private directory: string) {}

  read(platform: Platform): CrawlerConfig {
    const file = join(this.directory, `${platform}.json`);
    if (!existsSync(file)) return crawlerConfigSchema.parse({ platform, keywords: ['AI'], cities: ['全国'] });
    return crawlerConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  }

  save(input: unknown): CrawlerConfig {
    const config = crawlerConfigSchema.parse(input);
    mkdirSync(this.directory, { recursive: true });
    const file = join(this.directory, `${config.platform}.json`);
    writeFileSync(`${file}.tmp`, JSON.stringify(config, null, 2), 'utf8');
    renameSync(`${file}.tmp`, file);
    return config;
  }

  readPlan(): CrawlerPlan {
    const file = join(this.directory, 'plan.json');
    if (!existsSync(file)) return crawlerPlanSchema.parse({ platforms, rounds: 1 });
    return crawlerPlanSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  }

  savePlan(input: unknown): CrawlerPlan {
    const plan = crawlerPlanSchema.parse(input);
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(join(this.directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    return plan;
  }

  readCheckpoint(): CrawlCheckpoint | undefined {
    const file = join(this.directory, 'checkpoint.json');
    if (!existsSync(file)) return undefined;
    const raw = JSON.parse(readFileSync(file, 'utf8')) as CrawlCheckpoint;
    return { plan: crawlerPlanSchema.parse(raw.plan), configs: raw.configs.map((config) => crawlerConfigSchema.parse(config)), next: raw.next };
  }

  saveCheckpoint(checkpoint: CrawlCheckpoint | undefined): void {
    const file = join(this.directory, 'checkpoint.json');
    if (!checkpoint) {
      if (existsSync(file)) unlinkSync(file);
      return;
    }
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(file, JSON.stringify(checkpoint, null, 2) + '\n');
  }
}
