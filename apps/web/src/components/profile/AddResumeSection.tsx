"use client";
import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import AddContactInfo from "./AddContactInfo";
import { forwardRef, useImperativeHandle, useState } from "react";
import {
  ContactInfo,
  Resume,
  ResumeSection,
  SectionType,
} from "@/models/profile.model";
import AddResumeSummary from "./AddResumeSummary";
import AddExperience from "./AddExperience";
import AddEducation from "./AddEducation";
import AddCertification from "./AddCertification";
import AddSkills from "./AddSkills";

interface AddResumeSectionProps {
  resume: Resume;
}

export interface AddResumeSectionRef {
  openContactInfoDialog: (c: ContactInfo) => void;
  openSummaryDialog: (s: ResumeSection) => void;
  openExperienceDialog: (s: ResumeSection) => void;
  openEducationDialog: (s: ResumeSection) => void;
  openCertificationDialog: (s: ResumeSection) => void;
  openSkillsDialog: (s: ResumeSection) => void;
}

const AddResumeSection = forwardRef<AddResumeSectionRef, AddResumeSectionProps>(
  ({ resume }, ref) => {
    const [contactInfoDialogOpen, setContactInfoDialogOpen] = useState(false);
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
    const [experienceDialogOpen, setExperienceDialogOpen] = useState(false);
    const [educationDialogOpen, setEducationDialogOpen] = useState(false);
    const [certificationDialogOpen, setCertificationDialogOpen] =
      useState(false);
    const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
    const [contactInfoToEdit, setContactInfoToEdit] =
      useState<ContactInfo | null>(null);
    const [summaryToEdit, setSummaryToEdit] = useState<ResumeSection | null>(
      null,
    );
    const [experienceToEdit, setExperienceToEdit] =
      useState<ResumeSection | null>(null);
    const [educationToEdit, setEducationToEdit] =
      useState<ResumeSection | null>(null);
    const [certificationToEdit, setCertificationToEdit] =
      useState<ResumeSection | null>(null);
    const [skillsToEdit, setSkillsToEdit] = useState<ResumeSection | null>(
      null,
    );
    useImperativeHandle(ref, () => ({
      openContactInfoDialog(contactInfo: ContactInfo) {
        setContactInfoDialogOpen(true);
        setContactInfoToEdit({ ...contactInfo });
      },
      openSummaryDialog(summarySection: ResumeSection) {
        setSummaryDialogOpen(true);
        setSummaryToEdit({ ...summarySection });
      },
      openExperienceDialog(experienceSection: ResumeSection) {
        setExperienceDialogOpen(true);
        setExperienceToEdit({ ...experienceSection });
      },
      openEducationDialog(educationSection: ResumeSection) {
        setEducationDialogOpen(true);
        setEducationToEdit({ ...educationSection });
      },
      openCertificationDialog(certificationSection: ResumeSection) {
        setCertificationDialogOpen(true);
        setCertificationToEdit({ ...certificationSection });
      },
      openSkillsDialog(skillsSection: ResumeSection) {
        setSkillsDialogOpen(true);
        setSkillsToEdit({ ...skillsSection });
      },
    }));
    const summarySection = resume?.ResumeSections?.find(
      (section) => section.sectionType === SectionType.SUMMARY,
    );
    const experienceSection = resume?.ResumeSections?.find(
      (section) => section.sectionType === SectionType.EXPERIENCE,
    );
    const educationSection = resume?.ResumeSections?.find(
      (section) => section.sectionType === SectionType.EDUCATION,
    );
    const certificationSection = resume?.ResumeSections?.find(
      (section) => section.sectionType === SectionType.CERTIFICATION,
    );
    const skillsSection = resume?.ResumeSections?.find(
      (section) => section.sectionType === SectionType.SKILLS,
    );
    const resetExperienceToEdit = () => {
      setExperienceToEdit(null);
    };
    const resetEducationToEdit = () => {
      setEducationToEdit(null);
    };
    const resetCertificationToEdit = () => {
      setCertificationToEdit(null);
    };
    const openContactInfoDialog = () => setContactInfoDialogOpen(true);
    const openSummaryDialog = () => setSummaryDialogOpen(true);
    const openExperienceDialog = () => {
      if (experienceToEdit) {
        resetExperienceToEdit();
      }
      setExperienceDialogOpen(true);
    };
    const openEducationDialog = () => {
      if (educationToEdit) {
        resetEducationToEdit();
      }
      setEducationDialogOpen(true);
    };
    const openCertificationDialog = () => {
      if (certificationToEdit) {
        resetCertificationToEdit();
      }
      setCertificationDialogOpen(true);
    };
    const openSkillsDialog = () => {
      setSkillsToEdit(null);
      setSkillsDialogOpen(true);
    };
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                添加内容
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={openContactInfoDialog}
                disabled={!!resume?.ContactInfo}
              >
                联系方式
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={openSummaryDialog}
                disabled={!!summarySection}
              >
                个人简介
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={openSkillsDialog}
                disabled={!!skillsSection}
              >
                技能
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={openExperienceDialog}
              >
                工作经历
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={openEducationDialog}
              >
                教育经历
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={openCertificationDialog}
              >
                证书／执照
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <AddContactInfo
          resumeId={resume?.id}
          dialogOpen={contactInfoDialogOpen}
          setDialogOpen={setContactInfoDialogOpen}
          contactInfoToEdit={contactInfoToEdit}
        />
        <AddResumeSummary
          resumeId={resume?.id}
          dialogOpen={summaryDialogOpen}
          setDialogOpen={setSummaryDialogOpen}
          summaryToEdit={summaryToEdit}
        />
        <AddExperience
          resumeId={resume?.id}
          sectionId={experienceSection?.id}
          dialogOpen={experienceDialogOpen}
          setDialogOpen={setExperienceDialogOpen}
          experienceToEdit={experienceToEdit!}
        />
        <AddEducation
          resumeId={resume?.id}
          sectionId={educationSection?.id}
          dialogOpen={educationDialogOpen}
          setDialogOpen={setEducationDialogOpen}
          educationToEdit={educationToEdit!}
        />
        <AddCertification
          resumeId={resume?.id}
          sectionId={certificationSection?.id}
          dialogOpen={certificationDialogOpen}
          setDialogOpen={setCertificationDialogOpen}
          certificationToEdit={certificationToEdit!}
        />
        <AddSkills
          resumeId={resume?.id}
          dialogOpen={skillsDialogOpen}
          setDialogOpen={setSkillsDialogOpen}
          skillsToEdit={skillsToEdit}
        />
      </>
    );
  },
);

AddResumeSection.displayName = "AddResumeSection";

export default AddResumeSection;
