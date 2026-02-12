/** Single recorded sale: tax collected per rate (from Stripe webhook). */
export type SalesTaxRecord = {
  date: string; // YYYY-MM-DD
  paymentIntentId: string;
  taxBreakdown: Record<string, number>; // taxRateId -> cents
};

const records: SalesTaxRecord[] = [];

export function addSalesTaxRecord(record: SalesTaxRecord): void {
  records.push(record);
}

export function getSalesTaxRecordsByMonth(month: string): SalesTaxRecord[] {
  return records.filter((r) => r.date.startsWith(month));
}
