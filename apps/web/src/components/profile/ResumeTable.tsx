"use client";
import {
  FilePenLine,
  MoreVertical,
  Paperclip,
  Pencil,
  Star,
  Trash,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ProfileDocument } from "@/models/profile.model";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "../ui/button";
import { useMemo, useState } from "react";
import { toast } from "../ui/use-toast";
import { deleteResumeById, setDefaultResume } from "@/actions/profile.actions";
import { deleteCoverLetterById } from "@/actions/coverLetter.actions";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { Badge } from "../ui/badge";
import { StatusBadge } from "../StatusBadge";
import { DOCUMENT_TYPE_BADGE_COLORS } from "@/lib/badge-colors";
import {
  hasMinResumeSections,
  warnInsufficientResumeSections,
} from "@/utils/resumeSections.utils";

type DocumentTableProps = {
  documents: ProfileDocument[];
  editResume: (doc: ProfileDocument) => void;
  editCoverLetter: (doc: ProfileDocument) => void;
  reloadDocuments: () => void;
  defaultResumeId?: string | null;
};

function DocumentTable({
  documents,
  editResume,
  editCoverLetter,
  reloadDocuments,
  defaultResumeId,
}: DocumentTableProps) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ProfileDocument>();
  const [setDefaultConfirmOpen, setSetDefaultConfirmOpen] = useState(false);
  const [documentToSetDefault, setDocumentToSetDefault] =
    useState<ProfileDocument>();
  const onDeleteDocument = useMemo(
    () => (doc: ProfileDocument) => {
      if (!doc.id) return;
      setAlertOpen(true);
      setDocumentToDelete(doc);
    },
    [],
  );

  // Title of the current default, if it happens to be on a loaded page — used
  // only to enrich the confirm copy. Presence of a default is decided by
  // defaultResumeId, which is reliable regardless of pagination.
  const currentDefault = useMemo(
    () => documents.find((d) => d.type === "resume" && d.isDefault),
    [documents],
  );

  const performSetDefault = async (doc: ProfileDocument) => {
    if (!doc.id) return;
    const { success, message } = await setDefaultResume(doc.id);
    if (success) {
      toast({
        variant: "success",
        description: `“${doc.title}”已设为默认简历。`,
      });
      reloadDocuments();
    } else {
      toast({
        variant: "destructive",
        title: "错误",
        description: message,
      });
    }
  };

  const onSetDefault = (doc: ProfileDocument) => {
    if (!doc.id) return;
    if (!hasMinResumeSections(doc.sectionCount)) {
      warnInsufficientResumeSections("setting this resume as default");
      return;
    }
    // Confirm whenever a different resume already holds the default. Decided by
    // defaultResumeId (not the loaded-docs lookup) so it fires even when the
    // current default lives on a not-yet-loaded page.
    if (defaultResumeId && defaultResumeId !== doc.id) {
      setDocumentToSetDefault(doc);
      setSetDefaultConfirmOpen(true);
    } else {
      performSetDefault(doc);
    }
  };

  const deleteDocument = async (doc: ProfileDocument) => {
    if (!doc.id) return;
    if (doc.jobCount > 0) {
      const label = doc.type === "resume" ? "简历" : "求职信";
      return toast({
        variant: "destructive",
        title: "错误",
        description: `使用“${label}”的岗位数量必须为 0 才能删除。`,
      });
    }

    const { success, message } =
      doc.type === "resume"
        ? await deleteResumeById(doc.id)
        : await deleteCoverLetterById(doc.id);

    if (success) {
      const label = doc.type === "resume" ? "简历" : "求职信";
      toast({
        variant: "success",
        description: `${label}已删除`,
      });
      reloadDocuments();
    } else {
      toast({
        variant: "destructive",
        title: "错误",
        description: message,
      });
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="hidden md:table-cell">最近修改</TableHead>
            <TableHead>关联岗位</TableHead>
            <TableHead>操作</TableHead>
            <TableHead>
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const isResume = doc.type === "resume";
            return (
              <TableRow key={`${doc.type}-${doc.id}`}>
                <TableCell className="font-medium">
                  {isResume ? (
                    <Link
                      href={`/dashboard/profile/resume/${doc.id}`}
                      className="flex items-center"
                    >
                      {doc.title}
                      {doc.FileId ? (
                        <Paperclip className="h-3.5 w-3.5 ml-1" />
                      ) : null}
                      {doc.isDefault ? (
                        <Badge className="ml-2 border-transparent bg-green-600 text-white hover:bg-green-600/90">
                          默认简历
                        </Badge>
                      ) : null}
                    </Link>
                  ) : (
                    <button
                      className="text-left hover:underline"
                      onClick={() => editCoverLetter(doc)}
                    >
                      {doc.title}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={isResume ? "简历" : "求职信"}
                    color={DOCUMENT_TYPE_BADGE_COLORS[doc.type]}
                  />
                </TableCell>
                <TableCell>
                  {doc.createdAt && format(doc.createdAt, "PP")}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {doc.updatedAt && format(doc.updatedAt, "PP")}
                </TableCell>
                <TableCell>{doc.jobCount}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-haspopup="true"
                        size="icon"
                        variant="ghost"
                        data-testid="document-actions-menu-btn"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">打开操作菜单</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>操作</DropdownMenuLabel>
                      {isResume ? (
                        <>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => editResume(doc)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            修改简历标题
                          </DropdownMenuItem>
                          <Link href={`/dashboard/profile/resume/${doc.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <FilePenLine className="mr-2 h-4 w-4" />
                              查看或编辑简历
                            </DropdownMenuItem>
                          </Link>
                          {!doc.isDefault && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => onSetDefault(doc)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              设为默认简历
                            </DropdownMenuItem>
                          )}
                        </>
                      ) : (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => editCoverLetter(doc)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑求职信
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteDocument(doc)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle={
          documentToDelete?.type === "cover-letter" ? "求职信" : "简历"
        }
        open={alertOpen}
        onOpenChange={setAlertOpen}
        onDelete={() => deleteDocument(documentToDelete!)}
        alertDescription={
          documentToDelete?.isDefault
            ? "这是默认简历。删除后需要重新设置默认简历，且此操作无法撤销。"
            : undefined
        }
      />
      <DeleteAlertDialog
        pageTitle="简历"
        open={setDefaultConfirmOpen}
        onOpenChange={setSetDefaultConfirmOpen}
        onDelete={() => performSetDefault(documentToSetDefault!)}
        alertTitle="更换默认简历？"
        alertDescription={
          currentDefault
            ? `将“${documentToSetDefault?.title}”设为默认简历，并替换“${currentDefault.title}”。`
            : `将“${documentToSetDefault?.title}”设为默认简历。`
        }
        actionLabel="设为默认简历"
        actionVariant="default"
      />
    </>
  );
}

export default DocumentTable;
