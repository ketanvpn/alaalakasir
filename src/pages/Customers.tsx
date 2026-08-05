import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, type CustomerDebt, type DebtPayment } from '@/lib/db';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createCustomerDebt,
  payCustomerDebt,
  buildWhatsAppDebtReminderMessage,
} from '@/lib/services/customerService';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Edit2,
  Trash2,
  Clock,
  ArrowUpRight,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MoneyText } from '@/components/ui/money-text';
import { formatThousandsInput, sanitizeNumericInput } from '@/lib/number-input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function Customers() {
  const customers = useLiveQuery(() => db.customers.where('isDeleted').equals(0).toArray());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const [search, setSearch] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);

  // Modals & Drawers
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Customer Detail Drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const selectedCustomer = useMemo(() => {
    return customers?.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const customerDebts = useLiveQuery(
    () => (selectedCustomerId ? db.customerDebts.where('customerId').equals(selectedCustomerId).reverse().sortBy('date') : []),
    [selectedCustomerId]
  );

  const customerPayments = useLiveQuery(
    () => (selectedCustomerId ? db.debtPayments.where('customerId').equals(selectedCustomerId).reverse().sortBy('date') : []),
    [selectedCustomerId]
  );

  // New Debt Modal
  const [newDebtModalOpen, setNewDebtModalOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtNotes, setDebtNotes] = useState('');

  // Payment Installment Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [targetDebt, setTargetDebt] = useState<CustomerDebt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethodId, setPayMethodId] = useState<string>('');
  const [payNotes, setPayNotes] = useState('');

  // Delete Confirm Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState<Customer | null>(null);

  // Filtering
  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.address && c.address.toLowerCase().includes(search.toLowerCase()));
      const matchDebt = filterDebtOnly ? c.totalDebt > 0 : true;
      return matchSearch && matchDebt;
    });
  }, [customers, search, filterDebtOnly]);

  const totalOutstandingDebt = useMemo(() => {
    return (customers || []).reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  }, [customers]);

  const totalCustomersWithDebt = useMemo(() => {
    return (customers || []).filter(c => c.totalDebt > 0).length;
  }, [customers]);

  // Actions
  const handleOpenCreateCustomer = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!formName.trim()) {
      toast.error('Nama pelanggan wajib diisi');
      return;
    }
    try {
      if (editingCustomer?.id) {
        await updateCustomer(editingCustomer.id, {
          name: formName,
          phone: formPhone,
          address: formAddress,
          notes: formNotes,
        });
        toast.success('Data pelanggan berhasil diperbarui');
      } else {
        await createCustomer({
          name: formName,
          phone: formPhone,
          address: formAddress,
          notes: formNotes,
        });
        toast.success('Pelanggan baru berhasil ditambahkan');
      }
      setCustomerModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan pelanggan');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTargetCustomer?.id) return;
    try {
      await deleteCustomer(deleteTargetCustomer.id);
      toast.success('Pelanggan berhasil dihapus');
      setDeleteDialogOpen(false);
      if (selectedCustomerId === deleteTargetCustomer.id) {
        setSelectedCustomerId(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus pelanggan');
    }
  };

  const handleCreateManualDebt = async () => {
    if (!selectedCustomerId) return;
    const num = Number(debtAmount) || 0;
    if (num <= 0) {
      toast.error('Nominal kasbon harus lebih dari 0');
      return;
    }
    try {
      await createCustomerDebt({
        customerId: selectedCustomerId,
        amount: num,
        dueDate: debtDueDate ? new Date(debtDueDate) : undefined,
        notes: debtNotes,
      });
      toast.success('Catatan kasbon berhasil ditambahkan');
      setNewDebtModalOpen(false);
      setDebtAmount('');
      setDebtDueDate('');
      setDebtNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mencatat kasbon');
    }
  };

  const handleOpenPayDebt = (debt: CustomerDebt) => {
    setTargetDebt(debt);
    setPayAmount(debt.remainingAmount.toString());
    setPayMethodId(paymentMethods?.[0]?.id?.toString() || '');
    setPayNotes('');
    setPayModalOpen(true);
  };

  const handleConfirmPayDebt = async () => {
    if (!targetDebt?.id || !selectedCustomerId) return;
    const num = Number(payAmount) || 0;
    if (num <= 0) {
      toast.error('Nominal bayar harus lebih dari 0');
      return;
    }
    try {
      await payCustomerDebt({
        debtId: targetDebt.id,
        customerId: selectedCustomerId,
        amount: num,
        paymentMethodId: Number(payMethodId) || (paymentMethods?.[0]?.id || 1),
        notes: payNotes,
      });
      toast.success('Pembayaran kasbon berhasil dicatat!');
      setPayModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memproses pembayaran kasbon');
    }
  };

  const handleSendWhatsAppReminder = () => {
    if (!selectedCustomer) return;
    const phoneClean = selectedCustomer.phone.replace(/[^0-9]/g, '');
    let targetPhone = phoneClean;
    if (targetPhone.startsWith('0')) {
      targetPhone = '62' + targetPhone.slice(1);
    }

    const message = buildWhatsAppDebtReminderMessage({
      storeName: storeSettings?.storeName || 'Toko Kami',
      customerName: selectedCustomer.name,
      totalDebt: selectedCustomer.totalDebt,
      debts: customerDebts || [],
    });

    const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-4xl mx-auto pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/40 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground tracking-tight">Pelanggan & Kasbon</h1>
              <p className="text-[11px] text-muted-foreground">Buku piutang dan catatan hutang pelanggan</p>
            </div>
          </div>

          <Button
            onClick={handleOpenCreateCustomer}
            className="h-10 px-3.5 rounded-xl font-bold text-xs gap-1.5 shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Tambah Pelanggan
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, no. HP, atau alamat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs bg-card rounded-xl border-border/60"
            />
          </div>
          <Button
            variant={filterDebtOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterDebtOnly(prev => !prev)}
            className="h-10 text-xs font-semibold rounded-xl border-border/70 shrink-0 gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Ada Kasbon ({totalCustomersWithDebt})
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-border/70 rounded-2xl shadow-sm bg-gradient-to-br from-card to-destructive/5">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Total Kasbon Belum Lunas</p>
              <MoneyText value={totalOutstandingDebt} className="text-xl font-extrabold text-destructive tracking-tight mt-0.5" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 rounded-2xl shadow-sm bg-gradient-to-br from-card to-primary/5">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Pelanggan Tercatat</p>
              <p className="text-xl font-extrabold text-foreground tracking-tight mt-0.5">
                {customers?.length || 0} <span className="text-xs font-medium text-muted-foreground">Orang</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <div className="space-y-2.5">
        {filteredCustomers.length === 0 ? (
          <Card className="border-border/60 rounded-2xl p-8 text-center bg-card">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">Tidak Ada Pelanggan</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Tidak ada pelanggan yang cocok dengan pencarian' : 'Belum ada data pelanggan tercatat'}
            </p>
          </Card>
        ) : (
          filteredCustomers.map(customer => (
            <Card
              key={customer.id}
              onClick={() => setSelectedCustomerId(customer.id!)}
              className="border border-border/70 rounded-2xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card overflow-hidden"
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center font-bold text-sm text-foreground shrink-0">
                    {customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                      {customer.totalDebt > 0 ? (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 font-bold px-2 py-0.2">
                          Kasbon
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold px-2 py-0.2">
                          Lunas
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-primary" /> {customer.phone}
                        </span>
                      )}
                      {customer.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-muted-foreground" /> {customer.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[10px] font-medium text-muted-foreground">Sisa Kasbon</p>
                  <MoneyText
                    value={customer.totalDebt}
                    className={`text-base font-extrabold tracking-tight ${
                      customer.totalDebt > 0 ? 'text-destructive' : 'text-foreground/80'
                    }`}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer Detail Sheet / Ledger Drawer */}
      <Sheet open={Boolean(selectedCustomerId)} onOpenChange={open => !open && setSelectedCustomerId(null)}>
        <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl max-w-2xl mx-auto p-0 flex flex-col">
          {selectedCustomer && (
            <>
              <SheetHeader className="p-4 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-lg font-bold flex items-center gap-2">
                      {selectedCustomer.name}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.phone ? `Telp: ${selectedCustomer.phone}` : 'Tanpa nomor telepon'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenEditCustomer(selectedCustomer)}
                      className="h-8 w-8 rounded-lg"
                      title="Edit Data"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setDeleteTargetCustomer(selectedCustomer);
                        setDeleteDialogOpen(true);
                      }}
                      className="h-8 w-8 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                      title="Hapus Pelanggan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Total Balance Card */}
                <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Total Tagihan Kasbon Aktif</p>
                    <MoneyText value={selectedCustomer.totalDebt} className="text-2xl font-extrabold text-destructive block mt-0.5" />
                  </div>

                  <div className="flex gap-2">
                    {selectedCustomer.phone && selectedCustomer.totalDebt > 0 && (
                      <Button
                        size="sm"
                        onClick={handleSendWhatsAppReminder}
                        className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Kirim WA
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setNewDebtModalOpen(true)}
                      className="h-9 px-3 rounded-xl font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Kasbon
                    </Button>
                  </div>
                </div>

                {/* Debts Record List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Riwayat Kasbon & Tagihan
                  </h3>

                  {!customerDebts || customerDebts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground bg-muted/30 rounded-xl">
                      Belum ada catatan kasbon untuk pelanggan ini.
                    </div>
                  ) : (
                    customerDebts.map(debt => (
                      <div
                        key={debt.id}
                        className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-foreground">
                              {debt.notes || (debt.transactionId ? `Transaksi #${debt.transactionId}` : 'Kasbon Manual')}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(debt.date), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                debt.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : debt.status === 'partial'
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {debt.status === 'paid' ? 'Lunas' : debt.status === 'partial' ? 'Dicicil' : 'Belum Lunas'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                          <div>
                            <span className="text-muted-foreground text-[11px]">Total: </span>
                            <MoneyText value={debt.amount} className="font-semibold" />
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[11px]">Sisa: </span>
                            <MoneyText
                              value={debt.remainingAmount}
                              className={`font-extrabold ${debt.remainingAmount > 0 ? 'text-destructive' : 'text-emerald-600'}`}
                            />
                          </div>
                        </div>

                        {debt.remainingAmount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPayDebt(debt)}
                            className="w-full h-8 text-xs font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10 mt-1"
                          >
                            Catat Cicilan / Pelunasan
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Payments Record List */}
                {customerPayments && customerPayments.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Riwayat Pembayaran Masuk
                    </h3>
                    <div className="space-y-1.5">
                      {customerPayments.map(p => (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-foreground">
                              + <MoneyText value={p.amount} className="text-emerald-600 inline font-extrabold" />
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(p.date), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                              {p.notes ? ` • ${p.notes}` : ''}
                            </p>
                          </div>
                          <span className="text-[10px] bg-card px-2 py-1 rounded-md border border-border/60 text-muted-foreground font-semibold">
                            {paymentMethods?.find(pm => pm.id === p.paymentMethodId)?.name || 'Tunai'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Customer Modal */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">
              {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Lengkap *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Contoh: Budi Santoso / Ibu Maya"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nomor WhatsApp / HP</Label>
              <Input
                type="tel"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="Contoh: 08123456789"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Alamat</Label>
              <Input
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                placeholder="Contoh: RT 03 / RW 02 Desa Sukamaju"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan Khusus</Label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Catatan tambahan pelanggan..."
                className="text-xs rounded-xl min-h-[70px] resize-none"
              />
            </div>

            <Button
              className="w-full h-11 text-sm font-bold rounded-xl mt-2"
              onClick={handleSaveCustomer}
            >
              Simpan Pelanggan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Add Debt Modal */}
      <Dialog open={newDebtModalOpen} onOpenChange={setNewDebtModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">Catat Kasbon / Hutang Baru</DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nominal Kasbon (Rp) *</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formatThousandsInput(debtAmount)}
                onChange={e => setDebtAmount(sanitizeNumericInput(e.target.value))}
                placeholder="Contoh: 50.000"
                className="h-11 text-base text-center font-bold rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tanggal Jatuh Tempo (Opsional)</Label>
              <Input
                type="date"
                value={debtDueDate}
                onChange={e => setDebtDueDate(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Keterangan / Alasan Kasbon</Label>
              <Input
                value={debtNotes}
                onChange={e => setDebtNotes(e.target.value)}
                placeholder="Contoh: Pinjam uang / Ambil sembako"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <Button
              className="w-full h-11 text-sm font-bold rounded-xl mt-2 bg-destructive hover:bg-destructive/90"
              onClick={handleCreateManualDebt}
            >
              Catat Kasbon
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay / Installment Debt Modal */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">Pembayaran Kasbon</DialogTitle>
          </DialogHeader>

          {targetDebt && (
            <div className="space-y-3.5 mt-2">
              <div className="p-3 bg-muted/50 rounded-xl text-center">
                <p className="text-xs text-muted-foreground">Sisa Hutang Tagihan Ini</p>
                <MoneyText value={targetDebt.remainingAmount} className="text-2xl font-extrabold text-destructive" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nominal Pembayaran (Rp) *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatThousandsInput(payAmount)}
                  onChange={e => setPayAmount(sanitizeNumericInput(e.target.value))}
                  className="h-11 text-base text-center font-bold rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Metode Pembayaran</Label>
                <select
                  value={payMethodId}
                  onChange={e => setPayMethodId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-background border border-border rounded-xl font-semibold"
                >
                  {paymentMethods?.map(pm => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Catatan Pembayaran (Opsional)</Label>
                <Input
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Contoh: Cicilan ke-1 / Lunas"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <Button
                className="w-full h-11 text-sm font-bold rounded-xl mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmPayDebt}
              >
                Konfirmasi Pembayaran
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Customer Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        variant="destructive"
        title="Hapus Data Pelanggan?"
        description={`Apakah Anda yakin ingin menghapus data pelanggan "${deleteTargetCustomer?.name}"?`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        onConfirm={handleDeleteCustomer}
      />
    </div>
  );
}
