// src/components/DiscountModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/Icon";
import { Amount, Body, Card, Muted } from "@/components/ui";
import { COLORS } from "@/theme/tokens";
import { money } from "@/lib/format";
import type { DiscountReason } from "@/types";

interface Props {
  visible: boolean;
  total: number;
  reasons?: DiscountReason[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    reasonCode: string;
    percent: number;
    note?: string;
  }) => void;
}

export function DiscountModal({
  visible,
  total,
  reasons = [],
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [reasonCode, setReasonCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [free, setFree] = useState(false);
  const [note, setNote] = useState("");

  // Reset only when modal OPENS (not on every reasons change)
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Opening — reset
      setReasonCode(reasons[0]?.code ?? "");
      setPercent("10");
      setFree(false);
      setNote("");
    }
    wasVisible.current = visible;
  }, [visible, reasons]);

  const reason = reasons.find((r) => r.code === reasonCode) ?? null;

  const asked = useMemo(() => {
    if (free) return 100;
    const n = Number(percent);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(100, Math.max(0, n));
  }, [free, percent]);

  const overCeiling = !!reason && asked > reason.maxPercent;
  const ready = !!reason && asked > 0 && !overCeiling;

  const offAmount = useMemo(
    () => Math.round(((total * asked) / 100) * 100) / 100,
    [total, asked]
  );
  const newTotal = Math.max(0, total - offAmount);

  const submit = () => {
    if (!ready || !reason) return;
    const payload = {
      reasonCode: reason.code,
      percent: asked,
      note: note.trim() || undefined,
    };
    console.log("🎯 [DiscountModal] Submitting:", payload);
    onSubmit(payload);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[92%] rounded-t-3xl bg-surface p-5">
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Body className="text-lg font-semibold">
                Take something off
              </Body>
              <Muted className="text-xs">
                This sale is {money(total)}.
              </Muted>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="X" size={22} color={COLORS.navy} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Muted className="mb-2 text-[11px] font-semibold tracking-wider">
              WHY?
            </Muted>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {reasons.map((r) => {
                const active = reasonCode === r.code;
                return (
                  <Pressable
                    key={r.code}
                    onPress={() => setReasonCode(r.code)}
                    testID={`discount-reason-${r.code}`}
                    className={`rounded-full border px-3 py-2 ${
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
                      {r.label}
                      <Muted className="text-[10px]">
                        {" "}
                        · {r.maxPercent}%
                      </Muted>
                    </Body>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setFree((v) => !v)}
              className="mb-4 flex-row items-center gap-2 py-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              testID="discount-free"
            >
              <View
                className={`h-4 w-4 items-center justify-center rounded border ${
                  free ? "border-brand bg-brand" : "border-line"
                }`}
              >
                {free && <Icon name="Check" size={10} color={COLORS.white} />}
              </View>
              <Body className="text-sm text-navy">Make it free</Body>
            </Pressable>

            {!free && (
              <>
                <Muted className="mb-2 text-[11px] font-semibold tracking-wider">
                  HOW MUCH OFF (%)
                </Muted>
                <TextInput
                  className="mb-2 rounded-xl border border-line bg-canvas p-3 text-lg tabular-nums"
                  keyboardType="number-pad"
                  value={percent}
                  onChangeText={(t) =>
                    setPercent(t.replace(/[^0-9]/g, "").slice(0, 3))
                  }
                  placeholder="10"
                  testID="discount-percent"
                />
                {reason && (
                  <Muted className="mb-4 text-[11px]">
                    Max {reason.maxPercent}% for "{reason.label}"
                  </Muted>
                )}
                {overCeiling && reason && (
                  <Muted className="mb-4 text-xs text-danger">
                    That's too much — max is {reason.maxPercent}%.
                  </Muted>
                )}
              </>
            )}

            <Muted className="mb-2 text-[11px] font-semibold tracking-wider">
              NOTES
            </Muted>
            <TextInput
              className="mb-4 min-h-[80px] rounded-xl border border-line bg-canvas p-3"
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="Add a note for the record"
              testID="discount-note"
            />

            <Card className="mb-3 p-3">
              <View className="flex-row justify-between py-1">
                <Muted className="text-sm">Original</Muted>
                <Amount>{money(total)}</Amount>
              </View>
              <View className="flex-row justify-between py-1">
                <Muted className="text-sm">Discount ({asked}%)</Muted>
                <Amount className="text-success">
                  -{money(offAmount)}
                </Amount>
              </View>
              <View className="mt-1 flex-row justify-between border-t border-line pt-2">
                <Body className="font-semibold">New total</Body>
                <Amount className="text-xl text-navy">
                  {money(newTotal)}
                </Amount>
              </View>
            </Card>
          </ScrollView>

          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center justify-center rounded-xl2 border border-line bg-surface py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Body className="text-navy">Cancel</Body>
            </Pressable>

            <Pressable
              onPress={submit}
              disabled={!ready || submitting}
              testID="discount-apply"
              className="flex-1 flex-row items-center justify-center rounded-xl2 bg-brand py-3"
              style={({ pressed }) => ({
                opacity: !ready || submitting ? 0.5 : pressed ? 0.7 : 1,
              })}
            >
              <Icon
                name={free ? "Gift" : "BadgeDollarSign"}
                size={15}
                color={COLORS.white}
              />
              <Body className="ml-2 text-white">
                {submitting
                  ? "Applying…"
                  : free
                  ? "Make it free"
                  : `Take ${asked}% off`}
              </Body>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}