import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { apiMessage } from "@/api/client";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Amount,
  Body,
  Button,
  Card,
  CheckRow,
  Label,
  Loading,
  Muted,
  Notice,
  OptionRow,
  Ref,
  Screen,
  Section,
  StepBar,
  Stepper,
  toast,
  type WizardStep,
} from "@/components/ui";
import { CustomerPicker } from "@/features/sell/CustomerPicker";
import { PaymentPanel, usePaymentSplits } from "@/features/sell/PaymentPanel";
import {
  useCreateBooking,
  useOrder,
  usePay,
  useProducts,
  useTransition,
} from "@/hooks/queries";
import { engineLabel } from "@/config/engines";
import { money } from "@/lib/format";
import { COLORS } from "@/theme/tokens";
import type { Booking, Customer, EngineKind, Product } from "@/types";

const STEPS: WizardStep[] = [
  { key: "product", label: "Product" },
  { key: "customer", label: "Customer" },
  { key: "payment", label: "Payment" },
  { key: "fulfil", label: "Hand over" },
];

const FULFILMENT: Partial<
  Record<
    EngineKind,
    {
      code: string;
      label: string;
      prompt: string;
      flag: "inspectionDone" | "boardingVerified" | "safetyAck";
    }
  >
> = {
  MOBILITY: {
    code: "TO_HANDOVER",
    label: "Confirm handover & start",
    prompt: "Condition inspection captured",
    flag: "inspectionDone",
  },
  LAGOON: {
    code: "TO_STARTED",
    label: "Verify boarding & start",
    prompt: "Boarding count verified",
    flag: "boardingVerified",
  },
  ANAAM: {
    code: "TO_STARTED",
    label: "Confirm safety & start",
    prompt: "Safety checklist signed",
    flag: "safetyAck",
  },
};

