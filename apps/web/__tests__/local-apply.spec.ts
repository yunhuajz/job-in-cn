import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeApprovedGreeting } from "@/lib/boss/apply";
import prisma from "@/lib/db";

vi.mock("@/lib/db", () => ({
  default: {
    job: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    jobStatus: {
      findUnique: vi.fn(),
    },
  },
}));

describe("executeApprovedGreeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当未明确确认本批自动投递时拒绝执行 (人闸强制拦截)", async () => {
    const mockIo = {
      openJobPage: vi.fn(),
      readPageSignals: vi.fn(),
      clickChatButton: vi.fn(),
      verifyChatOpened: vi.fn(),
      markSent: vi.fn(),
      sleep: vi.fn(),
      now: vi.fn(() => new Date("2026-09-12T10:00:00")),
    };

    await expect(
      executeApprovedGreeting(
        {
          ids: ["00000000-0000-0000-0000-000000000001"],
          confirmed: false,
          io: mockIo,
        },
        "user-1",
      ),
    ).rejects.toThrow("请先明确确认本批自动投递");

    expect(mockIo.openJobPage).not.toHaveBeenCalled();
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });

  it("当没有匹配的未投递岗位时抛出错误", async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([]);

    await expect(
      executeApprovedGreeting(
        {
          ids: ["00000000-0000-0000-0000-000000000001"],
          confirmed: true,
        },
        "user-1",
      ),
    ).rejects.toThrow("没有可投递的未投递岗位");
  });

  it("当存在非 Boss 渠道的岗位时抛出错误", async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        jobUrl: "https://example.com/job/1",
        JobTitle: { label: "开发" },
        Company: { label: "某公司" },
        JobSource: { label: "智联招聘" },
      } as any,
    ]);

    await expect(
      executeApprovedGreeting(
        {
          ids: ["job-1"],
          confirmed: true,
        },
        "user-1",
      ),
    ).rejects.toThrow("当前自动投递仅支持 Boss 直聘岗位");
  });

  it("当存在缺少招聘链接的岗位时抛出错误", async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        jobUrl: null,
        JobTitle: { label: "开发" },
        Company: { label: "某公司" },
        JobSource: { label: "Boss直聘" },
      } as any,
    ]);

    await expect(
      executeApprovedGreeting(
        {
          ids: ["job-1"],
          confirmed: true,
        },
        "user-1",
      ),
    ).rejects.toThrow("存在缺少原招聘链接的岗位");
  });

  it("当数据库缺少 applied 状态时抛出错误", async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        jobUrl: "https://www.zhipin.com/job/1.html",
        JobTitle: { label: "开发" },
        Company: { label: "某公司" },
        JobSource: { label: "Boss直聘" },
      } as any,
    ]);
    vi.mocked(prisma.jobStatus.findUnique).mockResolvedValueOnce(null);

    await expect(
      executeApprovedGreeting(
        {
          ids: ["job-1"],
          confirmed: true,
        },
        "user-1",
      ),
    ).rejects.toThrow("缺少“投递过”岗位进度");
  });

  it("成功打招呼后自动推进岗位状态为 applied 并记录时间", async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        jobUrl: "https://www.zhipin.com/job/1.html",
        JobTitle: { label: "开发" },
        Company: { label: "某公司" },
        JobSource: { label: "Boss直聘" },
      } as any,
    ]);
    vi.mocked(prisma.jobStatus.findUnique).mockResolvedValueOnce({ id: "status-applied-id" } as any);
    vi.mocked(prisma.job.updateMany).mockResolvedValueOnce({ count: 1 });

    const mockIo = {
      openJobPage: vi.fn(),
      readPageSignals: vi.fn(async () => "职位描述 立即沟通"),
      clickChatButton: vi.fn(async () => "clicked" as const),
      verifyChatOpened: vi.fn(async () => true),
      markSent: vi.fn(async () => {}),
      sleep: vi.fn(),
      now: vi.fn(() => new Date("2026-09-12T10:00:00")),
    };

    const report = await executeApprovedGreeting(
      {
        ids: ["job-1"],
        confirmed: true,
        io: mockIo,
      },
      "user-1",
    );

    expect(report.sent).toBe(1);
    expect(report.stoppedBy).toBe("completed");
    expect(report.results[0].outcome).toBe("sent");

    expect(prisma.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: {
        statusId: "status-applied-id",
        applied: true,
        appliedDate: expect.any(Date),
        greetingSentAt: expect.any(Date),
      },
    });
  });

  it("遇到风控信号时立即熔断，未打招呼的岗位保持不动", async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        jobUrl: "https://www.zhipin.com/job/1.html",
        JobTitle: { label: "开发 1" },
        Company: { label: "公司 1" },
        JobSource: { label: "Boss直聘" },
      } as any,
      {
        id: "job-2",
        jobUrl: "https://www.zhipin.com/job/2.html",
        JobTitle: { label: "开发 2" },
        Company: { label: "公司 2" },
        JobSource: { label: "Boss直聘" },
      } as any,
    ]);
    vi.mocked(prisma.jobStatus.findUnique).mockResolvedValueOnce({ id: "status-applied-id" } as any);

    const mockIo = {
      openJobPage: vi.fn(),
      readPageSignals: vi.fn(async () => "请完成安全验证 拖动下方滑块"),
      clickChatButton: vi.fn(),
      verifyChatOpened: vi.fn(),
      markSent: vi.fn(),
      sleep: vi.fn(),
      now: vi.fn(() => new Date("2026-09-12T10:00:00")),
    };

    const report = await executeApprovedGreeting(
      {
        ids: ["job-1", "job-2"],
        confirmed: true,
        io: mockIo,
      },
      "user-1",
    );

    expect(report.stoppedBy).toBe("risk-control");
    expect(report.sent).toBe(0);
    expect(prisma.job.updateMany).not.toHaveBeenCalled();
    expect(mockIo.openJobPage).toHaveBeenCalledTimes(1);
  });
});
