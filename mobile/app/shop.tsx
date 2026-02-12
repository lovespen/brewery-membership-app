import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "./auth-context";
import { API_BASE, MEMBER_WEB_BASE } from "./config";

type Product = {
  id: string;
  name: string;
  description?: string;
  basePriceCents: number;
  allowedClubs: string[];
  isActive: boolean;
};

type CartItem = { productId: string; quantity: number };

export default function ShopScreen() {
  const { member, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartSessionId, setCartSessionId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const memberClubs = member?.clubs ?? [];
  const loadProducts = useCallback(async () => {
    try {
      const url =
        memberClubs.length > 0
          ? `${API_BASE}/api/products?clubCodes=${memberClubs.map((c) => encodeURIComponent(c)).join(",")}`
          : `${API_BASE}/api/products`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data)
          ? data
          : (data && Array.isArray((data as { products?: unknown[] }).products))
            ? (data as { products: unknown[] }).products
            : [];
        const list: Product[] = rawList.map((p: Record<string, unknown>) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          description: p.description != null ? String(p.description) : undefined,
          basePriceCents: Number(p.basePriceCents) || 0,
          allowedClubs: Array.isArray(p.allowedClubs) ? (p.allowedClubs as string[]) : [],
          isActive: p.isActive !== false
        })).filter((p) => p.id && p.name);
        setProducts(list);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberClubs.join(",")]);

  const loadCart = useCallback(async () => {
    if (!cartSessionId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/cart?cartSessionId=${encodeURIComponent(cartSessionId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.items ?? []);
      }
    } catch {
      // ignore
    }
  }, [cartSessionId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    if (!authLoading && !member) {
      router.replace("/login");
    }
  }, [authLoading, member, router]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      if (cartSessionId) loadCart();
    }, [loadProducts, loadCart, cartSessionId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
    if (cartSessionId) loadCart();
  };

  const addToCart = async (productId: string) => {
    setAddingId(productId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cartSessionId) headers["X-Cart-Session"] = cartSessionId;
      const res = await fetch(`${API_BASE}/api/cart/items`, {
        method: "POST",
        headers,
        body: JSON.stringify({ productId, quantity: 1 })
      });
      if (res.ok) {
        const data = await res.json();
        setCartSessionId(data.cartSessionId ?? cartSessionId);
        setCartItems(data.items ?? []);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err?.error ?? "Could not add to cart");
      }
    } catch {
      Alert.alert("Error", "Could not reach server. Is the backend running?");
    } finally {
      setAddingId(null);
    }
  };

  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  const openCheckoutWeb = () => {
    const params = new URLSearchParams();
    if (cartSessionId) params.set("cartSessionId", cartSessionId);
    if (member?.id) params.set("memberId", member.id);
    const qs = params.toString();
    const url = qs ? `${MEMBER_WEB_BASE}?${qs}` : MEMBER_WEB_BASE;
    Linking.openURL(url);
  };

  if (authLoading || !member) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2c6be8" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2c6be8" />
        <Text style={styles.loadingText}>Loading shop…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Club Exclusive Items</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {products.length} {products.length === 1 ? "option" : "options"}
            </Text>
          </View>
        </View>
        {cartCount > 0 && (
          <Pressable style={styles.cartBadge} onPress={openCheckoutWeb}>
            <Text style={styles.cartBadgeText}>Cart ({cartCount})</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {products.length === 0 ? (
          <Text style={styles.empty}>
            No products right now. Pull to refresh or check the backend.
          </Text>
        ) : (
          products.map((p) => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.productName}>{p.name}</Text>
              {p.description ? (
                <Text style={styles.productDesc} numberOfLines={2}>
                  {p.description}
                </Text>
              ) : null}
              <View style={styles.cardRow}>
                <Text style={styles.price}>
                  ${(p.basePriceCents / 100).toFixed(2)}
                </Text>
                <Pressable
                  style={[styles.addButton, addingId === p.id && styles.addButtonDisabled]}
                  onPress={() => addToCart(p.id)}
                  disabled={addingId !== null}
                >
                  <Text style={styles.addButtonText}>
                    {addingId === p.id ? "Adding…" : "Add to cart"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {cartCount > 0 && (
          <Pressable style={styles.checkoutButton} onPress={openCheckoutWeb}>
            <Text style={styles.checkoutButtonText}>
              Checkout on web ({cartCount} items)
            </Text>
          </Pressable>
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
    marginBottom: 20
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f5f5f5"
  },
  countBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#2c6be8"
  },
  countBadgeText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12
  },
  cartBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#2c6be8"
  },
  cartBadgeText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  empty: {
    color: "#b3b3c2",
    fontSize: 14,
    textAlign: "center",
    marginTop: 40
  },
  card: {
    backgroundColor: "#171721",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  productName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4
  },
  productDesc: {
    color: "#b3b3c2",
    fontSize: 13,
    marginBottom: 12
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  price: {
    color: "#8cc4ff",
    fontSize: 16,
    fontWeight: "600"
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#2c6be8"
  },
  addButtonDisabled: {
    opacity: 0.6
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13
  },
  checkoutButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#1e824c",
    alignItems: "center"
  },
  checkoutButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15
  }
});
