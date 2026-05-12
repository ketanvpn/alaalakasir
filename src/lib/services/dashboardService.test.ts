import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db-test-utils";
import {
  calculateSalesDeltaPercent,
  getCompletedTransactionsBetween,
  getRecentCompletedTransactions,
} from "./dashboardService";

function at(hour: number, minute = 0) {
  const date = new Date("2026-05-12T00:00:00.000Z");
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

async function seedTransaction(params: {
  date: Date;
  total: number;
  status: "open" | "completed";
  receiptNumber: string;
}) {
  return db.transactions.add({
    subtotal: params.total,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    total: params.total,
    paymentMethodId: 1,
    paymentAmount: params.total,
    change: 0,
    profit: Math.round(params.total * 0.3),
    date: params.date,
    receiptNumber: params.receiptNumber,
    status: params.status,
  });
}

describe("dashboardService", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns only completed transactions inside date range", async () => {
    const todayStart = at(0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    await seedTransaction({ date: at(1), total: 10000, status: "completed", receiptNumber: "C-1" });
    await seedTransaction({ date: at(2), total: 12000, status: "open", receiptNumber: "O-1" });
    await seedTransaction({ date: at(3), total: 15000, status: "completed", receiptNumber: "C-2" });

    const result = await getCompletedTransactionsBetween(todayStart, tomorrowStart);

    expect(result).toHaveLength(2);
    expect(result.every((tx) => tx.status === "completed")).toBe(true);
    expect(result.map((tx) => tx.receiptNumber).sort()).toEqual(["C-1", "C-2"]);
  });

  it("returns at most 5 recent completed transactions in descending date order", async () => {
    for (let i = 0; i < 7; i++) {
      await seedTransaction({
        date: at(i),
        total: 10000 + i,
        status: i === 5 ? "open" : "completed",
        receiptNumber: `TX-${i}`,
      });
    }

    const result = await getRecentCompletedTransactions(5);

    expect(result).toHaveLength(5);
    expect(result.every((tx) => tx.status === "completed")).toBe(true);
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i - 1].date).getTime()).toBeGreaterThanOrEqual(new Date(result[i].date).getTime());
    }
  });

  it("calculates sales delta percent against yesterday correctly", () => {
    expect(calculateSalesDeltaPercent(200000, 100000)).toBe(100);
    expect(calculateSalesDeltaPercent(80000, 100000)).toBe(-20);
    expect(calculateSalesDeltaPercent(50000, 0)).toBe(100);
    expect(calculateSalesDeltaPercent(0, 0)).toBe(0);
  });
});
