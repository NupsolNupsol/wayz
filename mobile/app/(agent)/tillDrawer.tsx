// app/(agent)/till/drawer.tsx
import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";

// import { AppHeader } from "@/components/AppHeader";
import { Icon, type IconName } from "@/components/Icon";
import {
  Amount,
  Body,
  Card,
  EmptyState,
  Label,
  ListGroup,
  ListRow,
  Loading,
  Muted,
  Screen,
  Section,
} from "@/components/ui";
import {
  useTillDrawer,
  useOpenShift,
  useRecordMovement,
} from "@/hooks/queries";
import { COLORS } from "@/theme/tokens";
import { formatTime, money } from "@/lib/format";
import type { CashMovement } from "@/api/endpoints";

type MovementKind = "FLOAT_IN" | "PAY_OUT" | "DROP";

const KINDS: {
  value: MovementKind;
  icon: IconName;
  tone: "success" | "warning" | "info";
  label: string;
}[] = [
  {
    value: "FLOAT_IN",
    icon: "ArrowDownToLine",
    tone: "success",
    label: "Float in",
  },
  {
    value: "PAY_OUT",
    icon: "ArrowUpFromLine",
    tone: "warning",
    label: "Pay out",
  },
  { value: "DROP", icon: "Landmark", tone: "info", label: "Drop" },
];

const kindMeta = (k: MovementKind) =>
  KINDS.find((x) => x.value === k) ?? KINDS[0];

