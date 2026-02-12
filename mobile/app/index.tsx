import { useRouter, Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAuth } from "./auth-context";
import { API_BASE } from "./config";
import { useFocusEffect } from "expo-router";

const CLUB_LABEL: Record<string, string> = {
  SAP: "Sap Club",
  WOOD: "Wood Club",
  CELLARS: "Cellars Club",
  FOUNDERS: "Founders"
};

export default function HomeScreen() {
  const { member, loading, logout } = useAuth();
  const router = useRouter();
  const [countsLoading, setCountsLoading] = useState(true);
  const [readyForPickupCount, setReadyForPickupCount] = useState(0);
  const [preorderCount, setPreorderCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    if (!loading && !member) {
      router.replace("/login");
    }
  }, [loading, member, router]);

  const loadCounts = useCallback(async () => {
    if (!member?.id) {
      setReadyForPickupCount(0);
      setPreorderCount(0);
      setProductCount(0);
      setCountsLoading(false);
      return;
    }
    setCountsLoading(true);
    try {
      const [entRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/api/members/${encodeURIComponent(member.id)}/entitlements`),
        fetch(
          member.clubs?.length
            ? `${API_BASE}/api/products?clubCodes=${member.clubs.map((c) => encodeURIComponent(c)).join(",")}`
            : `${API_BASE}/api/products`
        )
      ]);
      if (entRes.ok) {
        const entData = await entRes.json();
        const ready = Array.isArray(entData.readyForPickup) ? entData.readyForPickup : [];
        const pre = Array.isArray(entData.upcomingPreorders) ? entData.upcomingPreorders : [];
        setReadyForPickupCount(ready.length);
        setPreorderCount(pre.length);
      } else {
        setReadyForPickupCount(0);
        setPreorderCount(0);
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const list = Array.isArray(prodData) ? prodData : prodData?.products ?? [];
        setProductCount(Array.isArray(list) ? list.length : 0);
      } else {
        setProductCount(0);
      }
    } catch {
      setReadyForPickupCount(0);
      setPreorderCount(0);
      setProductCount(0);
    } finally {
      setCountsLoading(false);
    }
  }, [member?.id, member?.clubs]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useFocusEffect(useCallback(() => {
    loadCounts();
  }, [loadCounts]));

  const memberName = member?.name || member?.email || "Member";
  const clubs = (member?.clubs ?? []).map((c) => CLUB_LABEL[c] || c);

  if (loading || !member) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2c6be8" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Hi, {memberName}</Text>
        <View style={styles.headerActions}>
          <Link href="/change-password" asChild>
            <Pressable style={styles.logoutButton}>
              <Text style={styles.logoutText}>Change password</Text>
            </Pressable>
          </Link>
          <Pressable
            onPress={() => logout().then(() => router.replace("/login"))}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.subTitle}>
        Your clubs: {clubs.length > 0 ? clubs.join(", ") : "None"}
      </Text>

      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ready for pickup</Text>
          <Text style={styles.cardValue}>
            {countsLoading ? "…" : readyForPickupCount}
          </Text>
          <Link href="/pickup?section=ready" style={styles.link}>
            View pickup list
          </Link>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Preorders</Text>
          <Text style={styles.cardValue}>
            {countsLoading ? "…" : preorderCount}
          </Text>
          <Link href="/pickup?section=preorders" style={styles.link}>
            View preorders
          </Link>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shortcuts</Text>
        <Link href="/pickup" style={styles.button}>
          <Text style={styles.buttonText}>Pickup items</Text>
        </Link>
        <Link href="/shop" asChild>
          <Pressable style={styles.button}>
            <View style={styles.buttonInner}>
              <Text style={styles.buttonText}>Club Exclusive Items</Text>
              <View style={styles.optionBadge}>
                <Text style={styles.optionBadgeText}>
                  {countsLoading ? "…" : `${productCount} ${productCount === 1 ? "option" : "options"}`}
                </Text>
              </View>
            </View>
          </Pressable>
        </Link>
        <Link href="/toast-order" style={styles.button}>
          <Text style={styles.buttonText}>Order via Toast</Text>
        </Link>
      </View>
    </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 4
  },
  subTitle: {
    fontSize: 14,
    color: "#b3b3c2",
    marginBottom: 24
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  logoutText: {
    color: "#8cc4ff",
    fontSize: 14
  },
  cardRow: {
    flexDirection: "row",
    gap: 12
  },
  card: {
    flex: 1,
    backgroundColor: "#171721",
    borderRadius: 16,
    padding: 16
  },
  cardLabel: {
    color: "#b3b3c2",
    fontSize: 12,
    marginBottom: 8
  },
  cardValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8
  },
  link: {
    color: "#8cc4ff",
    fontSize: 13
  },
  section: {
    marginTop: 32
  },
  sectionTitle: {
    color: "#f5f5f5",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#2c6be8",
    alignItems: "center"
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  optionBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)"
  },
  optionBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  }
});

