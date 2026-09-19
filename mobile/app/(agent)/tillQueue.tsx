// app/(agent)/till/queue.tsx
import { router } from "expo-router";
import {
  Pressable,
  View,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Text,
  ActivityIndicator,
} from "react-native";
import { useState, useMemo } from "react";

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
import {
  PaymentPanel,
  type PaymentSplit,
} from "@/components/PaymentPanel";
import { DiscountButton } from "@/components/DiscountButton";
import {
  useTillQueue,
  useTillOverview,
  usePay,
  useTransition,
} from "@/hooks/queries";
import { COLORS } from "@/theme/tokens";
import { money } from "@/lib/format";
import type { QueuedPayment } from "@/api/endpoints";

const STALE_QUEUE_MS = 10 * 60 * 1000;

async function sendOtp(bookingId: string, channel: "SMS" | "WHATSAPP") {
  await new Promise((r) => setTimeout(r, 700));
  return { maskedTo: "+966 •• •• 4321" };
}
async function verifyOtp(bookingId: string, code: string) {
  await new Promise((r) => setTimeout(r, 700));
  if (code.length !== 4) throw new Error("Invalid code");
  return { ok: true };
}

function formatWaitingTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000)
    return `${Math.floor(ms / 3600000)}h ${Math.floor(
      (ms % 3600000) / 60000
    )}m`;
  return `${Math.floor(ms / 86400000)}d ${Math.floor(
    (ms % 86400000) / 3600000
  )}h`;
}

