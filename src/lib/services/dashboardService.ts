import { db, type Transaction } from "@/lib/db";

export const MIN_DATE = new Date(0);
export const MAX_DATE = new Date(8640000000000000);

export async function getCompletedTransactionsBetween(from: Date, to: Date) {
  return db.transactions
    .where("[status+date]")
    .between(["completed", from], ["completed", to], true, false)
    .toArray();
}

export async function getRecentCompletedTransactions(limit = 5): Promise<Transaction[]> {
  return db.transactions
    .where("[status+date]")
    .between(["completed", MIN_DATE], ["completed", MAX_DATE], true, true)
    .reverse()
    .limit(limit)
    .toArray();
}

export function calculateSalesDeltaPercent(totalSales: number, yesterdaySales: number) {
  if (yesterdaySales > 0) {
    return Math.round(((totalSales - yesterdaySales) / yesterdaySales) * 100);
  }
  return totalSales > 0 ? 100 : 0;
}
