import { router } from "expo-router";
import { View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
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

export default function More() {
  const me = useSessionStore((s) => s.me);
  const shift = useShift();
  const incidents = useIncidents();

  const openIncidents = (incidents.data ?? []).filter(
    (i) => i.status !== "RESOLVED" && i.status !== "REJECTED",
  ).length;

  return (
    <Screen scroll testID="more">
      <AppHeader title="More" subtitle={me?.station?.name} />

      <Section title="Your session" className="mb-5">
        <ListGroup>
          <ListRow
            testID="more-shift"
            onPress={() => router.push("/shift")}
            leading={<Tile icon="Wallet" />}
            title="Shift & cash"
            subtitle={
              shift.data?.status === "OPEN"
                ? `Open · ${money(shift.data.expectedCash)} expected`
                : "Closed — open one before taking cash"
            }
            trailing={
              shift.data ? (
                <StatusPill status={shift.data.status} size="sm" />
              ) : undefined
            }
          />
          <Divider />
          <ListRow
            testID="more-profile"
            onPress={() => router.push("/profile")}
            leading={<Tile icon="User" />}
            title="Profile"
            subtitle={me?.email}
          />
        </ListGroup>
      </Section>

      <Section title="At this counter" className="mb-5">
        <ListGroup>
          <ListRow
            testID="more-incidents"
            onPress={() => router.push("/incidents")}
            leading={<Tile icon="AlertTriangle" />}
            title="Incidents"
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
            testID="more-assets"
            onPress={() => router.push("/assets")}
            leading={<Tile icon="Grid3x3" />}
            title="Assets"
            subtitle="What is free, held or out of service"
          />
          <Divider />
          <ListRow
            testID="more-customers"
            onPress={() => router.push("/customers")}
            leading={<Tile icon="Users" />}
            title="Customers"
            subtitle="The directory for this tenant"
          />
          <Divider />
          <ListRow
            testID="more-bookings"
            onPress={() => router.push("/bookings")}
            leading={<Tile icon="Package" />}
            title="Bookings"
            subtitle="Every booking this station has taken"
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
