import { useMutation } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiMessage } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { Icon } from "@/components/Icon";
import {
  Body,
  Button,
  Field,
  Heading,
  Input,
  Muted,
  Notice,
  Title,
  toast,
} from "@/components/ui";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import { useSessionStore } from "@/store/session.store";
import { COLORS } from "@/theme/tokens";

const DEMO = { email: "agent.wayz@lockerflow.demo", password: "Agent@123" };

export default function SignIn() {
  const signIn = useSessionStore((s) => s.signIn);
  const ready = useSessionStore((s) => s.ready);
  const token = useSessionStore((s) => s.token);
  const { isTablet } = useDeviceClass();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => authApi.login(email.trim(), password),
    onSuccess: async ({ token, user }) => {
      if (user.role !== "AGENT") {
        setError(
          `This app is for kiosk agents. ${user.fullName} signs in as ${user.role.replaceAll("_", " ").toLowerCase()}.`,
        );
        return;
      }
      await signIn(token, user);
      toast(
        "success",
        `Welcome, ${user.fullName.split(" ")[0]}`,
        user.station?.name,
      );
      router.replace("/today");
    },
    onError: (e) =>
      setError(apiMessage(e, "Those credentials were not accepted.")),
  });

  const submit = () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    login.mutate();
  };

  if (ready && token) return <Redirect href="/today" />;

  return (
    <SafeAreaView className="flex-1 bg-canvas" testID="sign-in">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className={`w-full self-center px-6 ${isTablet ? "max-w-md" : ""}`}
          >
            <View className="mb-8 items-center gap-3">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand">
                <Icon name="Boxes" size={30} color={COLORS.white} />
              </View>
              <Title>WAYZ</Title>
              <Muted>Kiosk agent · counter workspace</Muted>
            </View>

            <View className="gap-4 rounded-xl2 border border-line bg-surface p-5">
              <Heading>Sign in</Heading>

              <Field label="Email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  testID="sign-in-email"
                />
              </Field>

              <Field label="Password">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  testID="sign-in-password"
                />
              </Field>

              {error ? (
                <Notice tone="danger" testID="sign-in-error">
                  <Body className="text-danger">{error}</Body>
                </Notice>
              ) : null}

              <Button
                label="Sign in"
                size="lg"
                full
                loading={login.isPending}
                onPress={submit}
                testID="sign-in-submit"
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setEmail(DEMO.email);
                  setPassword(DEMO.password);
                }}
                testID="sign-in-demo"
                className="items-center py-1"
              >
                <Muted>Use the demo agent</Muted>
              </Pressable>
            </View>

            <Muted className="mt-6 text-center">
              Your account is tied to one station. Everything you see and create
              belongs to it.
            </Muted>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
