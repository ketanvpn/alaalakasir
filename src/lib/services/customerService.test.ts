import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createCustomerDebt,
  payCustomerDebt,
  buildWhatsAppDebtReminderMessage,
} from './customerService';

describe('customerService', () => {
  beforeEach(async () => {
    await db.customers.clear();
    await db.customerDebts.clear();
    await db.debtPayments.clear();
  });

  it('creates, updates and deletes a customer safely', async () => {
    const customer = await createCustomer({
      name: 'Budi Santoso',
      phone: '08123456789',
      address: 'Jl. Merak No. 10',
    });

    expect(customer.id).toBeDefined();
    expect(customer.name).toBe('Budi Santoso');
    expect(customer.totalDebt).toBe(0);

    await updateCustomer(customer.id!, {
      name: 'Budi S.',
      notes: 'Pelanggan setia warung',
    });

    const updated = await db.customers.get(customer.id!);
    expect(updated?.name).toBe('Budi S.');
    expect(updated?.notes).toBe('Pelanggan setia warung');

    await deleteCustomer(customer.id!);
    const deleted = await db.customers.get(customer.id!);
    expect(deleted?.isDeleted).toBe(1);
  });

  it('creates debt, tracks unpaid amount, and processes installment payments', async () => {
    const customer = await createCustomer({
      name: 'Siti Aminah',
      phone: '08987654321',
    });

    const debt = await createCustomerDebt({
      customerId: customer.id!,
      amount: 150000,
      notes: 'Kasbon belanja sembako',
    });

    expect(debt.amount).toBe(150000);
    expect(debt.remainingAmount).toBe(150000);
    expect(debt.status).toBe('unpaid');

    const customerAfterDebt = await db.customers.get(customer.id!);
    expect(customerAfterDebt?.totalDebt).toBe(150000);

    // Pay installment: Rp 50.000
    const payment1 = await payCustomerDebt({
      debtId: debt.id!,
      customerId: customer.id!,
      amount: 50000,
      paymentMethodId: 1,
    });

    expect(payment1.amount).toBe(50000);

    const debtAfterPay1 = await db.customerDebts.get(debt.id!);
    expect(debtAfterPay1?.remainingAmount).toBe(100000);
    expect(debtAfterPay1?.status).toBe('partial');

    const customerAfterPay1 = await db.customers.get(customer.id!);
    expect(customerAfterPay1?.totalDebt).toBe(100000);

    // Pay full remaining: Rp 100.000
    await payCustomerDebt({
      debtId: debt.id!,
      customerId: customer.id!,
      amount: 100000,
      paymentMethodId: 1,
    });

    const debtAfterPay2 = await db.customerDebts.get(debt.id!);
    expect(debtAfterPay2?.remainingAmount).toBe(0);
    expect(debtAfterPay2?.status).toBe('paid');

    const customerAfterPay2 = await db.customers.get(customer.id!);
    expect(customerAfterPay2?.totalDebt).toBe(0);
  });

  it('prevents deleting a customer with active debt', async () => {
    const customer = await createCustomer({
      name: 'Ahmad',
      phone: '08111222333',
    });

    await createCustomerDebt({
      customerId: customer.id!,
      amount: 50000,
    });

    await expect(deleteCustomer(customer.id!)).rejects.toThrow(
      'Pelanggan masih memiliki sisa kasbon/hutang yang belum lunas'
    );
  });

  it('formats clean WhatsApp debt reminder message', () => {
    const msg = buildWhatsAppDebtReminderMessage({
      storeName: 'Toko Berkah',
      customerName: 'Pak RT',
      totalDebt: 75000,
      debts: [
        {
          id: 1,
          customerId: 1,
          amount: 75000,
          remainingAmount: 75000,
          status: 'unpaid',
          date: new Date('2025-01-10'),
          createdAt: new Date(),
          notes: 'Beras 5kg',
        },
      ],
    });

    expect(msg).toContain('Halo Kak *Pak RT*');
    expect(msg).toContain('Toko Berkah');
    expect(msg).toContain('Rp 75.000');
    expect(msg).toContain('Beras 5kg');
  });
});
