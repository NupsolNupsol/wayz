// app/(agent)/refunds.tsx
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
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
import { useRefundRequests, useReviewRefundRequest } from "@/hooks/queries";
import { COLORS } from "@/theme/tokens";
import { formatDate, formatTime, money } from "@/lib/format";
import type { RefundRequest, RefundRequestStatus } from "@/api/endpoints";

type Filter = "ALL" | RefundRequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const TONE: Record<RefundRequestStatus, "info" | "success" | "danger"> = {
  PENDING: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

export default function RefundRequestsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");

  const query = useRefundRequests(
    filter === "ALL" ? undefined : { status: filter },
  );
  const review = useReviewRefundRequest();

  const [reviewing, setReviewing] = useState<RefundRequest | null>(null);
  const [note, setNote] = useState("");

  const rows = query.data?.rows ?? [];
  const canApprove = query.data?.canApprove ?? false;
  const pendingTotal = query.data?.pendingTotal ?? 0;

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "PENDING").length,
    [rows],
  );

  const closeReview = () => {
    setReviewing(null);
    setNote("");
  };

  const decide = (approve: boolean) => {
    if (!reviewing) return;
    review.mutate(
      {
        id: reviewing._id,
        approve,
        note: note.trim() || undefined,
      },
      { onSuccess: closeReview },
    );
  };

  if (query.isLoading && !query.data) {
    return (
      <Screen testID="refund-requests">
        {/* <AppHeader title="Refund Requests" showBack /> */}
        <Loading label="Loading requests…" />
      </Screen>
    );
  }

  return (
    <Screen testID="refund-requests">
      {/* <AppHeader
        title="Refund Requests"
        showBack
        actions={
          <Pressable
            onPress={() => query.refetch()}
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas"
          >
            <Icon name="RefreshCw" size={18} color={COLORS.navy} />
          </Pressable>
        }
      /> */}

      {/* Filter chips */}
      <View className="mb-4 flex-row flex-wrap gap-2 px-4">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              testID={`refund-status-${f.value}`}
              className={`rounded-full border px-3 py-1.5 ${
                active ? "border-brand bg-brand" : "border-line bg-surface"
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Body
                className={`text-xs ${active ? "text-white" : "text-navy"}`}
              >
                {f.label}
              </Body>
            </Pressable>
          );
        })}
      </View>

      {/* Stats — 2 per row */}
      <View className="mb-4 px-4">
        <View className="flex-row gap-3">
          <Stat
            label="AWAITING"
            value={String(pendingCount)}
            icon="Undo2"
            tone="info"
            testID="refund-requests-pending-count"
          />
          <Stat
            label="AWAITING VALUE"
            value={money(pendingTotal)}
            icon="CircleDollarSign"
            tone="warning"
            testID="refund-requests-pending-total"
          />
        </View>
      </View>

      {/* List */}
      <Section title={`Requests (${rows.length})`} className="mb-8 px-4">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="Undo2" size={24} color={COLORS.faint} />}
              title="No refund requests"
              message="Nothing waiting — requests will show up here."
              testID="refund-requests-empty"
            />
          </Card>
        ) : (
          <View>
            {rows.map((r, index) => (
              <View key={r._id}>
                {index > 0 && <View className="h-2" />}
                <RefundRow
                  request={r}
                  canApprove={canApprove}
                  onReview={() => {
                    setReviewing(r);
                    setNote("");
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Review modal */}
      <Modal
        visible={!!reviewing}
        transparent
        animationType="slide"
        onRequestClose={closeReview}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[85%] rounded-t-3xl bg-surface p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Body className="text-lg font-semibold">Review refund</Body>
                <Muted className="text-xs">{reviewing?.ref ?? ""}</Muted>
              </View>
              <Pressable onPress={closeReview} hitSlop={10}>
                <Icon name="X" size={22} color={COLORS.navy} />
              </Pressable>
            </View>

            <ScrollView>
              <Card className="mb-4 p-3">
                <View className="flex-row items-baseline justify-between py-1">
                  <Muted className="text-sm">Amount</Muted>
                  <Amount>{money(reviewing?.amount ?? 0)}</Amount>
                </View>
                <View className="flex-row items-baseline justify-between py-1">
                  <Muted className="text-sm">Booking</Muted>
                  <Body>{reviewing?.bookingRef ?? "—"}</Body>
                </View>
                <View className="flex-row items-baseline justify-between py-1">
                  <Muted className="text-sm">Customer</Muted>
                  <Body>{reviewing?.customerName ?? "—"}</Body>
                </View>
                <View className="mt-2 border-t border-line pt-2">
                  <Muted className="text-xs">Reason</Muted>
                  <Body className="mt-1 text-sm">
                    {reviewing?.reason ?? "—"}
                  </Body>
                </View>
              </Card>

              <Body className="mb-1 font-semibold">
                Note (required to refuse)
              </Body>
              <TextInput
                className="min-h-[80px] rounded-xl border border-line bg-canvas p-3"
                multiline
                value={note}
                onChangeText={setNote}
                placeholder="Explain your decision…"
                testID="refund-note"
              />
              <Muted className="mt-1 text-xs">
                Add a short note for the desk.
              </Muted>
            </ScrollView>

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={closeReview}
                className="flex-1 items-center justify-center rounded-xl2 border border-line bg-surface py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Body className="text-navy">Cancel</Body>
              </Pressable>

              <Pressable
                onPress={() => decide(false)}
                disabled={note.trim().length === 0 || review.isPending}
                testID="refund-reject"
                className="flex-1 flex-row items-center justify-center rounded-xl2 border border-danger bg-danger/5 py-3"
                style={({ pressed }) => ({
                  opacity:
                    note.trim().length === 0 || review.isPending
                      ? 0.5
                      : pressed
                      ? 0.7
                      : 1,
                })}
              >
                <Icon name="X" size={16} color={COLORS.danger} />
                <Body className="ml-2 text-danger">Refuse</Body>
              </Pressable>

              <Pressable
                onPress={() => decide(true)}
                disabled={review.isPending}
                testID="refund-approve"
                className="flex-1 flex-row items-center justify-center rounded-xl2 bg-brand py-3"
                style={({ pressed }) => ({
                  opacity: review.isPending ? 0.5 : pressed ? 0.7 : 1,
                })}
              >
                <Icon name="Check" size={16} color={COLORS.white} />
                <Body className="ml-2 text-white">Release</Body>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/* ---------- helpers ---------- */

function RefundRow({
  request,
  canApprove,
  onReview,
}: {
  request: RefundRequest;
  canApprove: boolean;
  onReview: () => void;
}) {
  const showReview = canApprove && request.status === "PENDING";

  return (
    <Card className="p-4" testID={`refund-${request._id}`}>
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Muted className="text-[11px]">{request.ref}</Muted>
          <Body className="font-semibold">
            {request.customerName || "—"}
          </Body>
          <Muted className="text-xs">Booking {request.bookingRef}</Muted>
        </View>
        <View className="items-end">
          <Amount className="text-lg text-navy">
            {money(request.amount)}
          </Amount>
          <Muted className="text-[11px]">
            {formatTime(new Date(request.createdAt).getTime())}
          </Muted>
          <Muted className="text-[10px]">
            {formatDate(new Date(request.createdAt).getTime())}
          </Muted>
        </View>
      </View>

      <Muted className="mb-2 text-xs">{request.reason}</Muted>

      <View className="mb-3 flex-row flex-wrap gap-2">
        <Pill label={request.engineKind} />
        <Pill label={request.status} tone={TONE[request.status]} />
        {request.reviewedByName && (
          <Pill label={`by ${request.reviewedByName}`} />
        )}
      </View>

      <View className="flex-row items-center justify-between">
        <Muted className="text-xs">
          Asked by {request.requestedByName}
        </Muted>

        {showReview && (
          <Pressable
            onPress={onReview}
            testID={`refund-review-${request._id}`}
            className="flex-row items-center justify-center rounded-xl2 border border-line bg-surface px-3 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="Undo2" size={14} color={COLORS.navy} />
            <Body className="ml-2 text-sm text-navy">Review</Body>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "info" | "success" | "danger" | "warning";
}) {
  const color =
    tone === "info"
      ? COLORS.brand
      : tone === "success"
      ? COLORS.success
      : tone === "danger"
      ? COLORS.danger
      : tone === "warning"
      ? COLORS.warn
      : COLORS.navy;

  return (
    <View className="rounded-full border border-line bg-canvas px-2 py-0.5">
      <Muted className="text-[11px]" style={{ color }}>
        {label}
      </Muted>
    </View>
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