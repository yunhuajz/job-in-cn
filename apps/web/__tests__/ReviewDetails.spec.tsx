import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewDetails } from "@/components/profile/ReviewDetails";
import type { ResumeReviewData } from "@/models/ai.schemas";

vi.mock("@/components/TipTapContentViewer", () => ({
  TipTapContentViewer: ({ content }: { content: string }) => (
    <div data-testid="tiptap-content" dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

const reviewData: ResumeReviewData = {
  overall: 85,
  impact: 80,
  clarity: 82,
  atsCompatibility: 78,
  body: "## Summary\nGreat resume overall",
  reviewedAt: "2026-07-01T10:30:00.000Z",
  provider: "openai",
  model: "gpt-4o",
};

describe("ReviewDetails", () => {
  it("renders nothing when reviewData is null", () => {
    const { container } = render(<ReviewDetails reviewData={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the compact score summary and metadata line", () => {
    render(<ReviewDetails reviewData={reviewData} />);
    expect(screen.getByText("综合评分 85")).toBeInTheDocument();
    expect(
      screen.getByText("影响力 80 · 清晰度 82 · ATS 78"),
    ).toBeInTheDocument();
    expect(screen.getByText(/评价时间：/)).toHaveTextContent("使用 openai / gpt-4o");
  });

  it("hides the full markdown body by default", () => {
    render(<ReviewDetails reviewData={reviewData} />);
    expect(screen.queryByTestId("tiptap-content")).not.toBeInTheDocument();
    expect(screen.getByText("查看完整评价")).toBeInTheDocument();
  });

  it("expands to reveal the full markdown body when the toggle is clicked", () => {
    render(<ReviewDetails reviewData={reviewData} />);
    fireEvent.click(screen.getByText("查看完整评价"));
    expect(screen.getByTestId("tiptap-content")).toHaveTextContent(
      "Great resume overall",
    );
    expect(screen.getByText("收起完整评价")).toBeInTheDocument();
  });
});
