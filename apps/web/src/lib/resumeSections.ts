import { APP_CONSTANTS } from "@/lib/constants";

export const hasMinResumeSections = (
  sectionCount: number | null | undefined,
): boolean =>
  (sectionCount ?? 0) >= APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;

export const buildInsufficientSectionsMessage = (
  action: string,
  hint?: string,
): string => {
  const min = APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;
  if (action === "setting this resume as default") {
    return `至少添加 ${min} 个简历分区后才能设为默认简历。`;
  }
  if (action === "running a review") {
    return `至少添加 ${min} 个简历分区${
      hint ? "（例如个人简介和工作经历）" : ""
    }后才能生成 AI 评价。`;
  }
  return `至少添加 ${min} 个简历分区后再进行此操作。`;
};
