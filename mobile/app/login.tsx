import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "./auth-context";

export default function LoginScreen() {
  const { member, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && member) {
      router.replace("/");
    }
  }, [loading, member, router]);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace("/");
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2c6be8" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (member) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Member login</Text>
        <Text style={styles.subtitle}>
          Sign in with your membership email and password.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6b6b80"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!submitting}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b6b80"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          secureTextEntry
          autoComplete="password"
          editable={!submitting}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? "Logging in…" : "Log in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 20,
    backgroundColor: "#0b0b0f"
  },
  centered: {
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    marginTop: 12,
    color: "#b3b3c2",
    fontSize: 14
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 360,
    alignSelf: "center",
    width: "100%"
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: "#b3b3c2",
    marginBottom: 24
  },
  input: {
    backgroundColor: "#171721",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#f5f5f5",
    marginBottom: 16
  },
  error: {
    color: "#e88",
    fontSize: 13,
    marginBottom: 12
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#2c6be8",
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16
  }
});