export default function Rental() {
  const params = useLocalSearchParams<{ engine?: string }>();
  const engine = (params.engine as EngineKind) ?? "MOBILITY";
  const fulfilment = FULFILMENT[engine];

  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [duration, setDuration] = useState(1);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const products = useProducts(engine);
  const create = useCreateBooking();
  const pay = usePay();
  const transition = useTransition();
  const order = useOrder(booking?.id);
  const payment = usePaymentSplits(order.data ?? null);

  const startBooking = () => {
    if (!customer || !product) return;
    create.mutate(
      {
        customerId: customer._id,
        engineKind: engine,
        productId: product._id,
        durationMin: duration * 60,
        quantity: 1,
      },
      {
        onSuccess: (result) => {
          setBooking(result.booking);
          setStep(2);
        },
        onError: (e) =>
          toast("danger", "Could not create the booking", apiMessage(e)),
      },
    );
  };

  const confirmPayment = () => {
    if (!booking) return;
    pay.mutate(
      { id: booking.id, splits: payment.splits },
      {
        onSuccess: () => {
          toast(
            "success",
            "Payment taken",
            fulfilment ? "Now hand it over to start the clock." : undefined,
          );
          setStep(3);
        },
        onError: (e) => toast("danger", "Payment refused", apiMessage(e)),
      },
    );
  };

  const handOver = () => {
    if (!booking || !fulfilment) return;
    transition.mutate(
      {
        id: booking.id,
        code: fulfilment.code,
        payload: { [fulfilment.flag]: true, durationMin: duration * 60 },
      },
      {
        onSuccess: () => {
          toast("success", "Handed over", "The session is running.");
          router.replace({
            pathname: "/booking/[id]",
            params: { id: booking.id },
          });
        },
        onError: (e) => toast("danger", "Could not start", apiMessage(e)),
      },
    );
  };

  return (
    <Screen scroll testID="rental" footer={<Footer />}>
      <AppHeader
        back
        title={engineLabel(engine)}
        subtitle="Rent something out"
      />

      <View className="mb-4">
        <StepBar
          steps={STEPS}
          current={step}
          onStep={setStep}
          canRevisit={(index) => index < step && !booking}
        />
      </View>

      {step === 0 ? (
        <Section title="What are they taking">
          {products.isLoading ? (
            <Loading />
          ) : (
            <View className="gap-2">
              {(products.data ?? [])
                .filter((p) => p.active)
                .map((item) => (
                  <OptionRow
                    key={item._id}
                    selected={product?._id === item._id}
                    onPress={() => setProduct(item)}
                    title={item.name}
                    subtitle={
                      item.depositRequired > 0
                        ? `Deposit ${money(item.depositRequired)}`
                        : item.category
                    }
                    trailing={<Amount>{money(item.basePrice)}</Amount>}
                    testID={`rental-product-${item._id}`}
                  />
                ))}
            </View>
          )}
        </Section>
      ) : null}

      {step === 1 ? (
        <Section title="Who is taking it">
          <View className="gap-3">
            <CustomerPicker
              selected={customer}
              onSelect={setCustomer}
              testID="rental-customer"
            />
            <Card>
              <View className="flex-row items-center justify-between">
                <View>
                  <Label>How long</Label>
                  <Muted>Hours</Muted>
                </View>
                <Stepper
                  value={duration}
                  onChange={setDuration}
                  min={1}
                  max={12}
                  suffix="hours"
                  testID="rental-duration"
                />
              </View>
            </Card>
          </View>
        </Section>
      ) : null}

      {step === 2 ? (
        <Section title="Take payment">
          {order.isLoading ? (
            <Loading />
          ) : (
            <PaymentPanel
              order={order.data ?? null}
              state={payment}
              testID="rental-payment"
            />
          )}
        </Section>
      ) : null}

      {step === 3 && booking ? (
        <Section title="Hand it over">
          <View className="gap-3">
            <Card>
              <View className="gap-1">
                <Label>Booking</Label>
                <Ref className="text-lg">{booking.ref}</Ref>
                <Muted>{booking.productName}</Muted>
              </View>
            </Card>

            {fulfilment ? (
              <>
                <Notice tone="warn">
                  <Body>
                    The clock starts when you confirm this, not when the
                    customer paid. Tick it only once it is actually done.
                  </Body>
                </Notice>
                <CheckRow
                  checked={acknowledged}
                  onChange={setAcknowledged}
                  title={fulfilment.prompt}
                  subtitle="The server refuses the handover without it."
                  testID="rental-ack"
                />
              </>
            ) : (
              <Notice tone="info">
                <Body>
                  This activity has no handover step — the order is already on
                  its way.
                </Body>
              </Notice>
            )}
          </View>
        </Section>
      ) : null}
    </Screen>
  );

  function Footer() {
    if (step === 0) {
      return (
        <Button
          label="Continue"
          size="lg"
          full
          disabled={!product}
          onPress={() => setStep(1)}
          testID="rental-next-product"
        />
      );
    }
    if (step === 1) {
      return (
        <Button
          label="Continue to payment"
          size="lg"
          full
          disabled={!customer}
          loading={create.isPending}
          onPress={startBooking}
          testID="rental-next-customer"
        />
      );
    }
    if (step === 2) {
      return (
        <Button
          label={`Take ${money(payment.total)}`}
          size="lg"
          full
          disabled={!payment.ready}
          loading={pay.isPending}
          onPress={confirmPayment}
          testID="rental-pay"
        />
      );
    }
    return fulfilment ? (
      <Button
        label={fulfilment.label}
        size="lg"
        full
        disabled={!acknowledged}
        loading={transition.isPending}
        icon={<Icon name="PackageCheck" size={18} color={COLORS.white} />}
        onPress={handOver}
        testID="rental-handover"
      />
    ) : (
      <Button
        label="Open the booking"
        size="lg"
        full
        onPress={() =>
          booking &&
          router.replace({
            pathname: "/booking/[id]",
            params: { id: booking.id },
          })
        }
        testID="rental-open-booking"
      />
    );
  }
}