export default function TillDrawer() {
  const drawer = useTillDrawer();
  const openShift = useOpenShift();
  const record = useRecordMovement();

  const [kind, setKind] = useState<MovementKind | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const close = () => {
    setKind(null);
    setAmount("");
    setReason("");
    setReference("");
  };

  const submit = () => {
    if (!kind) return;
    record.mutate(
      {
        kind,
        amount: Number(amount || 0),
        reason: reason.trim(),
        reference: reference.trim() || undefined,
      },
      { onSuccess: close }
    );
  };

  if (drawer.isLoading && !drawer.data) {
    return (
      <Screen testID="till-drawer">
        {/* <AppHeader title="Cash Drawer" showBack /> */}
        <Loading label="Loading drawer..." />
      </Screen>
    );
  }

  const d = drawer.data?.drawer ?? null;
  const movements = drawer.data?.movements ?? [];

  return (
    <Screen testID="till-drawer">
      {/* <AppHeader title="Cash Drawer" showBack /> */}

      {d && (
        <View className="mb-4 flex-row gap-2 px-4">
          {KINDS.map((k) => {
            const isPrimary = k.value === "FLOAT_IN";
            return (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                testID={`drawer-add-${k.value}`}
                className={`flex-1 flex-row items-center justify-center rounded-xl2 border px-2 py-2.5 ${
                  isPrimary ? "border-brand bg-brand" : "border-line bg-surface"
                }`}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon
                  name={k.icon}
                  size={15}
                  color={isPrimary ? COLORS.white : COLORS.navy}
                />
                <Body
                  className={`ml-1.5 text-sm ${
                    isPrimary ? "text-white" : "text-navy"
                  }`}
                  numberOfLines={1}
                >
                  {k.label}
                </Body>
              </Pressable>
            );
          })}
        </View>
      )}

      {!d ? (
        <View className="px-4">
          <Card>
            <EmptyState
              icon={<Icon name="Wallet" size={28} color={COLORS.faint} />}
              title="No till open"
              message="Open your till to start recording cash movements."
              testID="drawer-empty"
            />

            <Pressable
              onPress={() => openShift.mutate()}
              disabled={openShift.isPending}
              testID="drawer-open-till"
              className="mt-4 flex-row items-center justify-center rounded-xl2 bg-brand px-4 py-3"
              style={({ pressed }) => ({
                opacity: openShift.isPending ? 0.6 : pressed ? 0.7 : 1,
              })}
            >
              {openShift.isPending ? (
                <Body className="text-white">Opening…</Body>
              ) : (
                <>
                  <Icon name="Wallet" size={16} color={COLORS.white} />
                  <Body className="ml-2 text-white">Open my till</Body>
                </>
              )}
            </Pressable>
          </Card>
        </View>
      ) : (
        <>
          <View className="mb-4 px-4">
            <View className="mb-3 flex-row gap-3">
              <Stat
                label="SHOULD BE IN DRAWER"
                value={money(d.derived)}
                icon="Wallet"
                tone="info"
                testID="drawer-stat-total"
              />
              <Stat
                label="FLOAT IN"
                value={money(d.floatIn)}
                icon="ArrowDownToLine"
                tone="success"
                testID="drawer-stat-float"
              />
            </View>
            <View className="flex-row gap-3">
              <Stat
                label="PAY OUT"
                value={money(d.paidOut)}
                icon="ArrowUpFromLine"
                tone={d.paidOut ? "warning" : "neutral"}
                testID="drawer-stat-paidout"
              />
              <Stat
                label="DROPPED"
                value={money(d.dropped)}
                icon="Landmark"
                tone="neutral"
                testID="drawer-stat-dropped"
              />
            </View>
          </View>

          {Math.abs(d.drift) > 0.009 && (
            <View className="mb-4 px-4">
              <Card className="border-danger/40 bg-danger/5">
                <View className="flex-row items-start gap-3">
                  <Icon name="AlertTriangle" size={18} color={COLORS.danger} />
                  <View className="flex-1">
                    <Body className="font-semibold text-danger">
                      Figures disagree
                    </Body>
                    <Muted className="mt-1 text-xs">
                      Movements add up to {money(d.derived)} but the till has
                      been accumulating {money(d.expected)}. Report it — do not
                      adjust your count.
                    </Muted>
                  </View>
                </View>
              </Card>
            </View>
          )}

          <Section title="How that adds up" className="mb-4 px-4">
            <Card className="p-4">
              <SummaryLine label="Opening float" value={d.floatIn} sign="+" />
              <SummaryLine label="Cash taken" value={d.cashSales} sign="+" />
              <SummaryLine
                label="Cash refunded"
                value={d.cashRefunds}
                sign="−"
              />
              <SummaryLine label="Paid out" value={d.paidOut} sign="−" />
              <SummaryLine label="Dropped" value={d.dropped} sign="−" />

              <View className="mt-2 flex-row items-baseline justify-between border-t border-line pt-3">
                <Body className="font-semibold">Expected</Body>
                <Amount className="text-xl text-navy">
                  {money(d.derived)}
                </Amount>
              </View>

              <Muted className="mt-3 text-[11px]">
                Card sales ({money(d.cardSales)}) do not affect the drawer.
              </Muted>
            </Card>
          </Section>

          <Section title="Movements on this till" className="mb-8 px-4">
            {movements.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Icon name="Clock" size={22} color={COLORS.faint} />}
                  title="No movements yet"
                  message="Float in, pay out, and drops will appear here."
                  testID="drawer-movements-empty"
                />
              </Card>
            ) : (
              <ListGroup>
                {movements
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .map((m, index) => (
                    <View key={m._id}>
                      {index > 0 && <View className="h-px bg-line" />}
                      <MovementRow movement={m} />
                    </View>
                  ))}
              </ListGroup>
            )}
          </Section>
        </>
      )}

      <Modal
        visible={!!kind}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[85%] rounded-t-3xl bg-surface p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Body className="text-lg font-semibold">
                {kind ? kindMeta(kind).label : ""}
              </Body>
              <Pressable onPress={close} hitSlop={10}>
                <Icon name="X" size={22} color={COLORS.navy} />
              </Pressable>
            </View>

            <ScrollView>
              <Body className="mb-1 font-semibold">Amount</Body>
              <TextInput
                className="mb-2 rounded-xl border border-line bg-canvas p-3 text-lg tabular-nums"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                testID="drawer-amount"
              />
              <Muted className="mb-4 text-xs">
                Record the exact amount moved.
              </Muted>

              <Body className="mb-1 font-semibold">Reason</Body>
              <TextInput
                className="mb-2 min-h-[80px] rounded-xl border border-line bg-canvas p-3"
                multiline
                value={reason}
                onChangeText={setReason}
                placeholder="Why is this cash moving?"
                testID="drawer-reason"
              />
              <Muted className="mb-4 text-xs">At least 3 characters</Muted>

              <Body className="mb-1 font-semibold">Reference (optional)</Body>
              <TextInput
                className="mb-4 rounded-xl border border-line bg-canvas p-3"
                value={reference}
                onChangeText={setReference}
                placeholder="Receipt, voucher, note…"
                testID="drawer-reference"
              />

              {kind !== "FLOAT_IN" && d && (
                <Muted className="mb-4 text-xs">
                  The drawer is expected to hold {money(d.derived)}. You cannot
                  take out more than that.
                </Muted>
              )}
            </ScrollView>

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={close}
                className="flex-1 flex-row items-center justify-center rounded-xl2 border border-line bg-surface py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Body className="text-navy">Cancel</Body>
              </Pressable>

              <Pressable
                onPress={submit}
                disabled={
                  !(Number(amount) > 0) ||
                  reason.trim().length < 3 ||
                  record.isPending
                }
                testID="drawer-submit"
                className="flex-1 flex-row items-center justify-center rounded-xl2 bg-brand py-3"
                style={({ pressed }) => ({
                  opacity:
                    !(Number(amount) > 0) ||
                    reason.trim().length < 3 ||
                    record.isPending
                      ? 0.5
                      : pressed
                      ? 0.7
                      : 1,
                })}
              >
                {record.isPending ? (
                  <Body className="text-white">Recording…</Body>
                ) : (
                  <>
                    <Icon name="Check" size={16} color={COLORS.white} />
                    <Body className="ml-2 text-white">
                      Record {money(Number(amount || 0))}
                    </Body>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryLine({
  label,
  value,
  sign,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
}) {
  return (
    <View className="flex-row items-baseline justify-between py-1.5">
      <Body className="text-sm">{label}</Body>
      <Amount className={sign === "−" ? "text-danger" : "text-navy"}>
        {sign}
        {money(value)}
      </Amount>
    </View>
  );
}

function MovementRow({ movement }: { movement: CashMovement }) {
  const meta = kindMeta(movement.kind as MovementKind);
  const positive = movement.kind === "FLOAT_IN";

  return (
    <ListRow
      testID={`drawer-movement-${movement._id}`}
      title={meta.label}
      subtitle={movement.reason}
      trailing={
        <View className="items-end">
          <Amount className={positive ? "text-success" : "text-danger"}>
            {positive ? "+" : "−"}
            {money(movement.amount)}
          </Amount>
          <Muted className="text-[11px]">
            {formatTime(new Date(movement.createdAt).getTime())}
          </Muted>
          <Muted className="text-[10px]">by {movement.actorName}</Muted>
        </View>
      }
    />
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
        className={`text-xl ${tone === "danger" ? "text-danger" : "text-navy"}`}
      >
        {value}
      </Amount>
    </View>
  );
}