import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { apiMessage } from "@/api/client";
import { catalogueApi, type BagInput } from "@/api/endpoints";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Amount,
  Body,
  Button,
  Card,
  Input,
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
import { StoreSheet } from "@/features/booking/StoreSheet";
import { CustomerPicker } from "@/features/sell/CustomerPicker";
import { PaymentPanel, usePaymentSplits } from "@/features/sell/PaymentPanel";
import {
  useCreateBooking,
  useOrder,
  usePay,
  useProducts,
  useReserve,
  useUnits,
} from "@/hooks/queries";
import { money } from "@/lib/format";
import { COLORS } from "@/theme/tokens";
import type { Booking, Customer, PackingSuggestion } from "@/types";

const STEPS: WizardStep[] = [
  { key: "customer", label: "Customer" },
  { key: "bags", label: "Bags" },
  { key: "plan", label: "Plan" },
  { key: "payment", label: "Payment" },
  { key: "store", label: "Store" },
];

interface BagRow {
  description: string;
  weight: number;
}

export default function ShopDrop() {
  const [step, setStep] = useState(0);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bags, setBags] = useState<BagRow[]>([{ description: "", weight: 8 }]);
  const [duration, setDuration] = useState(2);
  const [suggestions, setSuggestions] = useState<PackingSuggestion[]>([]);
  const [chosen, setChosen] = useState<PackingSuggestion | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);

  const products = useProducts("SHOP_AND_DROP");
  const units = useUnits();
  const create = useCreateBooking();
  const pay = usePay();
  const reserve = useReserve();
  const order = useOrder(booking?.id);
  const payment = usePaymentSplits(order.data ?? null);

  const bagInputs = useMemo<BagInput[]>(
    () =>
      bags.map((bag, index) => ({
        description: bag.description.trim() || `Bag ${index + 1}`,
        weight: bag.weight,
      })),
    [bags],
  );

  const suggest = async () => {
    try {
      const result = await catalogueApi.packingSuggestions(bagInputs);
      setSuggestions(result.suggestions);
      setChosen(
        result.suggestions.find((s) => s.recommended) ??
          result.suggestions[0] ??
          null,
      );
      setStep(2);
    } catch (e) {
      toast("danger", "Could not work out a plan", apiMessage(e));
    }
  };

  const takePayment = () => {
    if (!customer || !chosen) return;

    const product =
      products.data?.find((p) => p.assetTypeId === chosen.assetTypeId) ??
      products.data?.[0];
    if (!product) {
      toast(
        "danger",
        "No product to sell",
        "This station has no Shop & Drop pricing set up.",
      );
      return;
    }

    create.mutate(
      {
        customerId: customer._id,
        engineKind: "SHOP_AND_DROP",
        productId: product._id,
        durationMin: duration * 60,
        bags: bagInputs,
        metadata: { assetTypeId: chosen.assetTypeId },
      },
      {
        onSuccess: (result) => {
          setBooking(result.booking);
          setStep(3);
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
            "The timer does not start until the bags are scanned in.",
          );
          reserve.mutate(
            { id: booking.id },
            {
              onSuccess: (reserved) => {
                setBooking(reserved);
                setStep(4);
              },
              onError: (e) =>
                toast(
                  "danger",
                  "Could not reserve a compartment",
                  apiMessage(e),
                ),
            },
          );
        },
        onError: (e) => toast("danger", "Payment refused", apiMessage(e)),
      },
    );
  };

  const reservedUnit = units.data?.find(
    (u) =>
      u._id === (booking?.reservation?.assetUnitId ?? booking?.assetUnitId),
  );

  return (
    <Screen scroll testID="shop-drop" footer={<Footer />}>
      <AppHeader
        back
        title="Shop & Drop"
        subtitle="Bag storage, start to finish"
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
        <Section title="Who is the customer">
          <CustomerPicker
            selected={customer}
            onSelect={setCustomer}
            testID="sd-customer"
          />
        </Section>
      ) : null}

      {step === 1 ? (
        <Section title="What are they leaving">
          <View className="gap-3">
            <Muted>
              The weight and count decide which compartment fits. Each bag gets
              one unique barcode; several bags can share a compartment.
            </Muted>

            {bags.map((bag, index) => (
              <Card key={index} testID={`sd-bag-${index + 1}`}>
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Label>Bag {index + 1}</Label>
                    {bags.length > 1 ? (
                      <Body
                        className="font-semibold text-danger"
                        onPress={() =>
                          setBags((prev) => prev.filter((_, i) => i !== index))
                        }
                        testID={`sd-bag-remove-${index + 1}`}
                      >
                        Remove
                      </Body>
                    ) : null}
                  </View>

                  <Input
                    value={bag.description}
                    onChangeText={(value) =>
                      setBags((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, description: value } : b,
                        ),
                      )
                    }
                    placeholder={`Bag ${index + 1} — e.g. Black cabin case`}
                    testID={`sd-bag-desc-${index + 1}`}
                  />

                  <View className="flex-row items-center justify-between">
                    <Label>Weight (kg)</Label>
                    <Stepper
                      value={bag.weight}
                      onChange={(value) =>
                        setBags((prev) =>
                          prev.map((b, i) =>
                            i === index ? { ...b, weight: value } : b,
                          ),
                        )
                      }
                      min={1}
                      max={40}
                      testID={`sd-bag-weight-${index + 1}`}
                    />
                  </View>
                </View>
              </Card>
            ))}

            <Button
              label="Add another bag"
              variant="secondary"
              onPress={() =>
                setBags((prev) => [...prev, { description: "", weight: 8 }])
              }
              testID="sd-add-bag"
            />
          </View>
        </Section>
      ) : null}

      {step === 2 ? (
        <Section title="Where it fits">
          <View className="gap-3">
            <Card>
              <View className="flex-row items-center justify-between">
                <View>
                  <Label>How long</Label>
                  <Muted>Hours of storage</Muted>
                </View>
                <Stepper
                  value={duration}
                  onChange={setDuration}
                  min={1}
                  max={24}
                  suffix="hours"
                  testID="sd-duration"
                />
              </View>
            </Card>

            {suggestions.length === 0 ? (
              <Loading label="Working out the best fit…" />
            ) : (
              suggestions.map((suggestion) => (
                <OptionRow
                  key={suggestion.assetTypeId}
                  selected={chosen?.assetTypeId === suggestion.assetTypeId}
                  onPress={() => setChosen(suggestion)}
                  title={`${suggestion.assetTypeName}${suggestion.recommended ? " · best fit" : ""}`}
                  subtitle={suggestion.priceCalculationSummary}
                  testID={`sd-plan-${suggestion.assetTypeId}`}
                />
              ))
            )}
          </View>
        </Section>
      ) : null}

      {step === 3 ? (
        <Section title="Take payment">
          {order.isLoading ? (
            <Loading />
          ) : (
            <PaymentPanel
              order={order.data ?? null}
              state={payment}
              testID="sd-payment"
            />
          )}
        </Section>
      ) : null}

      {step === 4 && booking ? (
        <Section title="Assign & store">
          <View className="gap-3">
            <Notice tone="info">
              <Body>
                Paying confirmed the booking. The clock starts only when you
                scan the compartment and every bag.
              </Body>
            </Notice>

            <Card>
              <View className="gap-2">
                <Label>Reserved compartment</Label>
                <Ref className="text-lg">
                  {reservedUnit?.identifier ?? "Reserving…"}
                </Ref>
                <Muted>{booking.packingPlan?.priceCalculationSummary}</Muted>
              </View>
            </Card>

            <Card>
              <View className="gap-2">
                <Label>Bag labels</Label>
                {booking.bags.map((bag) => (
                  <View
                    key={bag.barcode}
                    className="flex-row items-center justify-between gap-3"
                  >
                    <Body className="flex-1" numberOfLines={1}>
                      {bag.description}
                    </Body>
                    <Ref className="text-[12px] text-muted">{bag.barcode}</Ref>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </Section>
      ) : null}

      {booking ? (
        <StoreSheet
          open={storeOpen}
          onClose={() => setStoreOpen(false)}
          booking={booking}
          unitIdentifier={reservedUnit?.identifier ?? null}
        />
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
          disabled={!customer}
          onPress={() => setStep(1)}
          testID="sd-next-customer"
        />
      );
    }

    if (step === 1) {
      return (
        <Button
          label="Find the best compartment"
          size="lg"
          full
          disabled={bags.length === 0}
          onPress={() => void suggest()}
          testID="sd-next-bags"
        />
      );
    }

    if (step === 2) {
      return (
        <View className="gap-2">
          {chosen ? (
            <View className="flex-row items-center justify-between">
              <Muted>{chosen.assetTypeName}</Muted>
              <Amount>
                {chosen.totalPrice !== undefined
                  ? money(chosen.totalPrice)
                  : ""}
              </Amount>
            </View>
          ) : null}
          <Button
            label="Continue to payment"
            size="lg"
            full
            disabled={!chosen}
            loading={create.isPending}
            onPress={takePayment}
            testID="sd-next-plan"
          />
        </View>
      );
    }

    if (step === 3) {
      return (
        <Button
          label={`Take ${money(payment.total)}`}
          size="lg"
          full
          disabled={!payment.ready}
          loading={pay.isPending || reserve.isPending}
          onPress={confirmPayment}
          testID="sd-pay"
        />
      );
    }

    return (
      <View className="gap-2">
        <Button
          label="Scan in & confirm storage"
          size="lg"
          full
          icon={<Icon name="ScanLine" size={18} color={COLORS.white} />}
          onPress={() => setStoreOpen(true)}
          testID="sd-store"
        />
        <Button
          label="Open the booking"
          variant="secondary"
          full
          onPress={() =>
            booking &&
            router.replace({
              pathname: "/booking/[id]",
              params: { id: booking.id },
            })
          }
          testID="sd-open-booking"
        />
      </View>
    );
  }
}
