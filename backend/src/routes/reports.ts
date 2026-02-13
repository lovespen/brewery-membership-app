import type { IRouter } from "express";
import { Request, Response } from "express";
import { getSalesTaxRecordsByMonth } from "../stores/salesTaxRecords";
import { getTaxRateById } from "./config";

export function registerReportRoutes(router: IRouter) {
  // GET /api/reports/sales-tax?month=YYYY-MM - monthly sales tax summary for reporting
  router.get("/reports/sales-tax", (req: Request, res: Response) => {
    const month = (req.query.month as string) || "";
    const match = /^\d{4}-\d{2}$/.exec(month);
    if (!match) {
      return res.status(400).json({ error: "Query month is required and must be YYYY-MM" });
    }
    const records = getSalesTaxRecordsByMonth(month);
    const byRateId: Record<string, { totalTaxCents: number; transactionCount: number }> = {};
    for (const rec of records) {
      for (const [taxRateId, cents] of Object.entries(rec.taxBreakdown)) {
        if (cents <= 0) continue;
        if (!byRateId[taxRateId]) byRateId[taxRateId] = { totalTaxCents: 0, transactionCount: 0 };
        byRateId[taxRateId].totalTaxCents += cents;
        byRateId[taxRateId].transactionCount += 1;
      }
    }
    const taxRatesList = Object.entries(byRateId).map(([taxRateId, agg]) => {
      const rate = getTaxRateById(taxRateId);
      return {
        taxRateId,
        taxRateName: rate?.name ?? taxRateId,
        ratePercent: rate?.ratePercent ?? 0,
        totalTaxCents: agg.totalTaxCents,
        transactionCount: agg.transactionCount
      };
    });
    const totalTaxCents = taxRatesList.reduce((s, r) => s + r.totalTaxCents, 0);
    res.json({
      month,
      byTaxRate: taxRatesList,
      totalTaxCents,
      transactionCount: records.length
    });
  });
}
