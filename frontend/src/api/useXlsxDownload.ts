import { useState } from "react";
import { ApiRequestError, downloadStudiesXlsx, downloadSubmission } from "./client";

const EXPORT_FAILED_MESSAGE = "Не удалось выгрузить историю.";
const SUBMISSION_FAILED_MESSAGE = "Не удалось скачать submission.";

export function useXlsxDownload() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const clearExportError = () => setExportError("");

  const run = async (
    options: { ids?: string[]; sessionId?: string },
    request: (options: { ids?: string[]; sessionId?: string }) => Promise<void>,
    fallback: string,
  ) => {
    setExporting(true);
    setExportError("");
    try {
      await request(options);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setExportError(error.message);
      } else {
        setExportError(fallback);
      }
    } finally {
      setExporting(false);
    }
  };

  const download = (options: { ids?: string[]; sessionId?: string }) =>
    run(options, downloadStudiesXlsx, EXPORT_FAILED_MESSAGE);

  const downloadSubmissionFile = (options: { ids?: string[]; sessionId?: string }) =>
    run(options, downloadSubmission, SUBMISSION_FAILED_MESSAGE);

  const report = (message: string) => {
    setExportError(message);
  };

  return {
    exporting,
    exportError,
    download,
    downloadSubmission: downloadSubmissionFile,
    report,
    clearExportError,
  };
}
