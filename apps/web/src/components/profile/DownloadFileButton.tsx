import { Download, Paperclip } from "lucide-react";

export function DownloadFileButton(
  filePath: string,
  fileTitle: string,
  fileName: string,
) {
  const fileUrl = `/api/profile/resume?filePath=${encodeURIComponent(filePath)}`;

  const handlePreview = () => {
    window.open(`${fileUrl}&mode=preview`, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    const response = await fetch(fileUrl, { method: "GET" });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } else {
      console.error("下载简历附件失败");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex items-center rounded px-1 py-0.5 hover:bg-muted hover:text-primary"
        onClick={handlePreview}
        aria-label={`查看附件 ${fileName}`}
        title={`查看附件：${fileName}`}
      >
        <span>{fileTitle}</span>
        <Paperclip className="ml-1 h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={handleDownload}
        aria-label={`下载附件 ${fileName}`}
        title={`下载附件：${fileName}`}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
