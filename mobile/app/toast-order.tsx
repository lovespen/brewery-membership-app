import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "./auth-context";

const TOAST_URL =
  "https://order.toasttab.com/online/sapwood-cellars-brewery-8980-md-108";

export default function ToastOrderScreen() {
  const { member, loading, refreshMember } = useAuth();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      refreshMember();
    }, [refreshMember])
  );

  const promoCodes = useMemo(() => {
    if (!member?.memberships?.length) return [];
    return member.memberships.map((m) => ({
      id: `${m.clubCode}-${m.year}`,
      label: m.clubName,
      code: m.toastDiscountCode
    }));
  }, [member?.memberships]);

  const handleCopy = async (code: string) => {
    await Clipboard.setStringAsync(code);
  };

  const openInAppBrowser = async () => {
    await WebBrowser.openBrowserAsync(TOAST_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: "#5677fc"
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2c6be8" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!member) {
    router.replace("/login");
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Order via Toast</Text>
        <Text style={styles.subTitle}>
          Copy your promo code, then open Toast to order. Paste the code at checkout.
        </Text>
      </View>

      <View style={styles.promoPanel}>
        <Text style={styles.panelTitle}>Your Toast promo codes</Text>
        {promoCodes.length === 0 ? (
          <Text style={styles.emptyText}>
            You have no club memberships for the current year. Purchase a membership in the app or on web to get your Toast discount code.
          </Text>
        ) : (
        promoCodes.map((pc) => (
          <View key={pc.id} style={styles.promoRow}>
            <View>
              <Text style={styles.promoLabel}>{pc.label}</Text>
              <Text style={styles.promoCode}>{pc.code}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => handleCopy(pc.code)}
            >
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        ))
        )}
        <Text style={styles.panelHint}>
          Paste this code at checkout on Toast to receive your member discount.
        </Text>
      </View>

      <TouchableOpacity style={styles.openBrowserButton} onPress={openInAppBrowser}>
        <Text style={styles.openBrowserButtonText}>Open Toast to order</Text>
        <Text style={styles.openBrowserHint}>
          Opens in an in-app browser. Close when done to return here.
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0f"
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80
  },
  loadingText: {
    marginTop: 12,
    color: "#b3b3c2",
    fontSize: 14
  },
  emptyText: {
    color: "#b3b3c2",
    fontSize: 13,
    marginBottom: 8
  },
  content: {
    paddingBottom: 40
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 4
  },
  subTitle: {
    color: "#b3b3c2",
    fontSize: 13
  },
  promoPanel: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#171721",
    borderRadius: 16,
    padding: 14
  },
  panelTitle: {
    color: "#f5f5f5",
    fontWeight: "600",
    marginBottom: 8
  },
  promoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  promoLabel: {
    color: "#b3b3c2",
    fontSize: 12
  },
  promoCode: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#2c6be8"
  },
  copyButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  },
  panelHint: {
    marginTop: 8,
    color: "#8d8da1",
    fontSize: 11
  },
  openBrowserButton: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "#2c6be8",
    alignItems: "center"
  },
  openBrowserButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700"
  },
  openBrowserHint: {
    marginTop: 6,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12
  }
});

