import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import QRCode from "qrcode";

/** API base URL. In dev, "" uses Vite proxy to localhost:4000. In production set VITE_API_BASE (e.g. https://api.yourbrewery.com). */
function getApiBase(): string {
  const env = typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  if (env) return env.replace(/\/$/, "");
  return "";
}
const API = getApiBase();
const AUTH_TOKEN_KEY = "memberAuthToken";

/** Base URL for staff pickup page. Use env VITE_STAFF_PICKUP_URL, or same host as this page on port 4000 so phone can reach backend when on same Wi‑Fi. */
function getStaffPickupBase(): string {
  const env = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_STAFF_PICKUP_URL;
  if (env) return env;
  if (typeof window !== "undefined" && window.location?.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return `http://${window.location.hostname}:4000`;
  }
  return "http://localhost:4000";
}


type ClubCode = string;

type CartItem = { productId: string; quantity: number };

type MembershipOffering = {
  id: string;
  clubCode: string;
  name: string;
  description: string;
  year: number;
  priceCents: number;
  isActive: boolean;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  capacity?: number;
  soldCount?: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  allowedClubs: ClubCode[];
  basePriceCents: number;
  clubPriceCents?: Partial<Record<ClubCode, number>>;
  isPreorder?: boolean;
  preorderWindow?: { start: string; end: string; release: string };
};

const TOAST_URL =
  "https://order.toasttab.com/online/sapwood-cellars-brewery-8980-md-108";

/** Resolve club display name; use API clubs when available. */
function getClubLabel(clubs: { code: string; name: string }[] | null, code: string): string {
  return clubs?.find((c) => c.code === code)?.name ?? code;
}

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function computeMemberPriceCents(product: Product, memberClubs: ClubCode[]) {
  const candidates: number[] = [];
  for (const club of memberClubs) {
    const override = product.clubPriceCents?.[club];
    if (typeof override === "number") candidates.push(override);
  }
  return candidates.length ? Math.min(...candidates) : product.basePriceCents;
}

type PersonaKey = "NON_MEMBER" | string;

function getPersonaClubs(persona: PersonaKey, _clubsFromApi: { code: string }[] | null): ClubCode[] {
  if (persona === "NON_MEMBER") return [];
  return [persona];
}

function getPersonaName(persona: PersonaKey, clubsFromApi: { code: string; name: string }[] | null): string {
  if (persona === "NON_MEMBER") return "Guest";
  return getClubLabel(clubsFromApi, persona);
}

/** Demo member ID for preview by club (fallback m1). */
const DEMO_MEMBER_ID_BY_CLUB: Record<string, string> = { SAP: "m1", WOOD: "m2", CELLARS: "m3", FOUNDERS: "m2" };
function getPersonaMemberId(persona: PersonaKey): string | null {
  if (persona === "NON_MEMBER") return null;
  return DEMO_MEMBER_ID_BY_CLUB[persona] ?? "m1";
}

