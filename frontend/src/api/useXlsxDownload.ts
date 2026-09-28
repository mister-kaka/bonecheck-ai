import { useState } from "react";
import { ApiRequestError, downloadStudiesXlsx } from "./client";

const EXPORT_FAILED_MESSAGE = "Не удалось выгрузить XLSX.";

export function useXlsxDownload() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const clearExportError = () => setExportError("");

  const download = async (options: { ids?: string[]; sessionId?: string }) => {
    setExporting(true);
    setExportError("");
    try {
      await downloadStudiesXlsx(options);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setExportError(error.message);
      } else {
        setExportError(EXPORT_FAILED_MESSAGE);
      }
    } finally {
      setExporting(false);
    }
  };

  const report = (message: string) => {
    setExportError(message);
  };

  return { exporting, exportError, download, report, clearExportError };
}
