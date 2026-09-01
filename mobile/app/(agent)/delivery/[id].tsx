import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { apiMessage } from "@/api/client";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Body,
  Button,
  Card,
  CheckRow,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Ref,
  Screen,
  Section,
  Sheet,
  StatusPill,
  TextArea,
  toast,
} from "@/components/ui";
import { useDelivery, useDeliveryTransition } from "@/hooks/queries";
import { formatDateTime, relativeTime } from "@/lib/format";
import { COLORS } from "@/theme/tokens";

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useDelivery(id);
  const move = useDeliveryTransition();

  const [releaseOpen, setReleaseOpen] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [code, setCode] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (detail.isLoading) {
    return (
      <Screen testID="delivery">
        <Loading />
      </Screen>
    );
  }

  const data = detail.data;
  if (!data) {
    return (
      <Screen testID="delivery">
        <AppHeader title="Delivery" back />
        <EmptyState
          title="Delivery not found"
          message="It may belong to another station."
        />
      </Screen>
    );
  }

  const d = data.delivery;
  const can = (code: string) => data.transitions.some((t) => t.code === code);
  const waiting = d.status === "RELEASE_REQUESTED";

  const release = () => {
    move.mutate(
      {
        id: d._id,
        code: "TO_RELEASE_APPROVED",
        payload: { compartmentCode: code.trim() },
      },
      {
        onSuccess: () => {
          toast(
            "success",
            "Compartment released",
            "The courier has the code for 15 minutes.",
          );
          setReleaseOpen(false);
          setIdentityChecked(false);
          setCode("");
        },
        onError: (e) => toast("danger", "Not released", apiMessage(e)),
      },
    );
  };

  const cancel = () => {
    move.mutate(
      { id: d._id, code: "TO_CANCELLED", payload: { reason: reason.trim() } },
      {
        onSuccess: () => {
          toast("warn", "Delivery cancelled");
          setCancelOpen(false);
          setReason("");
        },
        onError: (e) => toast("danger", "Could not cancel", apiMessage(e)),
      },
    );
  };

  return (
    <Screen
      scroll
      onRefresh={() => void detail.refetch()}
      refreshing={detail.isFetching}
      testID="delivery"
    >
      <AppHeader
        back
        title={d.bookingRef}
        subtitle={d.customerName}
        actions={<StatusPill status={d.status} />}
      />

      {waiting ? (
        <Notice tone="warn" testID="delivery-waiting">
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Icon name="Truck" size={18} color={COLORS.warn} />
              <Body className="flex-1 font-semibold">
                A courier is at your desk for these bags.
              </Body>
            </View>
            <Body>
              Check that the person in front of you is{" "}
              <Body className="font-bold">
                {d.assignedToName ?? "the assigned courier"}
              </Body>{" "}
              before you open anything.
            </Body>
          </View>
        </Notice>
      ) : null}

      <Section title="Where it is going" className="mt-4">
        <Card>
          <View className="gap-3">
            <View className="flex-row items-start gap-2">
              <Icon name="MapPin" size={16} color={COLORS.brand} />
              <Body className="flex-1 font-semibold">
                {d.destination.address}
              </Body>
            </View>
            {d.destination.notes ? <Muted>{d.destination.notes}</Muted> : null}
            <View className="flex-row items-center gap-2">
              <Icon name="Phone" size={14} color={COLORS.faint} />
              <Muted>{d.destination.contactPhone || d.customerPhone}</Muted>
            </View>
          </View>
        </Card>
      </Section>

      <Section title="The job" className="mt-4">
        <Card>
          <View className="flex-row flex-wrap gap-4">
            <KeyValue
              label="Courier"
              value={d.assignedToName ?? "Not claimed yet"}
              className="min-w-[45%]"
            />
            <KeyValue
              label="Compartment"
              value={d.assetUnitIdentifier ?? "—"}
              className="min-w-[45%]"
            />
            <KeyValue
              label="Raised"
              value={relativeTime(d.requestedAt)}
              className="min-w-[45%]"
            />
            <KeyValue
              label="How it was asked for"
              value={
                d.origin === "AT_STORAGE"
                  ? "At the desk"
                  : "By phone — verified"
              }
              className="min-w-[45%]"
            />
          </View>
        </Card>
      </Section>

      {data.bags.length > 0 ? (
        <Section title={`Bags (${data.bags.length})`} className="mt-4">
          <Card>
            <View className="gap-2">
              {data.bags.map((bag) => (
                <View
                  key={bag.barcode}
                  className="flex-row items-center gap-3 rounded-2xl border border-line p-3"
                >
                  <View className="min-w-0 flex-1">
                    <Body className="font-semibold" numberOfLines={1}>
                      {bag.description || `Bag ${bag.index}`}
                    </Body>
                    {/* The courier never sees these, so a scan means they physically held the bag. */}
                    <Ref className="text-[12px] text-muted">{bag.barcode}</Ref>
                  </View>
                  <StatusPill status={bag.status} size="sm" />
                </View>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}

      <View className="mt-5 gap-2">
        {can("TO_RELEASE_APPROVED") ? (
          <Button
            label="Check the courier & release"
            size="lg"
            full
            onPress={() => setReleaseOpen(true)}
            testID="delivery-release-open"
          />
        ) : null}
        {can("TO_CANCELLED") ? (
          <Button
            label="Cancel this delivery"
            variant="secondary"
            full
            onPress={() => setCancelOpen(true)}
            testID="delivery-cancel-open"
          />
        ) : null}
      </View>

      {d.compartmentCode && d.status === "RELEASE_APPROVED" ? (
        <Notice tone="info" testID="delivery-code-issued">
          <Body>
            The code is on the courier&apos;s phone until{" "}
            {formatDateTime(d.compartmentCodeExpiresAt)}. If it expires, approve
            again.
          </Body>
        </Notice>
      ) : null}

      <Sheet
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        title="Release the compartment"
        subtitle="Two things have to be true before this opens."
        testID="delivery-release-sheet"
        footer={
          <Button
            label="Release"
            size="lg"
            full
            disabled={!identityChecked || code.trim().length < 3}
            loading={move.isPending}
            onPress={release}
            testID="delivery-release-submit"
          />
        }
      >
        <CheckRow
          checked={identityChecked}
          onChange={setIdentityChecked}
          title={`This is ${d.assignedToName ?? "the assigned courier"}`}
          subtitle="Check their ID against the name on the job. A courier can never approve their own collection."
          testID="delivery-identity-check"
        />

        <Field
          label="Compartment unlock code"
          hint="Read it off the kiosk. It is never derived from the compartment number."
        >
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="e.g. 4821"
            keyboardType="number-pad"
            testID="delivery-code"
          />
        </Field>
      </Sheet>

      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this delivery"
        subtitle="It stays on the record with your reason."
        testID="delivery-cancel-sheet"
        footer={
          <Button
            label="Cancel the delivery"
            variant="danger"
            size="lg"
            full
            disabled={reason.trim().length < 3}
            loading={move.isPending}
            onPress={cancel}
            testID="delivery-cancel-submit"
          />
        }
      >
        <Field label="Why" required>
          <TextArea
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. The customer came to collect in person"
            testID="delivery-cancel-reason"
          />
        </Field>
      </Sheet>
    </Screen>
  );
}
