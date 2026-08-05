import { db, type Customer, type CustomerDebt, type DebtPayment } from '@/lib/db';

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface CreateDebtInput {
  customerId: number;
  amount: number;
  dueDate?: Date;
  notes?: string;
  transactionId?: number;
}

export interface PayDebtInput {
  debtId: number;
  customerId: number;
  amount: number;
  paymentMethodId: number;
  notes?: string;
  date?: Date;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const name = input.name.trim();
  if (!name) throw new Error('Nama pelanggan wajib diisi');

  const now = new Date();
  const customer: Customer = {
    name,
    phone: input.phone.trim(),
    address: input.address?.trim(),
    notes: input.notes?.trim(),
    totalDebt: 0,
    createdAt: now,
    updatedAt: now,
    isDeleted: 0,
    deletedAt: null,
  };

  const id = await db.customers.add(customer);
  return { ...customer, id };
}

export async function updateCustomer(id: number, input: UpdateCustomerInput): Promise<void> {
  const existing = await db.customers.get(id);
  if (!existing || existing.isDeleted === 1) {
    throw new Error('Pelanggan tidak ditemukan');
  }

  const updates: Partial<Customer> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('Nama pelanggan tidak boleh kosong');
    updates.name = name;
  }
  if (input.phone !== undefined) updates.phone = input.phone.trim();
  if (input.address !== undefined) updates.address = input.address.trim();
  if (input.notes !== undefined) updates.notes = input.notes.trim();

  await db.customers.update(id, updates);
}

export async function deleteCustomer(id: number): Promise<void> {
  const customer = await db.customers.get(id);
  if (!customer) throw new Error('Pelanggan tidak ditemukan');

  if (customer.totalDebt > 0) {
    throw new Error('Pelanggan masih memiliki sisa kasbon/hutang yang belum lunas');
  }

  await db.customers.update(id, {
    isDeleted: 1,
    deletedAt: new Date(),
  });
}

export async function createCustomerDebt(input: CreateDebtInput): Promise<CustomerDebt> {
  if (input.amount <= 0) {
    throw new Error('Nominal kasbon harus lebih dari 0');
  }

  const customer = await db.customers.get(input.customerId);
  if (!customer || customer.isDeleted === 1) {
    throw new Error('Pelanggan tidak ditemukan');
  }

  const now = new Date();
  const debtRecord: CustomerDebt = {
    customerId: input.customerId,
    transactionId: input.transactionId,
    amount: input.amount,
    remainingAmount: input.amount,
    dueDate: input.dueDate,
    status: 'unpaid',
    notes: input.notes?.trim(),
    date: now,
    createdAt: now,
  };

  return await db.transaction('rw', [db.customerDebts, db.customers], async () => {
    const debtId = await db.customerDebts.add(debtRecord);
    const newTotalDebt = (customer.totalDebt || 0) + input.amount;
    await db.customers.update(input.customerId, {
      totalDebt: newTotalDebt,
      updatedAt: now,
    });
    return { ...debtRecord, id: debtId };
  });
}

export async function payCustomerDebt(input: PayDebtInput): Promise<DebtPayment> {
  if (input.amount <= 0) {
    throw new Error('Nominal pembayaran harus lebih dari 0');
  }

  return await db.transaction('rw', [db.customerDebts, db.debtPayments, db.customers], async () => {
    const debt = await db.customerDebts.get(input.debtId);
    if (!debt) throw new Error('Catatan hutang tidak ditemukan');

    if (debt.remainingAmount <= 0 || debt.status === 'paid') {
      throw new Error('Hutang ini sudah lunas');
    }

    const payAmount = Math.min(input.amount, debt.remainingAmount);
    const newRemaining = debt.remainingAmount - payAmount;
    const newStatus: 'unpaid' | 'partial' | 'paid' = newRemaining <= 0 ? 'paid' : 'partial';

    const now = input.date || new Date();
    const paymentRecord: DebtPayment = {
      debtId: input.debtId,
      customerId: input.customerId,
      amount: payAmount,
      paymentMethodId: input.paymentMethodId,
      date: now,
      notes: input.notes?.trim(),
      createdAt: now,
    };

    const paymentId = await db.debtPayments.add(paymentRecord);
    await db.customerDebts.update(input.debtId, {
      remainingAmount: newRemaining,
      status: newStatus,
    });

    const customer = await db.customers.get(input.customerId);
    if (customer) {
      const updatedTotal = Math.max(0, (customer.totalDebt || 0) - payAmount);
      await db.customers.update(input.customerId, {
        totalDebt: updatedTotal,
        updatedAt: now,
      });
    }

    return { ...paymentRecord, id: paymentId };
  });
}

export function buildWhatsAppDebtReminderMessage(params: {
  storeName: string;
  customerName: string;
  totalDebt: number;
  debts: CustomerDebt[];
}): string {
  const formattedTotal = params.totalDebt.toLocaleString('id-ID');
  let text = `Halo Kak *${params.customerName}*,\n\n`;
  text += `Ini adalah pengingat catatan kasbon/tagihan dari *${params.storeName}*.\n`;
  text += `Total tagihan saat ini: *Rp ${formattedTotal}*\n\n`;

  const unpaidDebts = params.debts.filter(d => d.remainingAmount > 0);
  if (unpaidDebts.length > 0) {
    text += `Rincian Tagihan:\n`;
    unpaidDebts.forEach((d, idx) => {
      const tgl = new Date(d.date).toLocaleDateString('id-ID');
      const sisa = d.remainingAmount.toLocaleString('id-ID');
      text += `${idx + 1}. Tgl ${tgl}: Rp ${sisa}${d.notes ? ` (${d.notes})` : ''}\n`;
    });
    text += `\n`;
  }

  text += `Terima kasih banyak atas kerjasamanya 🙏`;
  return text;
}
