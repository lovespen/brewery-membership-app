import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "./auth-context";
import { API_BASE, getStaffPickupUrl } from "./config";

type EntitlementItem = {
  id: string;
  name: string;
  quantity: number;
  source?: string;
  releaseDate?: string;
  status: "ready" | "preorder";
};

export default function PickupScreen() {
  const { member, loading: authLoading } = useAuth();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const readySectionY = useRef(0);
  const preordersSectionY = useRef(0);

  useEffect(() => {
    if (!authLoading && !member) {
      router.replace("/login");
    }
  }, [authLoading, member, router]);

  const loadEntitlements = useCallback(async () => {
    if (!member?.id) {
      setEntitlements([]);
      setEntitlementsLoading(false);
      return;
    }
    setEntitlementsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/members/${encodeURIComponent(member.id)}/entitlements`
      );
      if (res.ok) {
        const data = await res.json();
        const rawReady = data.readyForPickup ?? [];
        const rawPre = data.upcomingPreorders ?? [];
        const ready: EntitlementItem[] = rawReady.map(
          (e: { id?: string; productId?: string; name?: string; quantity?: number; source?: string }) => ({
            id: String(e.id ?? ""),
            name: String(e.name ?? e.productId ?? "Item"),
            quantity: Number(e.quantity) || 1,
            source: e.source,
            status: "ready" as const
          })
        );
        const preorders: EntitlementItem[] = rawPre.map(
          (e: { id?: string; productId?: string; name?: string; quantity?: number; releaseAt?: string }) => ({
            id: String(e.id ?? ""),
            name: String(e.name ?? e.productId ?? "Item"),
            quantity: Number(e.quantity) || 1,
            releaseDate: e.releaseAt ? new Date(e.releaseAt).toLocaleDateString() : undefined,
            status: "preorder" as const
          })
        );
        setEntitlements([...ready, ...preorders]);
      } else {
        setEntitlements([]);
      }
    } catch {
      setEntitlements([]);
    } finally {
      setEntitlementsLoading(false);
    }
  }, [member?.id]);

  useEffect(() => {
    loadEntitlements();
  }, [loadEntitlements]);

  const readyForPickup = entitlements.filter((e) => e.status === "ready");
  const upcomingPreorders = entitlements.filter((e) => e.status === "preorder");
  const memberId = member?.id ?? "";
  const staffPickupUrl = getStaffPickupUrl(memberId);

  const scrollToSection = (targetSection: string, y: number) => {
    if (section === targetSection && scrollRef.current && y >= 0) {
      scrollRef.current.scrollTo({ y, animated: true });
    }
  };

  if (authLoading || !member) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2c6be8" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pickup Items</Text>

      <Pressable
        style={styles.qrButton}
        onPress={() => setQrModalVisible(true)}
        disabled={!memberId}
      >
        <Text style={styles.qrButtonText}>Show QR code for staff</Text>
      </Pressable>

      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setQrModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Pickup QR code</Text>
            <Text style={styles.modalHint}>
              Show this to staff so they can scan and mark your items as picked up.
            </Text>
            <View style={styles.qrWrap}>
              <QRCode value={staffPickupUrl} size={200} />
            </View>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {entitlementsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#2c6be8" />
            <Text style={styles.loadingText}>Loading entitlements…</Text>
          </View>
        ) : (
          <>
            <View
              onLayout={(e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y;
                readySectionY.current = y;
                scrollToSection("ready", y);
              }}
            >
              <Text style={styles.sectionTitle}>Ready for pickup</Text>
              {readyForPickup.length === 0 ? (
                <Text style={styles.empty}>No items ready for pickup.</Text>
              ) : (
                readyForPickup.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      Qty: {item.quantity}
                      {item.source ? ` • ${item.source}` : ""}
                    </Text>
                    <Text style={styles.statusPill}>READY</Text>
                  </View>
                ))
              )}
            </View>

            <View
              onLayout={(e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y;
                preordersSectionY.current = y;
                scrollToSection("preorders", y);
              }}
            >
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                Upcoming preorders
              </Text>
              {upcomingPreorders.length === 0 ? (
                <Text style={styles.empty}>No upcoming preorders.</Text>
              ) : (
                upcomingPreorders.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      Qty: {item.quantity}
                      {item.releaseDate ? ` • Releases ${item.releaseDate}` : ""}
                    </Text>
                    <Text style={[styles.statusPill, { backgroundColor: "#8a4bff" }]}>
                      PREORDER
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
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
    alignItems: "center",
    paddingVertical: 24
  },
  loadingText: {
    marginTop: 12,
    color: "#b3b3c2",
    fontSize: 14
  },
  empty: {
    color: "#b3b3c2",
    fontSize: 13,
    marginBottom: 8
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 24
  },
  sectionTitle: {
    color: "#b3b3c2",
    fontSize: 14,
    marginBottom: 8
  },
  card: {
    backgroundColor: "#171721",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8
  },
  itemName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4
  },
  itemMeta: {
    color: "#b3b3c2",
    fontSize: 12,
    marginBottom: 8
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#1e824c",
    color: "#e5ffef",
    fontSize: 11,
    fontWeight: "600"
  },
  qrButton: {
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2c6be8",
    alignItems: "center"
  },
  qrButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  modalContent: {
    backgroundColor: "#171721",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    maxWidth: 320
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f5f5f5",
    marginBottom: 8
  },
  modalHint: {
    fontSize: 13,
    color: "#b3b3c2",
    textAlign: "center",
    marginBottom: 20
  },
  qrWrap: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 20
  },
  modalCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: "#2c6be8"
  },
  modalCloseText: {
    color: "#ffffff",
    fontWeight: "600"
  }
});

