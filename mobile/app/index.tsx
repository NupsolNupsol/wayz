import { Redirect } from "expo-router";
import { View } from "react-native";

import { Loading } from "@/components/ui";
import { useSessionStore } from "@/store/session.store";

export default function Index() {
  const ready = useSessionStore((s) => s.ready);
  const token = useSessionStore((s) => s.token);

  if (!ready) {
    return (
      <View className="flex-1 bg-canvas">
        <Loading />
      </View>
    );
  }

  return <Redirect href={token ? "/today" : "/sign-in"} />;
}
