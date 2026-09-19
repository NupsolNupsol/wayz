// src/components/DiscountButton.tsx
import { useState } from "react";
import { Alert, Pressable } from "react-native";

import { Icon } from "@/components/Icon";
import { Body } from "@/components/ui";
import { DiscountModal } from "@/components/DiscountModal";
import { useDiscountBooking } from "@/hooks/queries";
import { useSessionStore } from "@/store/session.store";
import { COLORS } from "@/theme/tokens";

interface Props {
  bookingId: string;
  total: number;
  onDone?: () => void;
}

export function DiscountButton({ bookingId, total, onDone }: Props) {
  const reasons = useSessionStore(
    (s) => s.me?.tenant?.discountReasons ?? []
  );
  const discount = useDiscountBooking();
  const [open, setOpen] = useState(false);

  if (reasons.length === 0) return null;

  const handleSubmit = (payload: {
    reasonCode: string;
    percent: number;
    note?: string;
  }) => {
    const body = {
      id: bookingId,
      reasonCode: payload.reasonCode,
      percent: payload.percent,
      note: payload.note,
    };
    console.log("🎯 [DiscountButton] → sending:", body);

    discount.mutate(body, {
      onSuccess: (res) => {
        console.log(
          "🎯 [DiscountButton] ← success:",
          JSON.stringify(res, null, 2)
        );
        setOpen(false);
        onDone?.();
      },
      onError: (e: any) => {
        console.log("🎯 [DiscountButton] ← error:", e);
        Alert.alert("Refusé", e?.message || "Essayez encore");
      },
    });
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-center rounded-xl2 border border-line bg-surface px-4 py-2"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        testID="discount-open"
      >
        <Icon name="BadgeDollarSign" size={15} color={COLORS.navy} />
        <Body className="ml-2 text-navy">Discount</Body>
      </Pressable>

      <DiscountModal
        visible={open}
        total={total}
        reasons={reasons}
        submitting={discount.isPending}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}