function QueueCard({
  row,
  onTake,
  onDrop,
  stale,
}: {
  row: QueuedPayment;
  onTake: () => void;
  onDrop: () => void;
  stale: boolean;
}) {
  return (
    <Card
      className={`mb-3 p-4 ${stale ? "border-warn/40 bg-warn-soft" : ""}`}
      testID={`queue-card-${row.bookingId}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <Muted className="text-xs">{row.ref}</Muted>
            {stale && (
              <View className="rounded-full bg-warn/20 px-2 py-0.5">
                <Muted className="text-[10px] font-medium text-warn">
                  <Icon name="Clock" size={10} color={COLORS.warn} />{" "}
                  {formatWaitingTime(row.waitingMs)}
                </Muted>
              </View>
            )}
          </View>

          <View className="mt-1.5 flex-row items-center gap-1.5">
            <Icon name="User" size={14} color={COLORS.muted} />
            <Body className="font-semibold">
              {row.customerName || "Walk-in"}
            </Body>
          </View>

          <Muted className="text-sm">{row.productName}</Muted>
          <Muted className="mt-0.5 text-xs">
            {row.items > 0
              ? `${row.items} item${row.items > 1 ? "s" : ""} · `
              : ""}
            Registered {formatWaitingTime(row.waitingMs)} ago
          </Muted>
        </View>

        <View className="items-end">
          <Amount className="text-xl text-navy">{money(row.total)}</Amount>
          {row.depositTotal > 0 && (
            <Muted className="text-[11px]">
              incl. deposit {money(row.depositTotal)}
            </Muted>
          )}
          <Muted className="text-[11px]">VAT {money(row.vat)}</Muted>
        </View>
      </View>

      <View className="mt-3 flex-row justify-end gap-2">
        <Pressable
          onPress={onDrop}
          testID={`queue-cancel-${row.bookingId}`}
          className="flex-row items-center justify-center rounded-xl2 border border-danger/30 bg-danger/5 px-4 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="X" size={15} color={COLORS.danger} />
          <Body className="ml-2 text-danger">Cancel</Body>
        </Pressable>

        <Pressable
          onPress={onTake}
          testID={`queue-take-${row.bookingId}`}
          className="flex-row items-center justify-center rounded-xl2 bg-brand px-4 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="CircleDollarSign" size={16} color={COLORS.white} />
          <Body className="ml-2 text-white">Take payment</Body>
        </Pressable>
      </View>
    </Card>
  );
}

export default function TillQueue() {
  const queue = useTillQueue();
  const overview = useTillOverview();
  const pay = usePay();
  const drop = useTransition();

  const [selectedItem, setSelectedItem] = useState<QueuedPayment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [voucher, setVoucher] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpMasked, setOtpMasked] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const resetOtp = () => {
    setOtpSent(false);
    setOtpMasked("");
    setOtpCode("");
    setOtpSending(false);
    setOtpVerifying(false);
    setOtpVerified(false);
  };

  const handleSendCode = async () => {
    if (!selectedItem) return;
    setOtpSending(true);
    try {
      const res = await sendOtp(selectedItem.bookingId, "WHATSAPP");
      setOtpSent(true);
      setOtpMasked(res.maskedTo);
    } catch (e: any) {
      Alert.alert("Could not send", e?.message || "Try again");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!selectedItem || otpCode.trim().length < 4) return;
    setOtpVerifying(true);
    try {
      await verifyOtp(selectedItem.bookingId, otpCode.trim());
      setOtpVerified(true);
    } catch (e: any) {
      Alert.alert("Invalid code", e?.message || "Try again");
    } finally {
      setOtpVerifying(false);
    }
  };

  const { value, overdue, sortedQueue } = useMemo(() => {
    if (!queue.data)
      return { value: 0, overdue: 0, sortedQueue: [] as QueuedPayment[] };

    const sorted = [...queue.data].sort((a, b) => b.waitingMs - a.waitingMs);
    const value = sorted.reduce((sum, r) => sum + r.total, 0);
    const overdue = sorted.filter((r) => r.waitingMs > STALE_QUEUE_MS).length;

    return { value, overdue, sortedQueue: sorted };
  }, [queue.data]);

  const tillOpen = overview.data?.shift?.status === "OPEN";

  const handleTakePayment = (item: QueuedPayment) => {
    setSelectedItem(item);
    setVoucher("");
    resetOtp();
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = (splits: PaymentSplit[]) => {
    if (!selectedItem) return;

    pay.mutate(
      { id: selectedItem.bookingId, splits },
      {
        onSuccess: () => {
          Alert.alert(
            "Payment Taken",
            `${money(selectedItem.total)} taken — ${selectedItem.ref} is paid`
          );
          setShowPaymentModal(false);
          setSelectedItem(null);
          resetOtp();
          queue.refetch();
          overview.refetch();
        },
        onError: (error: any) => {
          Alert.alert(
            "Payment Failed",
            error?.message || "Could not take payment"
          );
        },
      }
    );
  };

  const applyVoucher = () => {
    if (!selectedItem || voucher.trim().length < 3) return;
    Alert.alert("Voucher", `"${voucher}" would be applied to this order.`);
    setVoucher("");
  };

  const handleCancelPayment = (item: QueuedPayment) => {
    setSelectedItem(item);
    setCancelReason("");
    setShowReasonInput(false);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedItem) return;
    const reason = cancelReason || "CUSTOMER_LEFT";

    drop.mutate(
      {
        id: selectedItem.bookingId,
        code: "TO_CANCELLED",
        payload: { reason },
      },
      {
        onSuccess: () => {
          Alert.alert("Cancelled", `${selectedItem.ref} has been cancelled`);
          setShowCancelModal(false);
          setSelectedItem(null);
          setCancelReason("");
          queue.refetch();
          overview.refetch();
        },
        onError: (error: any) => {
          Alert.alert("Failed", error?.message || "Could not cancel payment");
        },
      }
    );
  };

  if (queue.isLoading && !queue.data) {
    return (
      <Screen testID="till-queue">
        {/* <AppHeader title="Awaiting Payment" showBack /> */}
        <Loading label="Loading queue..." />
      </Screen>
    );
  }

  const otpRequired = !!selectedItem?.customerPhone;
  const otpPending = otpRequired && !otpVerified;

  return (
    <Screen
      scroll
      testID="till-queue"
      onRefresh={() => {
        queue.refetch();
        overview.refetch();
      }}
      refreshing={queue.isFetching}
    >
      {/* <AppHeader
        title="Awaiting Payment"
        showBack
        actions={
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                queue.refetch();
                overview.refetch();
              }}
              className="h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas"
            >
              <Icon name="RefreshCw" size={18} color={COLORS.navy} />
            </Pressable>
          </View>
        }
      /> */}

      <View className="mb-5 flex-row gap-3 px-4">
        <Stat
          label="IN THE QUEUE"
          value={String(queue.data?.length ?? 0)}
          icon="ClipboardList"
          tone="info"
        />
        <Stat
          label="VALUE"
          value={money(value)}
          icon="CircleDollarSign"
          tone="info"
        />
        <Stat
          label="WAITING TOO LONG"
          value={String(overdue)}
          icon="Clock"
          tone={overdue > 0 ? "danger" : "neutral"}
          subLabel={`over ${STALE_QUEUE_MS / 60000}m`}
        />
      </View>

      {!tillOpen && (
        <View className="px-4">
          <Card className="mb-4 border-warn/40 bg-warn-soft">
            <View className="flex-row items-center gap-3">
              <Icon name="AlertTriangle" size={20} color={COLORS.warn} />
              <View className="flex-1">
                <Body className="font-semibold">Till is closed</Body>
                <Muted>
                  Card payments still work; cash will be refused until it is
                  open.
                </Muted>
              </View>
            </View>
          </Card>
        </View>
      )}

      <Section title="Oldest first" className="px-4">
        {!queue.data || queue.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="CheckCircle" size={24} color={COLORS.faint} />}
              title="No payments waiting"
              message="All caught up! New payments will appear here."
              testID="queue-empty"
            />
          </Card>
        ) : (
          <View>
            {sortedQueue.map((item) => (
              <QueueCard
                key={item.bookingId}
                row={item}
                stale={item.waitingMs > STALE_QUEUE_MS}
                onTake={() => handleTakePayment(item)}
                onDrop={() => handleCancelPayment(item)}
              />
            ))}
          </View>
        )}
      </Section>

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowPaymentModal(false);
          setSelectedItem(null);
          resetOtp();
        }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[92%] rounded-t-3xl bg-surface p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Body className="text-lg font-semibold">
                  Take {money(selectedItem?.total ?? 0)}
                </Body>
                <Muted className="text-xs">
                  {selectedItem?.ref} ·{" "}
                  {selectedItem?.customerName || "Walk-in"}
                </Muted>
              </View>
              <Pressable
                onPress={() => {
                  setShowPaymentModal(false);
                  setSelectedItem(null);
                  resetOtp();
                }}
                hitSlop={10}
              >
                <Icon name="X" size={22} color={COLORS.navy} />
              </Pressable>
            </View>

            {selectedItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Card className="mb-3 p-3">
                  <View className="flex-row justify-between py-1">
                    <Muted className="text-sm">
                      {selectedItem.productName}
                    </Muted>
                    <Amount>{money(selectedItem.subtotal)}</Amount>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Muted className="text-sm">VAT</Muted>
                    <Amount>{money(selectedItem.vat)}</Amount>
                  </View>
                  {selectedItem.depositTotal > 0 && (
                    <View className="flex-row justify-between py-1">
                      <Muted className="text-sm">Refundable deposit</Muted>
                      <Amount>{money(selectedItem.depositTotal)}</Amount>
                    </View>
                  )}
                  {(selectedItem.discountOff ?? 0) > 0 && (
                    <View className="flex-row justify-between py-1">
                      <Muted className="text-sm text-success">
                        Discount
                      </Muted>
                      <Amount className="text-success">
                        -{money(selectedItem.discountOff ?? 0)}
                      </Amount>
                    </View>
                  )}
                  <View className="mt-1 flex-row justify-between border-t border-line pt-2">
                    <Body className="font-semibold">Total</Body>
                    <Amount className="text-xl text-navy">
                      {money(selectedItem.total)}
                    </Amount>
                  </View>
                </Card>

                <Card className="mb-3 p-3">
                  <Body className="mb-1 text-sm font-semibold">
                    Voucher or code
                  </Body>
                  <Muted className="mb-2 text-[11px]">
                    If the customer has a code, type it here before taking
                    payment.
                  </Muted>
                  <View className="flex-row gap-2">
                    <TextInput
                      className="flex-1 rounded-xl border border-line bg-canvas p-3"
                      placeholder="Enter code"
                      value={voucher}
                      onChangeText={setVoucher}
                      autoCapitalize="characters"
                      testID="voucher-input"
                    />
                    <Pressable
                      onPress={applyVoucher}
                      disabled={voucher.trim().length < 3}
                      className="rounded-xl2 border border-line bg-surface px-4 py-3"
                      style={({ pressed }) => ({
                        opacity:
                          voucher.trim().length < 3
                            ? 0.5
                            : pressed
                            ? 0.7
                            : 1,
                      })}
                    >
                      <Body className="text-navy">Apply</Body>
                    </Pressable>
                  </View>
                </Card>

                <View className="mb-3 flex-row justify-end">
                  <DiscountButton
                    bookingId={selectedItem.bookingId}
                    total={selectedItem.total}
                    onDone={async () => {
                      const result = await queue.refetch();
                      const fresh = result.data?.find(
                        (q) => q.bookingId === selectedItem.bookingId
                      );
                      console.log(
                        "🎯 [queue] fresh item after discount:",
                        fresh
                      );
                      if (fresh) setSelectedItem(fresh);
                    }}
                  />
                </View>

                {otpRequired && (
                  <Card className="mb-3 p-3">
                    <Body className="mb-1 text-sm font-semibold">
                      Verify customer
                    </Body>
                    <Muted className="mb-2 text-[11px]">
                      Send a code to{" "}
                      {selectedItem.customerPhone || "the customer"} to confirm
                      it is them.
                    </Muted>

                    <Pressable
                      onPress={handleSendCode}
                      disabled={otpSending || otpVerified}
                      testID="otp-send"
                      className={`mb-3 flex-row items-center justify-center rounded-xl2 border py-3 ${
                        otpVerified
                          ? "border-success/40 bg-success/10"
                          : "border-brand bg-brand"
                      }`}
                      style={({ pressed }) => ({
                        opacity: otpSending ? 0.6 : pressed ? 0.8 : 1,
                      })}
                    >
                      {otpSending ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : otpVerified ? (
                        <>
                          <Icon
                            name="Check"
                            size={16}
                            color={COLORS.success}
                          />
                          <Body className="ml-2 text-success">Verified</Body>
                        </>
                      ) : (
                        <>
                          <Icon name="Phone" size={16} color={COLORS.white} />
                          <Body className="ml-2 text-white">
                            {otpSent ? "Resend code" : "Send code"}
                          </Body>
                        </>
                      )}
                    </Pressable>

                    {otpSent && !otpVerified && (
                      <>
                        <Muted className="mb-1 text-[11px]">
                          Sent to {otpMasked}
                        </Muted>
                        <View className="flex-row gap-2">
                          <TextInput
                            className="flex-1 rounded-xl border border-line bg-canvas p-3 text-lg tracking-widest tabular-nums"
                            placeholder="••••"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otpCode}
                            onChangeText={(t) =>
                              setOtpCode(t.replace(/\D/g, ""))
                            }
                            testID="otp-code"
                          />
                          <Pressable
                            onPress={handleVerifyCode}
                            disabled={
                              otpVerifying || otpCode.trim().length < 4
                            }
                            testID="otp-verify"
                            className="flex-row items-center justify-center rounded-xl2 bg-brand px-5"
                            style={({ pressed }) => ({
                              opacity:
                                otpVerifying || otpCode.trim().length < 4
                                  ? 0.5
                                  : pressed
                                  ? 0.7
                                  : 1,
                            })}
                          >
                            {otpVerifying ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.white}
                              />
                            ) : (
                              <Body className="text-white">Verify</Body>
                            )}
                          </Pressable>
                        </View>
                      </>
                    )}
                  </Card>
                )}

                <PaymentPanel
                  total={selectedItem.total}
                  discountOff={selectedItem.discountOff ?? 0}
                  tillOpen={tillOpen}
                  confirming={pay.isPending}
                  otpPending={otpPending}
                  onConfirm={handleConfirmPayment}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCancelModal(false);
          setSelectedItem(null);
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="w-[90%] max-w-md rounded-3xl bg-surface p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Body className="text-lg font-semibold">Cancel payment</Body>
              <Pressable
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedItem(null);
                }}
                hitSlop={10}
              >
                <Icon name="X" size={22} color={COLORS.navy} />
              </Pressable>
            </View>

            {selectedItem && (
              <Muted className="mb-4">
                {selectedItem.ref} · {selectedItem.customerName || "Walk-in"}
              </Muted>
            )}

            <View className="mb-4 gap-2">
              {["CUSTOMER_LEFT", "WRONG_ENTRY", "NO_PAYMENT", "OTHER"].map(
                (reason) => {
                  const active = cancelReason === reason;
                  return (
                    <Pressable
                      key={reason}
                      onPress={() => {
                        setCancelReason(reason);
                        setShowReasonInput(reason === "OTHER");
                      }}
                      className={`rounded-xl border p-3 ${
                        active ? "border-brand bg-brand-soft" : "border-line"
                      }`}
                    >
                      <Body className={active ? "text-brand" : ""}>
                        {reason.replace("_", " ").toLowerCase()}
                      </Body>
                    </Pressable>
                  );
                }
              )}
            </View>

            {showReasonInput && (
              <TextInput
                className="mb-4 rounded-xl border border-line bg-canvas p-3"
                placeholder="Enter reason…"
                value={cancelReason === "OTHER" ? "" : cancelReason}
                onChangeText={(text) => setCancelReason(text)}
                multiline
              />
            )}

            <View className="mt-4 w-full flex-row gap-3">
              <Pressable
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedItem(null);
                }}
                className="flex-1 items-center justify-center rounded-full py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Text className="text-base font-semibold text-[#3B4A6B]">
                  Back
                </Text>
              </Pressable>

              <Pressable
                disabled={!!drop?.isPending}
                onPress={handleConfirmCancel}
                className="flex-1 items-center justify-center rounded-full py-3"
                style={{ backgroundColor: "#ee8686", borderRadius: 9 }}
              >
                <Text style={{ color: "white" }}>
                  {drop?.isPending ? "Cancelling…" : "Cancel"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
  subLabel,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
  subLabel?: string;
  onPress?: () => void;
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

  const body = (
    <>
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
      {subLabel && <Muted className="text-[11px]">{subLabel}</Muted>}
    </>
  );

  const cls =
    "flex-1 rounded-xl2 border border-line bg-surface p-4 active:bg-canvas";

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        className={cls}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      className="flex-1 rounded-xl2 border border-line bg-surface p-4"
    >
      {body}
    </View>
  );
}