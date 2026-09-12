import prisma from "@/lib/db";
import { Resume } from "@/models/profile.model";

export const resumeDetailInclude = {
  ContactInfo: true,
  File: true,
  ResumeSections: {
    include: {
      summary: true,
      workExperiences: {
        include: {
          jobTitle: true,
          Company: true,
          location: true,
        },
      },
      educations: {
        include: {
          location: true,
        },
      },
      licenseOrCertifications: true,
      skills: { include: { Tag: true } },
    },
  },
} as const;

export async function getDefaultResumeForUser(
  userId: string,
): Promise<Resume | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultResumeId: true },
  });
  if (!user?.defaultResumeId) return null;

  const resume = await prisma.resume.findFirst({
    where: { id: user.defaultResumeId, profile: { userId } },
    include: resumeDetailInclude,
  });
  if (!resume) return null;

  return resume as unknown as Resume;
}
