import { fireEvent, render, screen } from "@testing-library/react";
import { DownloadFileButton } from "@/components/profile/DownloadFileButton";

describe("DownloadFileButton", () => {
  it("opens the attached resume in a new tab when its title is clicked", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      DownloadFileButton(
        "data/files/resumes/resume.pdf",
        "刘玉浩 简历",
        "resume.pdf",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "查看附件 resume.pdf" }));

    expect(open).toHaveBeenCalledWith(
      "/api/profile/resume?filePath=data%2Ffiles%2Fresumes%2Fresume.pdf&mode=preview",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("keeps a separate download action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("resume", { status: 200 })),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(DownloadFileButton("resume.pdf", "我的简历", "resume.pdf"));

    fireEvent.click(screen.getByRole("button", { name: "下载附件 resume.pdf" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
  });
});
