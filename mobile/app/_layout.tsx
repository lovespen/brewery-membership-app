import { Stack } from "expo-router";
import { AuthProvider } from "./auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen name="login" options={{ title: "Log in" }} />
        <Stack.Screen name="change-password" options={{ title: "Change password" }} />
        <Stack.Screen name="pickup" options={{ title: "Pickup Items" }} />
        <Stack.Screen name="toast-order" options={{ title: "Order via Toast" }} />
        <Stack.Screen name="shop" options={{ title: "Club Exclusive Items" }} />
      </Stack>
    </AuthProvider>
  );
}

