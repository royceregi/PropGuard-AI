import { InvestigationReportDetailUI } from "@/components/investigation-reports/InvestigationReportDetailUI";

export default async function InvestigationReportDetailPage({
  params
}: {
  params: Promise<{ queryId: string }>;
}) {
  const { queryId } = await params;

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
      <InvestigationReportDetailUI queryId={queryId} />
    </div>
  );
}
