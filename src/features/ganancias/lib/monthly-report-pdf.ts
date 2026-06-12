import React from "react";
import type { MonthlyReportData } from "../components/monthly-report-document";

async function buildBlob(data: MonthlyReportData): Promise<Blob> {
  const [{ pdf }, { MonthlyReportDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/ganancias/components/monthly-report-document"),
  ]);

  return (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(MonthlyReportDocument, data),
  ).toBlob();
}

export async function downloadMonthlyReport(data: MonthlyReportData): Promise<void> {
  const blob = await buildBlob(data);
  const [y, m] = data.periodYm.split("-");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Reporte_${m}_${y}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareMonthlyReport(data: MonthlyReportData): Promise<void> {
  const blob = await buildBlob(data);
  const [y, m] = data.periodYm.split("-");
  const filename = `Reporte_${m}_${y}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: `Balance mensual ${data.periodLabel}`,
    });
  } else {
    await downloadMonthlyReport(data);
  }
}
