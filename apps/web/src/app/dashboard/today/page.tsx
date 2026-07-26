import { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "今日汇总 | JobSync",
};

// design.md §5:当日新入库 + 昨日遗留;推荐(≥4.0)/普通(3.0–3.9)分组;<3.0 不显示

const RECOMMENDED_MIN = 80; // 4.0 × 20
const NORMAL_MIN = 60; // 3.0 × 20

interface TodayRow {
  id: string;
  title: string;
  company: string;
  city: string | null;
  salary: string | null;
  matchScore: number | null;
  weekendRestStatus: string;
  summary: string | null;
  jobUrl: string | null;
}

function extractSummary(matchData: string | null): string | null {
  if (!matchData) return null;
  try {
    const parsed = JSON.parse(matchData) as { summary?: string };
    return parsed.summary ?? null;
  } catch {
    return null;
  }
}

function WeekendMark({ status }: { status: string }) {
  if (status === "yes") return <span title="双休已确认">✓</span>;
  if (status === "no") return <span title="非双休">✗</span>;
  if (status === "pending") return <span title="待确认">?</span>;
  return <span title="未涉及">—</span>;
}

function GroupTable({ rows }: { rows: TodayRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">评分</TableHead>
          <TableHead>职位</TableHead>
          <TableHead>公司</TableHead>
          <TableHead>城市</TableHead>
          <TableHead>薪资</TableHead>
          <TableHead className="w-12">双休</TableHead>
          <TableHead>摘要</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              {row.matchScore != null ? (row.matchScore / 20).toFixed(1) : "—"}
            </TableCell>
            <TableCell>
              {row.jobUrl ? (
                <a
                  href={row.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {row.title}
                </a>
              ) : (
                row.title
              )}
            </TableCell>
            <TableCell>{row.company}</TableCell>
            <TableCell>{row.city ?? "—"}</TableCell>
            <TableCell>{row.salary ?? "面议"}</TableCell>
            <TableCell>
              <WeekendMark status={row.weekendRestStatus} />
            </TableCell>
            <TableCell className="max-w-64 truncate" title={row.summary ?? ""}>
              {row.summary ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Group({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: TodayRow[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title}({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <GroupTable rows={rows} />
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const jobs = await prisma.job.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: startOfYesterday },
    },
    select: {
      id: true,
      createdAt: true,
      matchScore: true,
      matchData: true,
      salaryRange: true,
      jobUrl: true,
      weekendRestStatus: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      Location: { select: { label: true } },
    },
  });

  const rows: TodayRow[] = jobs.map((job) => ({
    id: job.id,
    title: job.JobTitle.label,
    company: job.Company.label,
    city: job.Location?.label ?? null,
    salary: job.salaryRange,
    matchScore: job.matchScore,
    weekendRestStatus: job.weekendRestStatus,
    summary: extractSummary(job.matchData),
    jobUrl: job.jobUrl,
  }));

  const todayCount = jobs.filter((j) => j.createdAt >= startOfToday).length;
  const byScoreDesc = (a: TodayRow, b: TodayRow) =>
    (b.matchScore ?? -1) - (a.matchScore ?? -1);
  const recommended = rows
    .filter((r) => r.matchScore != null && r.matchScore >= RECOMMENDED_MIN)
    .sort(byScoreDesc);
  const normal = rows
    .filter(
      (r) =>
        r.matchScore != null &&
        r.matchScore >= NORMAL_MIN &&
        r.matchScore < RECOMMENDED_MIN,
    )
    .sort(byScoreDesc);
  const unscored = rows.filter((r) => r.matchScore == null);

  return (
    <div className="col-span-3 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">今日汇总</h1>
        <p className="text-sm text-muted-foreground">
          今日收取 {todayCount} 个 · 含昨日遗留共 {rows.length} 个 · 低于 3.0
          分的不在此显示(看板可查)
        </p>
      </div>
      <Group
        title="推荐(≥4.0)"
        rows={recommended}
        empty="暂无推荐职位。"
      />
      <Group
        title="普通(3.0–3.9)"
        rows={normal}
        empty="暂无普通职位。"
      />
      <Group
        title="待评分"
        rows={unscored}
        empty="没有待评分职位。"
      />
    </div>
  );
}

export default TodayPage;
