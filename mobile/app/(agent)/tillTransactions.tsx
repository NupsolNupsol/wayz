// app/(agent)/till/transactions.tsx
import { router } from "expo-router";
import { useState, useMemo } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";

// import { AppHeader } from "@/components/AppHeader";
import { Icon, type IconName } from "@/components/Icon";
import {
  Amount,
  Body,
  Card,
  EmptyState,
  Label,
  Loading,
  Muted,
  Screen,
  Section,
} from "@/components/ui";
import { useTillTransactions, useRefundPayment } from "@/hooks/queries";
import { COLORS } from "@/theme/tokens";
import { formatDate, formatTime, money } from "@/lib/format";
import type { TillTransaction } from "@/api/endpoints";

type KindFilter = "ALL" | "SALE" | "DEPOSIT" | "REFUND" | "OVERTIME";
type MethodFilter = "ALL" | "CASH" | "CARD";
type StatusFilter = "ALL" | "CAPTURED" | "REFUNDED" | "PENDING";

export default function TillTransactions() {
  const transactions = useTillTransactions();
  const refund = useRefundPayment();

  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const [refunding, setRefunding] = useState<TillTransaction | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const stats = useMemo(() => {
    const rows = transactions.data ?? [];
    const sales = rows.filter((r) => r.kind !== "REFUND");
    const refunds = rows.filter((r) => r.kind === "REFUND");
    const sum = (list: TillTransaction[]) =>
      list.reduce((t, r) => t + r.amount, 0);

    return {
      total: rows.length,
      cash: sum(sales.filter((r) => r.method === "CASH")),
      card: sum(sales.filter((r) => r.method !== "CASH")),
      refunded: sum(refunds),
    };
  }, [transactions.data]);

  const rows = useMemo(() => {
    let list = [...(transactions.data ?? [])];
    if (kindFilter !== "ALL") list = list.filter((r) => r.kind === kindFilter);
    if (methodFilter !== "ALL")
      list = list.filter((r) => r.method === methodFilter);
    if (statusFilter !== "ALL")
      list = list.filter((r) => r.status === statusFilter);

    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions.data, kindFilter, methodFilter, statusFilter]);

  const openRefund = (row: TillTransaction) => {
    setRefunding(row);
    setAmount(String(row.amount));
    setReason("");
  };

  const submitRefund = () => {
    if (!refunding) return;
    const amt = Number(amount || 0);
    refund.mutate(
      { paymentId: refunding._id, amount: amt, reason: reason.trim() },
      {
        onSuccess: () => setRefunding(null),
        onError: (e: any) =>
          console.error("Refund error:", e?.message || e),
      }
    );
  };

  if (transactions.isLoading && !transactions.data) {
    return (
      <Screen testID="till-transactions">
        {/* <AppHeader title="Transactions" showBack /> */}
        <Loading label="Loading transactions…" />
      </Screen>
    );
  }

  const hasFilters =
    kindFilter !== "ALL" || methodFilter !== "ALL" || statusFilter !== "ALL";

  return (
    <Screen testID="till-transactions">
      {/* <AppHeader
        title="Transactions"
        subtitle="Every payment taken at this till"
        showBack
        actions={
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowFilters(true)}
              className={`h-10 w-10 items-center justify-center rounded-2xl border bg-surface active:bg-canvas ${
                hasFilters ? "border-brand" : "border-line"
              }`}
              testID="tx-filters"
            >
              <Icon name="Filter" size={18} color={COLORS.navy} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => transactions.refetch()}
              className="h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas"
              testID="tx-refresh"
            >
              <Icon name="RefreshCw" size={18} color={COLORS.navy} />
            </Pressable>
          </View>
        }
      /> */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={transactions.isFetching}
            onRefresh={() => transactions.refetch()}
            tintColor={COLORS.brand}
          />
        }
      >
        <View className="mb-5 px-4">
          <View className="mb-3 flex-row gap-3">
            <Stat
              label="TOTAL"
              value={String(stats.total)}
              icon="Receipt"
              tone="neutral"
              testID="tx-stat-count"
            />
            <Stat
              label="CASH"
              value={money(stats.cash)}
              icon="CircleDollarSign"
              tone="info"
              testID="tx-stat-cash"
            />
          </View>
          <View className="flex-row gap-3">
            <Stat
              label="CARD"
              value={money(stats.card)}
              icon="CreditCard"
              tone="info"
              testID="tx-stat-card"
            />
            <Stat
              label="REFUNDED"
              value={money(stats.refunded)}
              icon="Undo2"
              tone={stats.refunded > 0 ? "warning" : "neutral"}
              testID="tx-stat-refunded"
            />
          </View>
        </View>

        {hasFilters && (
          <View className="mb-3 flex-row flex-wrap gap-2 px-4">
            {kindFilter !== "ALL" && (
              <FilterChip
                label={kindFilter}
                onClear={() => setKindFilter("ALL")}
              />
            )}
            {methodFilter !== "ALL" && (
              <FilterChip
                label={methodFilter}
                onClear={() => setMethodFilter("ALL")}
              />
            )}
            {statusFilter !== "ALL" && (
              <FilterChip
                label={statusFilter}
                onClear={() => setStatusFilter("ALL")}
              />
            )}
          </View>
        )}

        <Section title={`Transactions (${rows.length})`} className="px-4">
          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Icon name="Receipt" size={24} color={COLORS.faint} />}
                title="No transactions"
                message={
                  hasFilters
                    ? "No transactions match your filters."
                    : "Payments you take will appear here."
                }
                testID="tx-empty"
              />
            </Card>
          ) : (
            <View>
              {rows.map((row, index) => (
                <View key={row._id}>
                  {index > 0 && <View className="h-2" />}
                  <TransactionCard
                    transaction={row}
                    onRefund={() => openRefund(row)}
                  />
                </View>
              ))}
            </View>
          )}
        </Section>

        <View className="h-8" />
      </ScrollView>

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-3xl bg-surface p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Body className="text-lg font-semibold">Filters</Body>
              <Pressable onPress={() => setShowFilters(false)}>
                <Icon name="X" size={22} color={COLORS.navy} />
              </Pressable>
            </View>

            <ScrollView>
              <Body className="mb-2 font-semibold">Type</Body>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {(
                  ["ALL", "SALE", "DEPOSIT", "REFUND", "OVERTIME"] as KindFilter[]
                ).map((k) => (
                  <Chip
                    key={k}
                    label={k}
                    active={kindFilter === k}
                    onPress={() => setKindFilter(k)}
                  />
                ))}
              </View>

              <Body className="mb-2 font-semibold">Method</Body>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {(["ALL", "CASH", "CARD"] as MethodFilter[]).map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    active={methodFilter === m}
                    onPress={() => setMethodFilter(m)}
                  />
                ))}
              </View>

              <Body className="mb-2 font-semibold">Status</Body>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {(
                  ["ALL", "CAPTURED", "REFUNDED", "PENDING"] as StatusFilter[]
                ).map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    active={statusFilter === s}
                    onPress={() => setStatusFilter(s)}
                  />
                ))}
              </View>
            </ScrollView>

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => {
                  setKindFilter("ALL");
                  setMethodFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="flex-1 items-center justify-center rounded-xl2 border border-line bg-surface py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Body className="text-navy">Clear all</Body>
              </Pressable>
              <Pressable
                onPress={() => setShowFilters(false)}
                className="flex-1 items-center justify-center rounded-xl2 bg-brand py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Body className="text-white">Apply</Body>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!refunding}
        transparent
        animationType="slide"
        onRequestClose={() => setRefunding(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[85%] rounded-t-3xl bg-surface p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Body className="text-lg font-semibold">Refund</Body>
              <Pressable onPress={() => setRefunding(null)}>
                <Icon name="X" size={22} color={COLORS.navy} />
              </Pressable>
            </View>

            {refunding && (
              <ScrollView>
                <Muted className="mb-1 text-xs">
                  {refunding._id} · {refunding.customerName || "Walk-in"}
                </Muted>

                <Card className="mb-4 p-3">
                  <View className="flex-row items-baseline justify-between">
                    <Muted className="text-sm">Originally taken</Muted>
                    <Amount>{money(refunding.amount)}</Amount>
                  </View>
                  <View className="mt-1 flex-row items-baseline justify-between">
                    <Muted className="text-sm">Method</Muted>
                    <Body>{refunding.method}</Body>
                  </View>
                  <View className="mt-1 flex-row items-baseline justify-between">
                    <Muted className="text-sm">Reference</Muted>
                    <Body>{refunding.bookingRef || "—"}</Body>
                  </View>
                </Card>

                <Body className="mb-1 font-semibold">
                  Amount to give back
                </Body>
                <TextInput
                  className="rounded-xl border border-line bg-canvas p-3 tabular-nums"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  testID="refund-amount"
                />
                <Muted className="mb-4 mt-1 text-xs">
                  Cannot exceed {money(refunding.amount)}
                </Muted>

                <Body className="mb-1 font-semibold">Reason</Body>
                <TextInput
                  className="min-h-[80px] rounded-xl border border-line bg-canvas p-3"
                  multiline
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Explain why this refund is being made…"
                  testID="refund-reason"
                />
                <Muted className="mb-4 mt-1 text-xs">
                  At least 3 characters
                </Muted>

                {refunding.method === "CASH" && (
                  <Muted className="mb-4 text-xs text-warn">
                    This refund will be taken out of your drawer.
                  </Muted>
                )}
              </ScrollView>
            )}

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => setRefunding(null)}
                className="flex-1 items-center justify-center rounded-xl2 border border-line bg-surface py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Body className="text-navy">Cancel</Body>
              </Pressable>
              <Pressable
                onPress={submitRefund}
                disabled={
                  !refunding ||
                  !(Number(amount) > 0) ||
                  reason.trim().length < 3 ||
                  refund.isPending
                }
                testID="refund-submit"
                className="flex-1 flex-row items-center justify-center rounded-xl2 bg-danger py-3"
                style={({ pressed }) => ({
                  opacity:
                    !refunding ||
                    !(Number(amount) > 0) ||
                    reason.trim().length < 3 ||
                    refund.isPending
                      ? 0.5
                      : pressed
                      ? 0.7
                      : 1,
                })}
              >
                <Icon name="Undo2" size={16} color={COLORS.white} />
                <Body className="ml-2 text-white">
                  {refund.isPending
                    ? "Refunding…"
                    : `Refund ${money(Number(amount || 0))}`}
                </Body>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function TransactionCard({
  transaction,
  onRefund,
}: {
  transaction: TillTransaction;
  onRefund: () => void;
}) {
  const isRefund = transaction.kind === "REFUND";
  const canRefund =
    transaction.kind !== "REFUND" && transaction.status === "CAPTURED";

  return (
    <Card className="p-4" testID={`tx-${transaction._id}`}>
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Muted className="text-[11px]">{transaction._id}</Muted>
          <Body className="font-semibold">
            {transaction.customerName || "Walk-in"}
          </Body>
          <Muted className="mt-0.5 text-xs">
            {transaction.productName || "—"}
          </Muted>
          {transaction.bookingRef ? (
            <Muted className="text-[11px]">
              Booking {transaction.bookingRef}
            </Muted>
          ) : null}
        </View>

        <View className="items-end">
          <Amount
            className={`text-lg ${
              isRefund ? "text-danger" : "text-navy"
            }`}
          >
            {isRefund ? "−" : ""}
            {money(transaction.amount)}
          </Amount>
          <Muted className="text-[11px]">
            {formatTime(new Date(transaction.createdAt).getTime())}
          </Muted>
          <Muted className="text-[10px]">
            {formatDate(new Date(transaction.createdAt).getTime())}
          </Muted>
        </View>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-2">
        <Pill
          icon={transaction.method === "CASH" ? "CircleDollarSign" : "CreditCard"}
          label={transaction.method}
        />
        <Pill label={transaction.kind} />
        <Pill
          label={transaction.status}
          tone={
            transaction.status === "CAPTURED"
              ? "success"
              : transaction.status === "REFUNDED"
              ? "warning"
              : "neutral"
          }
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Muted className="text-xs">
          Taken by {transaction.takenByName || "—"}
        </Muted>

        {canRefund ? (
          <Pressable
            onPress={onRefund}
            testID="tx-refund-btn"
            className="flex-row items-center justify-center rounded-xl2 border border-danger/30 bg-danger/5 px-3 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="Undo2" size={14} color={COLORS.danger} />
            <Body className="ml-2 text-sm text-danger">Refund</Body>
          </Pressable>
        ) : (
          <Muted className="text-xs">—</Muted>
        )}
      </View>
    </Card>
  );
}

function Pill({
  label,
  icon,
  tone = "neutral",
}: {
  label: string;
  icon?: IconName;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? COLORS.success
      : tone === "warning"
      ? COLORS.warn
      : tone === "danger"
      ? COLORS.danger
      : COLORS.navy;

  return (
    <View className="flex-row items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5">
      {icon && <Icon name={icon} size={11} color={color} />}
      <Muted className="text-[11px]" style={{ color }}>
        {label}
      </Muted>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        active ? "border-brand bg-brand" : "border-line bg-canvas"
      }`}
    >
      <Body className={`text-xs ${active ? "text-white" : "text-navy"}`}>
        {label}
      </Body>
    </Pressable>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <Pressable
      onPress={onClear}
      className="flex-row items-center gap-1 rounded-full bg-brand/10 px-3 py-1"
    >
      <Body className="text-xs text-brand">{label}</Body>
      <Icon name="X" size={12} color={COLORS.brand} />
    </Pressable>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
  testID,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
  testID?: string;
}) {
  const color =
    tone === "info"
      ? COLORS.brand
      : tone === "warning"
      ? COLORS.warn
      : tone === "success"
      ? COLORS.success
      : tone === "danger"
      ? COLORS.danger
      : COLORS.navy;

  return (
    <View
      testID={testID}
      className="flex-1 rounded-xl2 border border-line bg-surface p-4"
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Label className="flex-1" numberOfLines={2}>
          {label}
        </Label>
        <View style={{ marginRight: 2 }}>
          <Icon name={icon} size={16} color={color} />
        </View>
      </View>
      <Amount
        className={`text-xl ${
          tone === "danger" ? "text-danger" : "text-navy"
        }`}
      >
        {value}
      </Amount>
    </View>
  );
}