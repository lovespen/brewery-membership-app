import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "./auth-context";

export default function ChangePasswordScreen() {
  const { member, changePassword } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  if (!member) {
    router.replace("/login");
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Change password</Text>
        {success ? (
          <>
            <Text style={styles.success}>Password updated.</Text>
            <Pressable style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Back to Home</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#6b6b80"
              value={currentPassword}
              onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
              secureTextEntry
              autoComplete="password"
              editable={!submitting}
            />
            <TextInput
              style={styles.input}
              placeholder="New password (min 8 characters)"
              placeholderTextColor="#6b6b80"
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setError(null); }}
              secureTextEntry
              autoComplete="new-password"
              editable={!submitting}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#6b6b80"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
              secureTextEntry
              autoComplete="new-password"
              editable={!submitting}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>
                {submitting ? "Updating…" : "Update password"}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </>
        )}
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
  inner: {
    flex: 1,
    maxWidth: 360,
    alignSelf: "center",
    width: "100%"
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 24
  },
  success: {
    fontSize: 14,
    color: "#8be0a4",
    marginBottom: 20
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
    alignItems: "center",
    marginBottom: 12
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#8cc4ff",
    fontSize: 14
  }
});
