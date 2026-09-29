import { TransactionDetailsUI } from "@/components/transactions/TransactionDetailsUI";

export default async function TransactionDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
      <TransactionDetailsUI transactionId={id} />
    </div>
  );
}
