import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";

import { API_URL } from "@/api/client";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Body,
  Button,
  Card,
  KeyValue,
  Muted,
  Screen,
  Section,
  StatusPill,
} from "@/components/ui";
import { engineLabel } from "@/config/engines";
import { useSessionStore } from "@/store/session.store";
import { COLORS } from "@/theme/tokens";
import { initials } from "@/lib/format";

export default function Profile() {
  const me = useSessionStore((s) => s.me);
  const signOut = useSessionStore((s) => s.signOut);
  const qc = useQueryClient();

  const leave = async () => {
    await signOut();
    qc.clear();
    router.replace("/sign-in");
  };

  return (
    <Screen scroll testID="profile">
      <AppHeader
        back
        title="Profile"
        subtitle="Who this device is signed in as"
      />

      <Card className="mb-4">
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand">
            <Body className="text-lg font-extrabold text-white">
              {initials(me?.fullName)}
            </Body>
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Body className="text-base font-bold">{me?.fullName}</Body>
            <Muted numberOfLines={1}>{me?.email}</Muted>
          </View>
          <StatusPill
            tone="brand"
            label={me?.role.replaceAll("_", " ") ?? ""}
            size="sm"
          />
        </View>
      </Card>

      <Section title="Your scope" className="mb-4">
        <Card>
          <View className="flex-row flex-wrap gap-4">
            <KeyValue
              label="Company"
              value={me?.tenant?.name ?? "—"}
              className="min-w-[45%]"
            />
            <KeyValue
              label="Station"
              value={me?.station?.name ?? "—"}
              className="min-w-[45%]"
            />
            <KeyValue
              label="Kiosk"
              value={me?.kiosk?.name ?? "—"}
              className="min-w-[45%]"
            />
            <KeyValue
              label="Phone"
              value={me?.phone || "—"}
              className="min-w-[45%]"
            />
          </View>

          <View className="mt-4 gap-2">
            <Muted>Activities you work</Muted>
            <View className="flex-row flex-wrap gap-2">
              {(me?.engineKinds ?? []).length === 0 ? (
                <Muted>None assigned</Muted>
              ) : (
                me?.engineKinds.map((kind) => (
                  <StatusPill
                    key={kind}
                    tone="brand"
                    label={engineLabel(kind)}
                    size="sm"
                  />
                ))
              )}
            </View>
          </View>
        </Card>
      </Section>

      <Section title="This build" className="mb-4">
        <Card>
          <View className="gap-3">
            <KeyValue label="API" value={API_URL} />
            <Muted>
              Everything you see belongs to your station. The server decides
              that from your sign-in, not from anything this app asks for.
            </Muted>
          </View>
        </Card>
      </Section>

      <Button
        label="Sign out"
        variant="secondary"
        full
        icon={<Icon name="LogOut" size={16} color={COLORS.navy} />}
        onPress={() => void leave()}
        testID="profile-sign-out"
      />
    </Screen>
  );
}