function CheckoutForm({
  clientSecret,
  onSuccess,
  onCancel
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + window.location.pathname }
    });
    if (submitError) {
      setError(submitError.message || "Payment failed");
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <PaymentElement />
      {error && <p style={{ color: "#f28b82", fontSize: 13, marginTop: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={styles.secondaryBtn}>
          Cancel
        </button>
        <button type="submit" disabled={!stripe || loading} style={styles.primaryBtn}>
          {loading ? "Processing…" : "Pay now"}
        </button>
      </div>
    </form>
  );
}

type LoggedInMember = {
  id: string;
  email: string;
  name: string;
  clubs: ClubCode[];
  memberships?: { clubCode: ClubCode; clubName?: string; year: number; toastDiscountCode: string }[];
  membershipYear?: number;
};

export const MemberPreview: React.FC = () => {
  const [authToken, setAuthToken] = React.useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null
  );
  const [loggedInMember, setLoggedInMember] = React.useState<LoggedInMember | null>(null);
  const [authLoading, setAuthLoading] = React.useState(!!(typeof localStorage !== "undefined" && localStorage.getItem(AUTH_TOKEN_KEY)));
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loginSubmitting, setLoginSubmitting] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [changePasswordCurrent, setChangePasswordCurrent] = React.useState("");
  const [changePasswordNew, setChangePasswordNew] = React.useState("");
  const [changePasswordConfirm, setChangePasswordConfirm] = React.useState("");
  const [changePasswordSubmitting, setChangePasswordSubmitting] = React.useState(false);
  const [changePasswordError, setChangePasswordError] = React.useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = React.useState(false);
  const [persona, setPersona] = React.useState<PersonaKey>("NON_MEMBER");
  const [clubsFromApi, setClubsFromApi] = React.useState<{ id: string; name: string; code: string }[] | null>(null);
  const [membershipYear, setMembershipYear] = React.useState<number>(2026);
  const [remoteProducts, setRemoteProducts] = React.useState<Product[] | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [cartSessionId, setCartSessionId] = React.useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("cartSessionId") : null
  );
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);
  const [memberships, setMemberships] = React.useState<MembershipOffering[]>([]);
  const [checkoutClientSecret, setCheckoutClientSecret] = React.useState<string | null>(null);
  const [checkoutPublishableKey, setCheckoutPublishableKey] = React.useState<string | null>(null);
  const [selectedTipPercent, setSelectedTipPercent] = React.useState<number | null>(0);
  const [checkoutTipCustom, setCheckoutTipCustom] = React.useState<string>("");
  const [suggestedTipPercents, setSuggestedTipPercents] = React.useState<number[]>([0, 10, 15, 20, 25]);
  const [showCart, setShowCart] = React.useState(false);
  const [showCreateAccountForm, setShowCreateAccountForm] = React.useState(false);
  const [createAccountEmail, setCreateAccountEmail] = React.useState("");
  const [createAccountFirstName, setCreateAccountFirstName] = React.useState("");
  const [createAccountLastName, setCreateAccountLastName] = React.useState("");
  const [createAccountPassword, setCreateAccountPassword] = React.useState("");
  const [createAccountSubmitting, setCreateAccountSubmitting] = React.useState(false);
  const [createAccountSuccess, setCreateAccountSuccess] = React.useState(false);
  const [pushStatus, setPushStatus] = React.useState<
    "unsupported" | "prompt" | "subscribed" | "denied" | "loading" | "error"
  >("unsupported");
  const [pickupQrDataUrl, setPickupQrDataUrl] = React.useState<string | null>(null);
  const [showPickupQr, setShowPickupQr] = React.useState(false);
  const stripePromise = React.useMemo(
    () => (checkoutPublishableKey ? loadStripe(checkoutPublishableKey) : null),
    [checkoutPublishableKey]
  );

  const isGuest = loggedInMember ? false : persona === "NON_MEMBER";
  const effectiveMemberId = loggedInMember ? loggedInMember.id : getPersonaMemberId(persona);
  const member = React.useMemo(
    () => {
      if (loggedInMember) {
        const toastPromoCodes =
          loggedInMember.memberships?.length > 0
            ? loggedInMember.memberships.map((m) => ({ club: m.clubCode, code: m.toastDiscountCode }))
            : loggedInMember.clubs.map((c) => ({ club: c, code: `${c}2026` }));
        return {
          name: loggedInMember.name || loggedInMember.email,
          clubs: loggedInMember.clubs,
          year: (loggedInMember.membershipYear ?? 2026) as number | null,
          toastPromoCodes
        };
      }
      if (persona === "NON_MEMBER") {
        return {
          name: getPersonaName("NON_MEMBER", clubsFromApi),
          clubs: [] as ClubCode[],
          year: null as number | null,
          toastPromoCodes: [] as { club: ClubCode; code: string }[]
        };
      }
      const pClubs = getPersonaClubs(persona, clubsFromApi);
      return {
        name: getPersonaName(persona, clubsFromApi),
        clubs: pClubs,
        year: membershipYear,
        toastPromoCodes: pClubs.map((c) => ({ club: c, code: `${c}2026` }))
      };
    },
    [loggedInMember, persona, clubsFromApi, membershipYear]
  );

  React.useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [clubsRes, yearRes] = await Promise.all([
          fetch(`${API}/api/clubs`, { signal: ac.signal }),
          fetch(`${API}/api/config/membership-year`, { signal: ac.signal })
        ]);
        if (clubsRes.ok) {
          const data = await clubsRes.json();
          setClubsFromApi(Array.isArray(data) ? data : []);
        }
        if (yearRes.ok) {
          const data = await yearRes.json();
          if (typeof data.membershipYear === "number") setMembershipYear(data.membershipYear);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => ac.abort();
  }, []);

  React.useEffect(() => {
    if (!authToken) {
      setAuthLoading(false);
      setLoggedInMember(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          setLoggedInMember(data.member ?? null);
        } else {
          if (res.status === 401 && typeof localStorage !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
          setAuthToken(null);
          setLoggedInMember(null);
        }
      } catch {
        setLoggedInMember(null);
      } finally {
        setAuthLoading(false);
      }
    })();
    return () => controller.abort();
  }, [authToken]);

  // Generate QR code for staff pickup (member ID in URL; staff scan to see and mark pickups)
  React.useEffect(() => {
    setShowPickupQr(false);
    if (!effectiveMemberId) {
      setPickupQrDataUrl(null);
      return;
    }
    const base = getStaffPickupBase();
    const url = `${base}/staff-pickup?memberId=${encodeURIComponent(effectiveMemberId)}`;
    QRCode.toDataURL(url, { width: 256, margin: 2 })
      .then(setPickupQrDataUrl)
      .catch(() => setPickupQrDataUrl(null));
  }, [effectiveMemberId]);

  const enablePushNotifications = React.useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushStatus("unsupported");
      return;
    }
    if (member.clubs.length === 0) return;
    setPushStatus("loading");
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setPushStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const keyRes = await fetch(`${API}/api/push/vapid-public-key`);
      if (!keyRes.ok) throw new Error("Failed to get VAPID key");
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      const res = await fetch(`${API}/api/push-subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          clubCodes: member.clubs
        })
      });
      if (!res.ok) throw new Error("Failed to register subscription");
      setPushStatus("subscribed");
    } catch (e) {
      console.error("Push subscribe error", e);
      setPushStatus("error");
    }
  }, [member.clubs]);

  React.useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) {
        setPushStatus("prompt");
        return;
      }
      reg.pushManager.getSubscription().then((sub) => {
        setPushStatus(sub ? "subscribed" : "prompt");
      });
    });
  }, []);

  const loadCart = React.useCallback(async () => {
    try {
      const url = cartSessionId
        ? `${API}/api/cart?cartSessionId=${encodeURIComponent(cartSessionId)}`
        : `${API}/api/cart`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setCartItems(data.items || []);
      if (data.cartSessionId && data.cartSessionId !== cartSessionId) {
        setCartSessionId(data.cartSessionId);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("cartSessionId", data.cartSessionId);
        }
      }
    } catch {
      // ignore
    }
  }, [cartSessionId]);

  React.useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = React.useCallback(
    async (productId: string, quantity: number) => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (cartSessionId) headers["X-Cart-Session"] = cartSessionId;
        const res = await fetch(`${API}/api/cart/items`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...(cartSessionId ? { cartSessionId } : {}),
            productId,
            quantity
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Add to cart failed", res.status, err);
          return;
        }
        const data = await res.json();
        setCartItems(data.items || []);
        if (data.cartSessionId) {
          setCartSessionId(data.cartSessionId);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("cartSessionId", data.cartSessionId);
          }
        }
        setShowCart(true);
      } catch (e) {
        console.error("Add to cart error", e);
      }
    },
    [cartSessionId]
  );

  const removeFromCart = React.useCallback(
    async (productId: string) => {
      try {
        const res = await fetch(`${API}/api/cart/items/${encodeURIComponent(productId)}`, {
          method: "DELETE",
          headers: cartSessionId ? { "X-Cart-Session": cartSessionId } : {}
        });
        if (!res.ok) return;
        const data = await res.json();
        setCartItems(data.items || []);
      } catch {
        // ignore
      }
    },
    [cartSessionId]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/memberships`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as MembershipOffering[];
          setMemberships(data);
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/config/tip-percentages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const arr = Array.isArray(data.suggestedTipPercents) ? data.suggestedTipPercents : [0, 10, 15, 20, 25];
        setSuggestedTipPercents(arr);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const clubsForProducts =
    loggedInMember?.clubs?.length
      ? loggedInMember.clubs
      : persona !== "NON_MEMBER"
        ? [persona]
        : [];
  React.useEffect(() => {
    if (clubsForProducts.length === 0) {
      setRemoteProducts([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const clubCodesParam = clubsForProducts.map((c) => encodeURIComponent(c)).join(",");
        const res = await fetch(
          `${API}/api/products?clubCodes=${clubCodesParam}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as any[];
        const mapped: Product[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          allowedClubs: p.allowedClubs as ClubCode[],
          basePriceCents: p.basePriceCents,
          clubPriceCents: Array.isArray(p.clubPrices)
            ? p.clubPrices.reduce(
                (acc: Partial<Record<ClubCode, number>>, cp: any) => {
                  if (
                    cp &&
                    typeof cp.clubCode === "string" &&
                    typeof cp.priceCents === "number"
                  ) {
                    acc[cp.clubCode as ClubCode] = cp.priceCents;
                  }
                  return acc;
                },
                {}
              )
            : undefined,
          isPreorder: !!p.isPreorder,
          preorderWindow:
            p.isPreorder && (p.preorderStartAt || p.preorderEndAt || p.releaseAt)
              ? {
                  start: p.preorderStartAt || "",
                  end: p.preorderEndAt || "",
                  release: p.releaseAt || ""
                }
              : undefined
        }));
        setRemoteProducts(mapped);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to load products from backend", err);
        setRemoteProducts(null);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [clubsForProducts.join(",")]);

  // Default stubbed data (used if backend unavailable)
  const fallbackProducts: Product[] = [
    {
      id: "p1",
      name: "Barrel-Aged Stout 2026",
      description: "Wood Club release. Limit 2 per member.",
      allowedClubs: ["WOOD", "FOUNDERS"],
      basePriceCents: 3400,
      clubPriceCents: { WOOD: 3000 },
      isPreorder: true,
      preorderWindow: {
        start: "Mar 1, 2026",
        end: "Mar 31, 2026",
        release: "May 1, 2026"
      }
    },
    {
      id: "p2",
      name: "Sap Club IPA Box",
      description: "Sap-only mixed IPA box.",
      allowedClubs: ["SAP", "FOUNDERS"],
      basePriceCents: 2500,
      clubPriceCents: { SAP: 2200 }
    },
    {
      id: "p3",
      name: "Cellars Reserve 750ml",
      description: "Cellars Club specialty bottle.",
      allowedClubs: ["CELLARS"],
      basePriceCents: 4500,
      clubPriceCents: { CELLARS: 4200 }
    },
    {
      id: "p4",
      name: "Founders Mixed Pack",
      description: "Available to Founders members only.",
      allowedClubs: ["FOUNDERS"],
      basePriceCents: 6000
    }
  ];

  const products = remoteProducts && remoteProducts.length > 0
    ? remoteProducts
    : fallbackProducts;

  const cartSubtotalCents = React.useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const p = products.find((x) => x.id === item.productId);
      const price = p ? computeMemberPriceCents(p, member.clubs) * item.quantity : 0;
      return sum + price;
    }, 0);
  }, [cartItems, products, member.clubs]);

  const resolvedTipCents =
    checkoutTipCustom.trim()
      ? Math.max(0, Math.round(parseFloat(checkoutTipCustom) * 100) || 0)
      : selectedTipPercent != null
        ? Math.round((cartSubtotalCents * selectedTipPercent) / 100)
        : 0;

  const startCheckout = React.useCallback(
    async (membershipId?: string, tipCents?: number) => {
      const items = membershipId ? [] : cartItems;
      const memberClubCode = member.clubs[0];
      const memberId = effectiveMemberId ?? undefined;
      const tip = typeof tipCents === "number" ? tipCents : resolvedTipCents;
      try {
        const res = await fetch(`${API}/api/checkout/create-payment-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            membershipId: membershipId || undefined,
            memberClubCode,
            memberId,
            tipCents: tip
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err?.error || "Could not start checkout");
          return;
        }
        const data = await res.json();
        setCheckoutClientSecret(data.clientSecret);
        setCheckoutPublishableKey(data.publishableKey);
      } catch (e) {
        alert("Checkout unavailable. Is Stripe configured in admin Settings?");
      }
    },
    [cartItems, member.clubs, effectiveMemberId, resolvedTipCents]
  );

  const eligible = products.filter((p) =>
    member.clubs.length > 0 && p.allowedClubs.some((c) => member.clubs.includes(c))
  );

  // Entitlements from API (allocations + preorders) – no stubbed pickup data
  type RawEntitlement = { id: string; productId: string; quantity: number; releaseAt?: string | null };
  const [entitlementsRaw, setEntitlementsRaw] = React.useState<{
    readyForPickup: RawEntitlement[];
    upcomingPreorders: RawEntitlement[];
  }>({ readyForPickup: [], upcomingPreorders: [] });

  React.useEffect(() => {
    if (!effectiveMemberId) {
      setEntitlementsRaw({ readyForPickup: [], upcomingPreorders: [] });
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/members/${encodeURIComponent(effectiveMemberId)}/entitlements`, {
          signal: controller.signal
        });
        if (!res.ok) return;
        const data = await res.json();
        setEntitlementsRaw({
          readyForPickup: Array.isArray(data.readyForPickup) ? data.readyForPickup : [],
          upcomingPreorders: Array.isArray(data.upcomingPreorders) ? data.upcomingPreorders : []
        });
      } catch {
        setEntitlementsRaw({ readyForPickup: [], upcomingPreorders: [] });
      }
    };
    load();
    return () => controller.abort();
  }, [effectiveMemberId]);

  const pickupReady = React.useMemo(
    () =>
      entitlementsRaw.readyForPickup.map((e) => ({
        id: e.id,
        name: products.find((p) => p.id === e.productId)?.name ?? "Product",
        quantity: e.quantity,
        status: "READY"
      })),
    [entitlementsRaw.readyForPickup, products]
  );
  const upcomingPreorders = React.useMemo(
    () =>
      entitlementsRaw.upcomingPreorders.map((e) => ({
        id: e.id,
        name: products.find((p) => p.id === e.productId)?.name ?? "Product",
        quantity: e.quantity,
        status: "PAID – NOT READY",
        release: e.releaseAt || "TBD"
      })),
    [entitlementsRaw.upcomingPreorders, products]
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>Sapwood Cellars</div>
          <h1 style={styles.h1}>
            {isGuest ? "Welcome" : "Member Dashboard (Preview)"}
          </h1>
          <div style={styles.sub}>
            {isGuest
              ? "Browse as a guest. Create an account or join a club to shop member releases and get discounts."
              : `Viewing as: ${member.clubs.map((c) => getClubLabel(clubsFromApi, c)).join(", ")} • ${member.year}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!isGuest && pushStatus === "prompt" && (
            <button
              type="button"
              onClick={enablePushNotifications}
              style={{
                ...styles.secondaryBtn,
                marginTop: 0,
                padding: "0.4rem 0.9rem",
                fontSize: 12
              }}
            >
              Enable push notifications
            </button>
          )}
          {!isGuest && pushStatus === "subscribed" && (
            <span style={{ fontSize: 12, color: "#8be0a4" }}>Notifications on</span>
          )}
          {!isGuest && pushStatus === "loading" && (
            <span style={{ fontSize: 12, color: "#8a8cab" }}>Enabling…</span>
          )}
          <button
            type="button"
            onClick={() => setShowCart((s) => !s)}
            style={{
              ...styles.secondaryBtn,
              marginTop: 0,
              padding: "0.4rem 0.9rem"
            }}
          >
            Cart ({cartItems.reduce((n, i) => n + i.quantity, 0)})
          </button>
          {authLoading ? (
            <span style={{ fontSize: 12, color: "#8a8cab" }}>Loading…</span>
          ) : loggedInMember ? (
            <>
              <div style={styles.pill}>
                Logged in as {loggedInMember.name || loggedInMember.email}
                {member.clubs.length > 0 ? ` • ${member.clubs.map((c) => getClubLabel(clubsFromApi, c)).join(", ")}` : ""}
              </div>
              <button
                type="button"
                title="Sync memberships (e.g. after admin adds a club)"
                onClick={async () => {
                  if (!authToken) return;
                  try {
                    const res = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } });
                    if (res.ok) {
                      const data = await res.json();
                      setLoggedInMember(data.member ?? null);
                    }
                  } catch { /* ignore */ }
                }}
                style={{ ...styles.secondaryBtn, marginTop: 0, padding: "0.4rem 0.9rem", fontSize: 12 }}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                style={{ ...styles.secondaryBtn, marginTop: 0, padding: "0.4rem 0.9rem", fontSize: 12 }}
              >
                Change password
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (authToken) {
                    try { await fetch(`${API}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } }); } catch { /* ignore */ }
                    if (typeof localStorage !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
                  }
                  setAuthToken(null);
                  setLoggedInMember(null);
                }}
                style={{ ...styles.secondaryBtn, marginTop: 0, padding: "0.4rem 0.9rem", fontSize: 12 }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoginError(null);
                  const email = loginEmail.trim();
                  if (!email || !loginPassword) return;
                  setLoginSubmitting(true);
                  try {
                    const res = await fetch(`${API}/api/auth/login`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email, password: loginPassword })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setLoginError(data?.error || "Login failed");
                      return;
                    }
                    if (data.token && typeof localStorage !== "undefined") {
                      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                      setAuthToken(data.token);
                      setLoggedInMember(data.member ?? null);
                      setLoginEmail("");
                      setLoginPassword("");
                    }
                  } catch {
                    setLoginError("Could not reach server");
                  } finally {
                    setLoginSubmitting(false);
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setLoginError(null); }}
                  style={{ ...styles.switcher, minWidth: 140 }}
                  autoComplete="email"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(null); }}
                  style={{ ...styles.switcher, minWidth: 120 }}
                  autoComplete="current-password"
                />
                <button type="submit" disabled={loginSubmitting} style={{ ...styles.secondaryBtn, marginTop: 0, padding: "0.4rem 0.9rem", fontSize: 12 }}>
                  {loginSubmitting ? "Logging in…" : "Log in"}
                </button>
                {loginError && <span style={{ fontSize: 12, color: "#e88" }}>{loginError}</span>}
              </form>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as PersonaKey)}
                style={styles.switcher}
              >
                <option value="NON_MEMBER">Continue as guest</option>
                {(clubsFromApi ?? []).map((club) => (
                  <option key={club.id} value={club.code}>
                    Preview: {club.name}
                  </option>
                ))}
              </select>
              <div style={styles.pill}>
                {member.name}
                {member.clubs.length > 0 ? ` • ${member.clubs.map((c) => getClubLabel(clubsFromApi, c)).join(", ")}` : " • Not a member"}
              </div>
            </>
          )}
        </div>
      </header>

      {showChangePassword && loggedInMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#171721", borderRadius: 12, padding: 24, maxWidth: 360, width: "90%" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Change password</h3>
            {changePasswordSuccess ? (
              <p style={{ color: "#8be0a4", fontSize: 13, margin: 0 }}>Password updated. You can close this.</p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setChangePasswordError(null);
                  if (changePasswordNew.length < 8) {
                    setChangePasswordError("New password must be at least 8 characters");
                    return;
                  }
                  if (changePasswordNew !== changePasswordConfirm) {
                    setChangePasswordError("New passwords do not match");
                    return;
                  }
                  setChangePasswordSubmitting(true);
                  try {
                    const res = await fetch(`${API}/api/auth/change-password`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                      },
                      body: JSON.stringify({
                        currentPassword: changePasswordCurrent,
                        newPassword: changePasswordNew
                      })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setChangePasswordError(data?.error || "Failed to change password");
                      setChangePasswordSubmitting(false);
                      return;
                    }
                    setChangePasswordSuccess(true);
                    setChangePasswordCurrent("");
                    setChangePasswordNew("");
                    setChangePasswordConfirm("");
                  } catch {
                    setChangePasswordError("Could not reach server");
                  } finally {
                    setChangePasswordSubmitting(false);
                  }
                }}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Current password</div>
                  <input
                    type="password"
                    value={changePasswordCurrent}
                    onChange={(e) => setChangePasswordCurrent(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>New password (min 8 characters)</div>
                  <input
                    type="password"
                    value={changePasswordNew}
                    onChange={(e) => setChangePasswordNew(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Confirm new password</div>
                  <input
                    type="password"
                    value={changePasswordConfirm}
                    onChange={(e) => setChangePasswordConfirm(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                    autoComplete="new-password"
                  />
                </label>
                {changePasswordError && <span style={{ fontSize: 12, color: "#e88" }}>{changePasswordError}</span>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={changePasswordSubmitting} style={styles.primaryBtn}>
                    {changePasswordSubmitting ? "Updating…" : "Update password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(false);
                      setChangePasswordError(null);
                      setChangePasswordSuccess(false);
                      setChangePasswordCurrent("");
                      setChangePasswordNew("");
                      setChangePasswordConfirm("");
                    }}
                    style={styles.secondaryBtn}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {changePasswordSuccess && (
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                style={{ ...styles.secondaryBtn, marginTop: 12 }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {showCart && (
        <section style={{ ...styles.card, marginBottom: 14 }}>
          <h2 style={styles.h2}>Cart</h2>
          {cartItems.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8cab", margin: 0 }}>Your cart is empty.</p>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0" }}>
                {cartItems.map((item) => {
                  const p = products.find((x) => x.id === item.productId);
                  const price = p ? computeMemberPriceCents(p, member.clubs) * item.quantity : 0;
                  return (
                    <li
                      key={item.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid #262637"
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        {p?.name ?? item.productId} × {item.quantity} — {formatUSD(price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        style={{ fontSize: 11, color: "#c4a2a2", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #262637" }}>
                <div style={{ fontSize: 12, color: "#a3a3bf", marginBottom: 8 }}>Add a tip (on subtotal {formatUSD(cartSubtotalCents)})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {suggestedTipPercents.map((pct) => {
                    const tipCents = Math.round((cartSubtotalCents * pct) / 100);
                    const isSelected = checkoutTipCustom.trim() === "" && selectedTipPercent === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => { setSelectedTipPercent(pct); setCheckoutTipCustom(""); }}
                        style={{
                          padding: "0.35rem 0.65rem",
                          borderRadius: 8,
                          border: isSelected ? "1px solid #5677fc" : "1px solid #262637",
                          background: isSelected ? "rgba(86,119,252,0.2)" : "transparent",
                          color: "#e5e7ff",
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        {pct === 0 ? "No tip" : `${pct}%`}
                        {pct > 0 && tipCents > 0 ? ` (${formatUSD(tipCents)})` : ""}
                      </button>
                    );
                  })}
                  <span style={{ fontSize: 12, color: "#8a8cab" }}>or</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Custom $"
                    value={checkoutTipCustom}
                    onChange={(e) => { setCheckoutTipCustom(e.target.value); setSelectedTipPercent(null); }}
                    style={{
                      width: 80,
                      padding: "0.35rem 0.5rem",
                      fontSize: 12,
                      background: "#17172b",
                      border: "1px solid #262637",
                      borderRadius: 8,
                      color: "#f5f5f7"
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                style={{ ...styles.primaryBtn, marginTop: 14 }}
                onClick={() => { setShowCart(false); startCheckout(); }}
              >
                Checkout with Stripe
              </button>
            </>
          )}
        </section>
      )}

      {checkoutClientSecret && checkoutPublishableKey && (
        <section style={{ ...styles.card, marginBottom: 14 }}>
          <h2 style={styles.h2}>Complete payment</h2>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: checkoutClientSecret }}
          >
            <CheckoutForm
              clientSecret={checkoutClientSecret}
              onSuccess={() => {
                setCheckoutClientSecret(null);
                setCheckoutPublishableKey(null);
                setCartItems([]);
                setShowCart(false);
                alert("Payment successful!");
              }}
              onCancel={() => {
                setCheckoutClientSecret(null);
                setCheckoutPublishableKey(null);
              }}
            />
          </Elements>
        </section>
      )}

      {!isGuest && (
        <section style={styles.grid3}>
          <div style={{ ...styles.tile, ...styles.tileAccent }}>
            <div style={styles.tileLabel}>Ready for pickup</div>
            <div style={styles.tileValue}>{pickupReady.length}</div>
            <div style={styles.tileHint}>Items waiting at the brewery</div>
          </div>
          <div style={styles.tile}>
            <div style={styles.tileLabel}>Upcoming preorders</div>
            <div style={styles.tileValue}>{upcomingPreorders.length}</div>
            <div style={styles.tileHint}>Paid items that will move to pickup</div>
          </div>
          <div style={styles.tile}>
            <div style={styles.tileLabel}>Eligible products</div>
            <div style={styles.tileValue}>{eligible.length}</div>
            <div style={styles.tileHint}>Only items allowed for your club(s)</div>
          </div>
        </section>
      )}

      <div style={styles.grid2}>
        {!isGuest && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Pickup items</h2>
            <>
              <div style={styles.cardSub}>Ready</div>
              {pickupReady.map((i) => (
                <div key={i.id} style={styles.row}>
                  <div>
                    <div style={styles.rowTitle}>{i.name}</div>
                    <div style={styles.rowMeta}>Qty: {i.quantity}</div>
                  </div>
                  <span style={{ ...styles.badge, ...styles.badgeReady }}>
                    {i.status}
                  </span>
                </div>
              ))}
              <div style={{ ...styles.cardSub, marginTop: 14 }}>
                Upcoming preorders
              </div>
              {upcomingPreorders.map((i) => (
                <div key={i.id} style={styles.row}>
                  <div>
                    <div style={styles.rowTitle}>{i.name}</div>
                    <div style={styles.rowMeta}>
                      Qty: {i.quantity} • Releases {i.release}
                    </div>
                  </div>
                  <span style={{ ...styles.badge, ...styles.badgePreorder }}>
                    {i.status}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #262637" }}>
                <button
                  type="button"
                  onClick={() => setShowPickupQr((s) => !s)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #262637",
                    background: showPickupQr ? "rgba(86, 119, 252, 0.15)" : "transparent",
                    color: "#b8c8ff",
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  {showPickupQr ? "Hide QR code" : "Show QR code for staff"}
                </button>
                {showPickupQr && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 13, color: "#a3a3bf", margin: "0 0 10px 0" }}>
                      Show this QR to staff at pickup so they can scan and mark your items as picked up.
                    </p>
                    {getStaffPickupBase().includes("localhost") && (
                      <p style={{ fontSize: 12, color: "#b8860b", margin: "0 0 10px 0" }}>
                        Phone can&apos;t connect? Open this page at <strong>http://YOUR_IP:5174</strong> (replace YOUR_IP with your computer&apos;s IP; same Wi‑Fi as the phone). Then the QR will work when staff scan it.
                      </p>
                    )}
                    {pickupQrDataUrl ? (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
                        <img
                          src={pickupQrDataUrl}
                          alt="Pickup QR code"
                          width={200}
                          height={200}
                          style={{ borderRadius: 8, background: "#fff" }}
                        />
                        <div style={{ fontSize: 12, color: "#8a8cab", maxWidth: 240 }}>
                          Staff scans to open your pickup list and tap &quot;Mark picked up&quot; for each item.
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "#8a8cab", margin: 0 }}>Generating QR…</p>
                    )}
                  </div>
                )}
              </div>
            </>
          </section>
        )}

        <section style={{ ...styles.card, ...(isGuest ? { gridColumn: "1 / -1" } : {}) }}>
          <h2 style={styles.h2}>Order via Toast</h2>
          {!isGuest && (
            <div style={styles.toastHeader}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                Your clubs: {member.clubs.map((c) => getClubLabel(clubsFromApi, c)).join(", ")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {member.toastPromoCodes.map((p) => (
                  <span key={p.club} style={styles.codeChip}>
                    {getClubLabel(clubsFromApi, p.club)} code: <strong>{p.code}</strong>
                  </span>
                ))}
              </div>
              <div style={styles.toastHint}>
                Paste your code at Toast checkout to apply your discount.
              </div>
            </div>
          )}
          {isGuest && (
            <div style={styles.toastHeader}>
              <div style={styles.toastHint}>
                Create an account or join a club to get a member promo code for
                discounts on Toast orders.
              </div>
            </div>
          )}
          <div style={styles.inAppBrowserBlock}>
            <p style={styles.inAppBrowserCopy}>
              {isGuest
                ? "You can still order from Toast below. Join a club to unlock member discounts and member-only releases."
                : "Open Toast in an in-app browser to order. Use your promo code at checkout, then close the browser or return here when done."}
            </p>
            <button
              type="button"
              style={styles.openToastButton}
              onClick={() => window.open(TOAST_URL, "_blank", "noopener,noreferrer")}
            >
              Open Toast to order
            </button>
            {isGuest && (
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setShowCreateAccountForm(true)}
              >
                Create account
              </button>
            )}
          </div>
        </section>
      </div>

      {isGuest ? (
        <section style={styles.card}>
          <h2 style={styles.h2}>Join a club</h2>
          <p style={{ fontSize: 13, color: "#a3a3bf", marginTop: 0, marginBottom: 14 }}>
            Purchase a membership to get member-only releases, Toast
            discounts, and pickup perks. Check out with Stripe below.
          </p>
          {(() => {
            const activeOfferings = memberships.filter((m) => m.isActive);
            if (activeOfferings.length === 0) {
              return (
                <div style={{ padding: "1rem 0" }}>
                  <p style={{ fontSize: 13, color: "#8a8cab", margin: 0 }}>
                    No membership offerings available right now. Check back later or contact the brewery.
                  </p>
                </div>
              );
            }
            return (
              <div style={styles.joinGrid}>
                {activeOfferings.map((offering) => (
                  <div key={offering.id} style={styles.joinCard}>
                    <div style={styles.productTitle}>{offering.name}</div>
                    <div style={styles.productDesc}>
                      {offering.description || `${offering.clubCode} Club • ${offering.year} membership`}
                    </div>
                    {typeof offering.year === "number" && (
                      <div style={{ fontSize: 12, color: "#8a8cab", marginTop: 4 }}>
                        {offering.year} membership
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>
                      {formatUSD(offering.priceCents)}
                    </div>
                    <button
                      type="button"
                      style={styles.primaryBtn}
                      onClick={() => startCheckout(offering.id)}
                      disabled={offering.priceCents <= 0}
                    >
                      Purchase membership
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #262637" }}>
            <p style={{ fontSize: 12, color: "#8a8cab", marginBottom: 8 }}>
              Don&apos;t have an account yet?
            </p>
            {createAccountSuccess ? (
              <p style={{ fontSize: 13, color: "#8be0a4", margin: 0 }}>
                Account created. You can purchase a membership above or sign in when that&apos;s available.
              </p>
            ) : showCreateAccountForm ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!createAccountEmail.trim()) return;
                  if (!createAccountFirstName.trim() || !createAccountLastName.trim()) {
                    alert("First name and last name are required.");
                    return;
                  }
                  if (!createAccountPassword || createAccountPassword.length < 8) {
                    alert("Password must be at least 8 characters.");
                    return;
                  }
                  setCreateAccountSubmitting(true);
                  try {
                    const res = await fetch(`${API}/api/register`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: createAccountEmail.trim(),
                        firstName: createAccountFirstName.trim(),
                        lastName: createAccountLastName.trim(),
                        password: createAccountPassword
                      })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      alert(err?.error || "Could not create account.");
                      setCreateAccountSubmitting(false);
                      return;
                    }
                    setCreateAccountSuccess(true);
                    setCreateAccountEmail("");
                    setCreateAccountFirstName("");
                    setCreateAccountLastName("");
                    setCreateAccountPassword("");
                    setShowCreateAccountForm(false);
                  } catch {
                    alert("Could not reach server.");
                  } finally {
                    setCreateAccountSubmitting(false);
                  }
                }}
                style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}
              >
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Email</div>
                  <input
                    type="email"
                    value={createAccountEmail}
                    onChange={(e) => setCreateAccountEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                  />
                </label>
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Password (min 8 characters)</div>
                  <input
                    type="password"
                    value={createAccountPassword}
                    onChange={(e) => setCreateAccountPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    required
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                  />
                </label>
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>First name</div>
                  <input
                    type="text"
                    value={createAccountFirstName}
                    onChange={(e) => setCreateAccountFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                  />
                </label>
                <label>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Last name</div>
                  <input
                    type="text"
                    value={createAccountLastName}
                    onChange={(e) => setCreateAccountLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #262637", background: "#0d0d14", color: "#f5f5f7", fontSize: 13 }}
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={createAccountSubmitting} style={styles.primaryBtn}>
                    {createAccountSubmitting ? "Creating…" : "Create account"}
                  </button>
                  <button type="button" onClick={() => setShowCreateAccountForm(false)} style={styles.secondaryBtn}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" style={styles.secondaryBtn} onClick={() => setShowCreateAccountForm(true)}>
                Create account
              </button>
            )}
          </div>
        </section>
      ) : (
        <section style={styles.card}>
          <div style={styles.sectionHead}>
            <h2 style={styles.h2}>Club exclusive items</h2>
            <div style={styles.cardSub}>
              {member.clubs.length > 0 && member.clubs[0]
                ? `${getClubLabel(clubsFromApi, member.clubs[0])} pricing shown`
                : "Your club pricing is shown"}
            </div>
          </div>

          <div style={styles.productGrid}>
            {eligible.map((p) => {
              const price = computeMemberPriceCents(p, member.clubs);
              const isOverride = price !== p.basePriceCents;
              const firstClub = member.clubs[0];
              return (
                <div key={p.id} style={styles.productCard}>
                  <div style={styles.productTitle}>{p.name}</div>
                  <div style={styles.productMeta}>
                    Available to: {p.allowedClubs.map((c) => getClubLabel(clubsFromApi, c)).join(", ")}
                  </div>
                  <div style={styles.productDesc}>{p.description}</div>

                  <div style={styles.priceRow}>
                    <div style={styles.priceMain}>{formatUSD(price)}</div>
                    {isOverride && firstClub && (
                      <div style={styles.priceSub}>
                        Base {formatUSD(p.basePriceCents)} • Your {getClubLabel(clubsFromApi, firstClub)} price
                      </div>
                    )}
                  </div>

                  {p.isPreorder && p.preorderWindow ? (
                    <div style={styles.preorderBox}>
                      <div style={styles.preorderTitle}>Preorder</div>
                      <div style={styles.preorderMeta}>
                        Window: {p.preorderWindow.start} – {p.preorderWindow.end}
                      </div>
                      <div style={styles.preorderMeta}>
                        Moves to pickup: {p.preorderWindow.release}
                      </div>
                      <button
                        style={styles.primaryBtn}
                        type="button"
                        onClick={() => addToCart(p.id, 1)}
                      >
                        Add to cart
                      </button>
                    </div>
                  ) : (
                    <button
                      style={styles.primaryBtn}
                      type="button"
                      onClick={() => addToCart(p.id, 1)}
                    >
                      Add to cart
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0b10",
    color: "#f5f5f7",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "1.5rem 2rem"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
    gap: 12
  },
  brand: { fontSize: 12, letterSpacing: 1, opacity: 0.7, textTransform: "uppercase" },
  h1: { margin: "0.25rem 0 0", fontSize: 22 },
  sub: { marginTop: 6, fontSize: 13, color: "#a3a3bf" },
  pill: {
    fontSize: 12,
    color: "#a3a3bf",
    padding: "0.35rem 0.75rem",
    borderRadius: 999,
    border: "1px solid #262637",
    whiteSpace: "nowrap"
  },
  switcher: {
    fontSize: 12,
    padding: "0.35rem 0.55rem",
    borderRadius: 999,
    border: "1px solid #2a2a3a",
    backgroundColor: "#050509",
    color: "#f5f5f7"
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 14
  },
  tile: {
    padding: "0.95rem 1.05rem",
    borderRadius: 16,
    backgroundColor: "#11111a",
    border: "1px solid #262637"
  },
  tileAccent: {
    background:
      "linear-gradient(135deg, rgba(86,119,252,0.25), rgba(5,5,15,0.95))",
    border: "1px solid rgba(86,119,252,0.6)"
  },
  tileLabel: { fontSize: 12, color: "#a3a3bf", marginBottom: 8 },
  tileValue: { fontSize: 22, fontWeight: 700 },
  tileHint: { marginTop: 4, fontSize: 12, color: "#6f7087" },
  grid2: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 14,
    marginBottom: 14
  },
  card: {
    padding: "1.15rem 1.25rem 1.35rem",
    borderRadius: 18,
    backgroundColor: "#11111a",
    border: "1px solid #262637"
  },
  h2: { margin: 0, fontSize: 16 },
  cardSub: { marginTop: 6, fontSize: 12, color: "#8a8cab" },
  row: {
    marginTop: 10,
    padding: "0.7rem 0.8rem",
    borderRadius: 14,
    backgroundColor: "#0d0d14",
    border: "1px solid #1a1a25",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  rowTitle: { fontSize: 13, fontWeight: 600 },
  rowMeta: { marginTop: 2, fontSize: 11, color: "#8a8cab" },
  badge: {
    fontSize: 11,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    border: "1px solid #262637",
    whiteSpace: "nowrap"
  },
  badgeReady: { color: "#8be0a4" },
  badgePreorder: { color: "#d0b0ff" },
  toastHeader: {
    marginTop: 10,
    padding: "0.9rem 0.9rem",
    borderRadius: 14,
    backgroundColor: "#171722",
    border: "1px solid #262637"
  },
  codeChip: {
    padding: "0.35rem 0.6rem",
    borderRadius: 999,
    backgroundColor: "#222236",
    fontSize: 12
  },
  toastHint: { marginTop: 8, fontSize: 11, color: "#9b9dc1" },
  inAppBrowserBlock: {
    marginTop: 14,
    padding: "1rem 1rem",
    borderRadius: 14,
    border: "1px solid #262637",
    backgroundColor: "#0d0d14"
  },
  inAppBrowserCopy: {
    margin: 0,
    fontSize: 12,
    color: "#a3a3bf",
    marginBottom: 12
  },
  openToastButton: {
    width: "100%",
    padding: "0.75rem 1.25rem",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #5677fc, #7f5dff)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer"
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12
  },
  productGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12
  },
  productCard: {
    padding: "0.95rem 1rem",
    borderRadius: 16,
    backgroundColor: "#0d0d14",
    border: "1px solid #1a1a25"
  },
  productTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  productMeta: { fontSize: 11, color: "#8a8cab", marginBottom: 8 },
  productDesc: { fontSize: 12, color: "#c3c3e0", marginBottom: 10 },
  priceRow: { marginBottom: 10 },
  priceMain: { fontSize: 18, fontWeight: 800 },
  priceSub: { marginTop: 2, fontSize: 11, color: "#9b9dc1" },
  preorderBox: {
    marginTop: 6,
    padding: "0.75rem 0.8rem",
    borderRadius: 14,
    border: "1px solid #2a2a3a",
    backgroundColor: "#121225"
  },
  preorderTitle: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  preorderMeta: { fontSize: 11, color: "#a3a3bf" },
  primaryBtn: {
    marginTop: 10,
    width: "100%",
    padding: "0.55rem 1rem",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #5677fc, #7f5dff, #ff7575)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },
  secondaryBtn: {
    marginTop: 10,
    width: "100%",
    padding: "0.5rem 1rem",
    borderRadius: 999,
    border: "1px solid #5677fc",
    backgroundColor: "transparent",
    color: "#b5c8ff",
    fontWeight: 600,
    cursor: "pointer"
  },
  guestEmpty: {
    padding: "1rem 0"
  },
  guestEmptyText: {
    margin: 0,
    fontSize: 13,
    color: "#a3a3bf",
    marginBottom: 12
  },
  joinGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12
  },
  joinCard: {
    padding: "1rem",
    borderRadius: 16,
    backgroundColor: "#0d0d14",
    border: "1px solid #1a1a25"
  }
};

