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
  EmptyState,
  Field,
  Input,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Screen,
  Section,
  StatusPill,
  toast,
} from "@/components/ui";
import { useBlindCount, useOpenShift, useShift } from "@/hooks/queries";
import { formatDateTime, money } from "@/lib/format";
import { COLORS } from "@/theme/tokens";

export default function ShiftScreen() {
  const shift = useShift();
  const open = useOpenShift();
  const count = useBlindCount();

  const [counted, setCounted] = useState("");

  if (shift.isLoading) {
    return (
      <Screen testID="shift">
        <Loading />
      </Screen>
    );
  }

  const s = shift.data;

  if (!s || s.status === "CLOSED") {
    return (
      <Screen scroll testID="shift">
        <AppHeader
          back
          title="Shift & cash"
          subtitle="Open a till before taking cash"
        />
        <EmptyState
          icon={<Icon name="Wallet" size={24} color={COLORS.faint} />}
          title="No open till"
          message="The platform accumulates expected cash against an open till. Without one, the end of day will not balance."
          action={
            <Button
              label="Open my till"
              loading={open.isPending}
              onPress={() =>
                open.mutate(undefined, {
                  onSuccess: () =>
                    toast(
                      "success",
                      "Till open",
                      "Cash you take is now counted against it.",
                    ),
                  onError: (e) =>
                    toast("danger", "Could not open the till", apiMessage(e)),
                })
              }
              testID="shift-open"
            />
          }
          testID="shift-empty"
        />
      </Screen>
    );
  }

  const awaiting = s.status === "AWAITING_APPROVAL";
  const counted_ = s.countedCash !== null;

  return (
    <Screen
      scroll
      onRefresh={() => void shift.refetch()}
      refreshing={shift.isFetching}
      testID="shift"
    >
      <AppHeader
        back
        title="Shift & cash"
        subtitle="Your till at this counter"
        actions={<StatusPill status={s.status} />}
      />

      <Section title="This till" className="mb-4">
        <Card>
          <View className="flex-row flex-wrap gap-4">
            <KeyValue
              label="Opened"
              value={formatDateTime(s.openedAt)}
              className="min-w-[45%]"
            />
            <KeyValue
              label="Status"
              value={s.status.replaceAll("_", " ").toLowerCase()}
              className="min-w-[45%]"
            />
            {counted_ ? (
              <>
                <KeyValue
                  label="You counted"
                  value={money(s.countedCash)}
                  className="min-w-[45%]"
                />
                <KeyValue
                  label="Expected"
                  value={money(s.expectedCash)}
                  className="min-w-[45%]"
                />
              </>
            ) : null}
          </View>

          {counted_ && s.variance !== null ? (
            <View className="mt-4 rounded-2xl border border-line p-3">
              <Muted>Variance</Muted>
              <Amount
                className={`text-2xl ${Math.abs(s.variance) > 0.009 ? "text-danger" : "text-success"}`}
              >
                {money(s.variance)}
              </Amount>
            </View>
          ) : null}
        </Card>
      </Section>

      {!counted_ ? (
        <Section title="Count the drawer">
          <Card>
            <View className="gap-4">
              <Notice tone="info">
                <Body>
                  Count what is physically in the drawer and enter it. You are
                  not shown the expected figure first — that is what makes it a
                  blind count.
                </Body>
              </Notice>

              <Field label="Counted cash (SAR)" required>
                <Input
                  value={counted}
                  onChangeText={setCounted}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  testID="shift-counted"
                />
              </Field>

              <Button
                label="Submit the count"
                size="lg"
                full
                disabled={!counted.trim() || Number.isNaN(Number(counted))}
                loading={count.isPending}
                onPress={() =>
                  count.mutate(
                    { id: s._id, countedCash: Number(counted) },
                    {
                      onSuccess: (result) => {
                        setCounted("");
                        const off = Math.abs(result.variance ?? 0) > 0.009;
                        toast(
                          off ? "warn" : "success",
                          off
                            ? "Counted — there is a variance"
                            : "Counted — it balances",
                          off ? "Your manager signs this off." : undefined,
                        );
                      },
                      onError: (e) =>
                        toast(
                          "danger",
                          "Could not submit the count",
                          apiMessage(e),
                        ),
                    },
                  )
                }
                testID="shift-count-submit"
              />
            </View>
          </Card>
        </Section>
      ) : awaiting ? (
        <Notice tone="warn" testID="shift-awaiting">
          <Body>
            This till is waiting for your manager. You cannot sign off your own
            variance, and it cannot take more cash until they do.
          </Body>
        </Notice>
      ) : (
        <Notice tone="success" testID="shift-done">
          <Body>
            The count is in and it balanced. Nothing further is needed from you.
          </Body>
        </Notice>
      )}
    </Screen>
  );
}
