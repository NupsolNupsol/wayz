// src/components/PaymentPanel.tsx
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Amount, Body, Card, Muted } from "@/components/ui";
import { COLORS } from "@/theme/tokens";
import { money } from "@/lib/format";

export type PaymentMethod = "CASH" | "CARD";

export type CardScheme = "MADA" | "SPAN" | "VISA" | "MASTERCARD" | "GCC";

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
  cardScheme?: CardScheme;
}

const CARD_SCHEMES: { value: CardScheme; label: string }[] = [
  { value: "MADA", label: "Mada" },
  { value: "SPAN", label: "SPAN" },
  { value: "VISA", label: "Visa" },
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "GCC", label: "GCC" },
];

interface Line {
  id: string;
  method: PaymentMethod;
  cardScheme?: CardScheme;
  amount: string;
}

interface Props {
  total: number;
  discountOff?: number;
  tillOpen: boolean;
  confirming?: boolean;
  disabled?: boolean;
  otpPending?: boolean;
  onConfirm: (splits: PaymentSplit[]) => void;
}

const newLine = (method: PaymentMethod = "CARD"): Line => ({
  id: Math.random().toString(36).slice(2),
  method,
  cardScheme: method === "CARD" ? "MADA" : undefined,
  amount: "",
});

export function PaymentPanel({
  total,
  discountOff = 0,
  tillOpen,
  confirming,
  disabled,
  otpPending,
  onConfirm,
}: Props) {
  const payable = Math.max(0, total - discountOff);
  const [lines, setLines] = useState<Line[]>(() => [
    { ...newLine("CARD"), amount: payable.toFixed(2) },
  ]);
  const [split, setSplit] = useState(false);

  const allocated = useMemo(
    () => lines.reduce((s, l) => s + Number(l.amount || 0), 0),
    [lines]
  );
  const remaining = Math.max(0, Number((payable - allocated).toFixed(2)));
  const overpay = allocated > payable + 0.001;

  const hasCash = lines.some(
    (l) => l.method === "CASH" && Number(l.amount) > 0
  );
  const cashBlocked = !tillOpen && hasCash;

  const canConfirm =
    !disabled &&
    !confirming &&
    !cashBlocked &&
    !otpPending &&
    remaining < 0.01 &&
    lines.length > 0;

  const updateLine = (id: string, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );

  const removeLine = (id: string) =>
    setLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.id !== id) : prev
    );

  const addSplitLine = () => {
    setSplit(true);
    setLines((prev) => [
      ...prev,
      {
        ...newLine(prev[0].method === "CARD" ? "CASH" : "CARD"),
        amount: "",
      },
    ]);
  };

  const disableSplit = () => {
    setSplit(false);
    setLines((prev) => [{ ...prev[0], amount: payable.toFixed(2) }]);
  };

  const autoFill = (id: string) =>
    updateLine(id, { amount: remaining.toFixed(2) });

  const confirm = () => {
    if (!canConfirm) return;
    const splits = lines
      .map<PaymentSplit>((l) => ({
        method: l.method,
        amount: Number(l.amount || 0),
        cardScheme: l.method === "CARD" ? l.cardScheme : undefined,
      }))
      .filter((s) => s.amount > 0);
    onConfirm(splits);
  };

  return (
    <View>
      {!tillOpen && (
        <Card className="mb-3 border-warn/40 bg-warn-soft">
          <View className="flex-row items-start gap-3">
            <Icon name="AlertTriangle" size={16} color={COLORS.warn} />
            <Muted className="flex-1 text-xs text-warn">
              Your till is shut. Open it from the header before taking money —
              nothing can be sold at a closed drawer.
            </Muted>
          </View>
        </Card>
      )}

      {!split && (
        <View className="mb-3 flex-row overflow-hidden rounded-xl2 border border-line">
          <Pressable
            onPress={() =>
              updateLine(lines[0].id, {
                method: "CARD",
                cardScheme: lines[0].cardScheme ?? "MADA",
              })
            }
            testID="method-card"
            className={`flex-1 flex-row items-center justify-center py-3 ${
              lines[0].method === "CARD" ? "bg-brand" : "bg-surface"
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Icon
              name="CreditCard"
              size={16}
              color={lines[0].method === "CARD" ? COLORS.white : COLORS.navy}
            />
            <Body
              className={`ml-2 ${
                lines[0].method === "CARD" ? "text-white" : "text-navy"
              }`}
            >
              Card
            </Body>
          </Pressable>

          <Pressable
            onPress={() =>
              updateLine(lines[0].id, {
                method: "CASH",
                cardScheme: undefined,
              })
            }
            testID="method-cash"
            className={`flex-1 flex-row items-center justify-center py-3 ${
              lines[0].method === "CASH" ? "bg-brand" : "bg-surface"
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Icon
              name="CircleDollarSign"
              size={16}
              color={lines[0].method === "CASH" ? COLORS.white : COLORS.navy}
            />
            <Body
              className={`ml-2 ${
                lines[0].method === "CASH" ? "text-white" : "text-navy"
              }`}
            >
              Cash
            </Body>
          </Pressable>
        </View>
      )}

      {!split && lines[0].method === "CARD" && (
        <View className="mb-3">
          <Muted className="mb-2 text-[10px] font-semibold tracking-wider text-muted">
            WHICH CARD? THE BANK CHARGES A DIFFERENT COMMISSION FOR EACH
          </Muted>
          <View className="flex-row flex-wrap gap-2">
            {CARD_SCHEMES.map((s) => {
              const active = lines[0].cardScheme === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() =>
                    updateLine(lines[0].id, { cardScheme: s.value })
                  }
                  testID={`scheme-${s.value}`}
                  className={`rounded-xl border px-4 py-2 ${
                    active
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface"
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Body
                    className={`text-sm ${
                      active ? "text-brand" : "text-navy"
                    }`}
                  >
                    {s.label}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {!split ? (
        <Pressable
          onPress={addSplitLine}
          className="mb-3 flex-row items-center gap-2 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          testID="split-toggle"
        >
          <View className="h-4 w-4 items-center justify-center rounded border border-line" />
          <Body className="text-sm text-navy">
            Split this payment between two methods
          </Body>
        </Pressable>
      ) : (
        <Pressable
          onPress={disableSplit}
          className="mb-3 flex-row items-center gap-2 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          testID="split-untoggle"
        >
          <View className="h-4 w-4 items-center justify-center rounded border border-brand bg-brand">
            <Icon name="Check" size={10} color={COLORS.white} />
          </View>
          <Body className="text-sm text-navy">
            Split this payment between two methods
          </Body>
        </Pressable>
      )}

      {split &&
        lines.map((line, index) => {
          const amount = Number(line.amount || 0);
          const isCash = line.method === "CASH";
          return (
            <Card key={line.id} className="mb-3 p-3">
              <View className="mb-2 flex-row items-center justify-between">
                <Muted className="text-xs font-semibold">
                  {index === 0 ? "First method" : "Second method"}
                </Muted>
                {lines.length > 1 && (
                  <Pressable
                    onPress={() => removeLine(line.id)}
                    hitSlop={8}
                  >
                    <Icon name="X" size={16} color={COLORS.danger} />
                  </Pressable>
                )}
              </View>

              <View className="mb-2 flex-row gap-2">
                <Pressable
                  onPress={() =>
                    updateLine(line.id, {
                      method: "CARD",
                      cardScheme: line.cardScheme ?? "MADA",
                    })
                  }
                  className={`flex-1 flex-row items-center justify-center rounded-xl2 border py-2 ${
                    !isCash
                      ? "border-brand bg-brand"
                      : "border-line bg-surface"
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Icon
                    name="CreditCard"
                    size={14}
                    color={!isCash ? COLORS.white : COLORS.navy}
                  />
                  <Body
                    className={`ml-1.5 text-xs ${
                      !isCash ? "text-white" : "text-navy"
                    }`}
                  >
                    Card
                  </Body>
                </Pressable>

                <Pressable
                  onPress={() =>
                    updateLine(line.id, {
                      method: "CASH",
                      cardScheme: undefined,
                    })
                  }
                  className={`flex-1 flex-row items-center justify-center rounded-xl2 border py-2 ${
                    isCash
                      ? "border-brand bg-brand"
                      : "border-line bg-surface"
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Icon
                    name="CircleDollarSign"
                    size={14}
                    color={isCash ? COLORS.white : COLORS.navy}
                  />
                  <Body
                    className={`ml-1.5 text-xs ${
                      isCash ? "text-white" : "text-navy"
                    }`}
                  >
                    Cash
                  </Body>
                </Pressable>
              </View>

              {!isCash && (
                <View className="mb-2 flex-row flex-wrap gap-2">
                  {CARD_SCHEMES.map((s) => {
                    const active = line.cardScheme === s.value;
                    return (
                      <Pressable
                        key={s.value}
                        onPress={() =>
                          updateLine(line.id, { cardScheme: s.value })
                        }
                        className={`rounded-xl border px-3 py-1.5 ${
                          active
                            ? "border-brand bg-brand-soft"
                            : "border-line bg-surface"
                        }`}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Body
                          className={`text-xs ${
                            active ? "text-brand" : "text-navy"
                          }`}
                        >
                          {s.label}
                        </Body>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View className="flex-row items-center gap-2">
                <TextInput
                  className="flex-1 rounded-xl border border-line bg-canvas p-3 text-lg tabular-nums"
                  keyboardType="decimal-pad"
                  value={line.amount}
                  onChangeText={(t) => updateLine(line.id, { amount: t })}
                  placeholder="0.00"
                />
                {remaining > 0 && (
                  <Pressable
                    onPress={() => autoFill(line.id)}
                    className="rounded-xl2 border border-line bg-surface px-3 py-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Body className="text-xs text-brand">
                      Fill {money(remaining)}
                    </Body>
                  </Pressable>
                )}
              </View>

              {amount > payable && (
                <Muted className="mt-1 text-[11px] text-warn">
                  Overpays by {money(amount - payable)}.
                </Muted>
              )}
            </Card>
          );
        })}

      <Card className="mb-3 p-3">
        <Row label="Total" value={money(total)} />
        {discountOff > 0 && (
          <Row
            label="Discount off"
            value={`-${money(discountOff)}`}
            valueClass="text-success"
          />
        )}
        <Row label="Payable" value={money(payable)} bold />
        <Row
          label="Allocated"
          value={money(allocated)}
          valueClass={overpay ? "text-warn" : "text-navy"}
        />
        <Row
          label="Remaining"
          value={money(remaining)}
          valueClass={remaining > 0 ? "text-warn" : "text-success"}
          bold
        />
      </Card>

      {otpPending && (
        <Muted className="mb-2 text-center text-xs text-warn">
          Confirm the code above before taking payment.
        </Muted>
      )}

      <Pressable
        onPress={confirm}
        disabled={!canConfirm}
        testID="payment-confirm"
        className="flex-row items-center justify-center rounded-xl2 bg-brand py-3"
        style={({ pressed }) => ({
          opacity: !canConfirm ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        <Icon name="Check" size={16} color={COLORS.white} />
        <Body className="ml-2 text-white">
          {confirming ? "Taking payment…" : "Confirm payment"}
        </Body>
      </Pressable>

      <Muted className="mt-3 text-[11px]">
        A payment records the sale and confirms the booking — it does not start
        any operational timer.
      </Muted>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  valueClass,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between py-1">
      <Body className={`text-sm ${bold ? "font-semibold" : ""}`}>
        {label}
      </Body>
      <Amount className={valueClass}>{value}</Amount>
    </View>
  );
}