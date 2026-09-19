import { router } from "expo-router";
import { View } from "react-native";

// import { AppHeader } from "@/components/AppHeader";
import { Icon, type IconName } from "@/components/Icon";
import {
  Body,
  Divider,
  ListGroup,
  ListRow,
  Muted,
  Screen,
  Section,
  StatusPill,
} from "@/components/ui";
import { useIncidents, useShift } from "@/hooks/queries";
import { money } from "@/lib/format";
import { useSessionStore } from "@/store/session.store";
import { COLORS } from "@/theme/tokens";

export default function Till() {
  const me = useSessionStore((s) => s.me);
  const shift = useShift();
  const incidents = useIncidents();

  const openIncidents = (incidents.data ?? []).filter(
    (i) => i.status !== "RESOLVED" && i.status !== "REJECTED",
  ).length;

  return (
    <Screen scroll testID="till">
      {/* <AppHeader title="Till" subtitle={me?.station?.name} /> */}

      <Section className="mb-5">
        <ListGroup>
          <ListRow
            testID="till"
            onPress={() => router.push("/till")}
            leading={<Tile icon="AlertTriangle" />}
            title="Till"
            subtitle="Report a problem, or follow one up"
            trailing={
              openIncidents > 0 ? (
                <View className="rounded-full bg-danger px-2 py-0.5">
                  <Body className="text-[11px] font-bold text-white">
                    {openIncidents}
                  </Body>
                </View>
              ) : undefined
            }
          />
          <Divider />
          <ListRow
            testID="awaiting-payment"
            onPress={() => router.push("/tillQueue")}
            leading={<Tile icon="Clock" />}
            title="Awaiting payment"
            subtitle="Pending payments to collect"
            trailing={
              shift.data?.awaitingPayment > 0 ? (
                <View className="rounded-full bg-primary px-2 py-0.5">
                  <Body className="text-[11px] font-bold text-white">
                    {shift.data?.awaitingPayment}
                  </Body>
                </View>
              ) : undefined
            }
          />
          <Divider />
          <ListRow
            testID="transactions"
            onPress={() => router.push("/tillTransactions")}
            leading={<Tile icon="CreditCard" />}
            title="Transactions"
            subtitle="View all transaction history"
          />
          <Divider />
          <ListRow
            testID="cash-drawer"
            onPress={() => router.push("/tillDrawer")}
            leading={<Tile icon="CircleDollarSign" />}
            title="Cash drawer"
            subtitle="Manage cash and reconcile"
          />
          <Divider />
          <ListRow
            testID="refund-requests"
            onPress={() => router.push("/tillRefunds")}
            leading={<Tile icon="ArrowLeft" />}
            title="Refund requests"
            subtitle="Pending and processed refunds"
            trailing={
              shift.data?.pendingRefunds > 0 ? (
                <View className="rounded-full bg-warning px-2 py-0.5">
                  <Body className="text-[11px] font-bold text-white">
                    {shift.data?.pendingRefunds}
                  </Body>
                </View>
              ) : undefined
            }
          />
        </ListGroup>
      </Section>

      <Muted className="px-1 text-center">
        WAYZ · kiosk agent · {me?.tenant?.name ?? ""}
      </Muted>
    </Screen>
  );
}

function Tile({ icon }: { icon: IconName }) {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-canvas">
      <Icon name={icon} size={18} color={COLORS.navy} />
    </View>
  );
}