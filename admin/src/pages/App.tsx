import React from "react";
import { useAdminAuth } from "../AdminAuthContext";

type ClubCode = string;

/** Resolve club display name from API-loaded clubs. */
function clubLabelFromList(clubs: { code: string; name: string }[] | null, code: string): string {
  if (!clubs) return code;
  return clubs.find((c) => c.code === code)?.name ?? code;
}

/** Default preorder date strings to 12:00 AM when only a date (YYYY-MM-DD) is provided. */
function preorderDateToMidnight(s: string): string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s;
  return s.trim() + "T00:00";
}

type ClubPrice = {
  clubCode: ClubCode;
  priceCents: number | "";
};

type ViewKey =
  | "dashboard"
  | "clubs"
  | "products"
  | "memberships"
  | "pickups"
  | "developerFees"
  | "settings"
  | "manageMemberships"
  | "shop"
  | "tips"
  | "notifications";

type TaxRateOption = { id: string; name: string; ratePercent: number };

export const App: React.FC = () => {
  const { apiRequest, logout, isDeveloper } = useAdminAuth();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [basePriceCents, setBasePriceCents] = React.useState<number | "">("");
  const [allowedClubs, setAllowedClubs] = React.useState<ClubCode[]>([]);
  const [clubPrices, setClubPrices] = React.useState<ClubPrice[]>([]);
  const [isPreorder, setIsPreorder] = React.useState(false);
  const [preorderStart, setPreorderStart] = React.useState<string>("");
  const [preorderEnd, setPreorderEnd] = React.useState<string>("");
  const [releaseAt, setReleaseAt] = React.useState<string>("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [developerFeePercent, setDeveloperFeePercent] =
    React.useState<number | "">("");
  const [developerConnectAccountId, setDeveloperConnectAccountId] = React.useState("");
  const [feeConfigSaving, setFeeConfigSaving] = React.useState(false);
  const [taxRateId, setTaxRateId] = React.useState<string>("");
  const [taxRatesList, setTaxRatesList] = React.useState<TaxRateOption[]>([]);
  const [newTaxName, setNewTaxName] = React.useState("");
  const [newTaxPercent, setNewTaxPercent] = React.useState<number | "">("");
  const [suggestedTipPercents, setSuggestedTipPercents] = React.useState<number[]>([0, 10, 15, 20, 25]);
  const [suggestedTipPercentsInput, setSuggestedTipPercentsInput] = React.useState("");
  const [tipPercentagesSaving, setTipPercentagesSaving] = React.useState(false);
  const [salesTaxReportMonth, setSalesTaxReportMonth] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [salesTaxReportData, setSalesTaxReportData] = React.useState<{
    month: string;
    byTaxRate: { taxRateId: string; taxRateName: string; ratePercent: number; totalTaxCents: number; transactionCount: number }[];
    totalTaxCents: number;
    transactionCount: number;
  } | null>(null);
  const [salesTaxReportLoading, setSalesTaxReportLoading] = React.useState(false);
  const [stripeEnabled, setStripeEnabled] = React.useState(false);
  const [stripePublishableKey, setStripePublishableKey] = React.useState("");
  const [stripeSecretKey, setStripeSecretKey] = React.useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = React.useState("");
  const [stripeSecretKeyConfigured, setStripeSecretKeyConfigured] = React.useState(false);
  const [stripeWebhookConfigured, setStripeWebhookConfigured] = React.useState(false);
  const [stripeAchThresholdDollars, setStripeAchThresholdDollars] = React.useState<number | "">(50);
  const [stripeSaving, setStripeSaving] = React.useState(false);
  const [usersList, setUsersList] = React.useState<{ id: string; email: string; name: string | null }[]>([]);
  const [userMembershipsList, setUserMembershipsList] = React.useState<
    { id: string; userId: string; clubCode: string; year: number; status: string; userEmail: string | null; userName: string | null }[]
  >([]);
  const [addMembershipUserId, setAddMembershipUserId] = React.useState("");
  const [addMembershipUserSearch, setAddMembershipUserSearch] = React.useState("");
  const [addMembershipSearchOpen, setAddMembershipSearchOpen] = React.useState(false);
  const [addMembershipClub, setAddMembershipClub] = React.useState<ClubCode>("");
  const [addMembershipYear, setAddMembershipYear] = React.useState<number | "">(2026);
  const [transferRecordId, setTransferRecordId] = React.useState<string | null>(null);
  const [transferToUserId, setTransferToUserId] = React.useState("");
  const [transferToUserSearch, setTransferToUserSearch] = React.useState("");
  const [transferSearchOpen, setTransferSearchOpen] = React.useState(false);
  const [view, setView] = React.useState<ViewKey>("dashboard");
  const [productFilter, setProductFilter] = React.useState<
    "active" | "inactive"
  >("active");
  const [productSort, setProductSort] = React.useState<"name" | "club">("name");
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null);
  const [inventoryQuantity, setInventoryQuantity] = React.useState<number | "">("");
  const [editingInventoryProductId, setEditingInventoryProductId] = React.useState<string | null>(null);
  const [inlineInventoryValue, setInlineInventoryValue] = React.useState<string>("");
  const [allocationModalProduct, setAllocationModalProduct] = React.useState<{ id: string; name: string } | null>(null);
  const [allocationTargetType, setAllocationTargetType] = React.useState<"club" | "members">("club");
  const [allocationClubCode, setAllocationClubCode] = React.useState<ClubCode>("");
  const [allocationMemberIds, setAllocationMemberIds] = React.useState("");
  const [allocationQuantityPerPerson, setAllocationQuantityPerPerson] = React.useState<number | "">(1);
  const [allocationPullFromInventory, setAllocationPullFromInventory] = React.useState(false);
  const [allocationList, setAllocationList] = React.useState<{ id: string; quantityPerPerson: number; targetType: string; clubCode?: string; memberIds: string[]; totalQuantity: number }[]>([]);
  const [allocationSaving, setAllocationSaving] = React.useState(false);
  const [memberSort, setMemberSort] = React.useState<
    "name" | "club" | "year"
  >("name");
  const [membersSearchQuery, setMembersSearchQuery] = React.useState("");
  const [clubsFromApi, setClubsFromApi] = React.useState<
    { id: string; name: string; code: string; description: string }[] | null
  >(null);
  const [clubsLoadError, setClubsLoadError] = React.useState<string | null>(null);
  const [clubsSeeding, setClubsSeeding] = React.useState(false);
  const [editingClubId, setEditingClubId] = React.useState<string | null>(null);
  const [editClubName, setEditClubName] = React.useState("");
  const [editClubCode, setEditClubCode] = React.useState("");
  const [editClubDescription, setEditClubDescription] = React.useState("");
  const [tipsAvailableCents, setTipsAvailableCents] = React.useState<number | null>(null);
  const [tipsWithdrawals, setTipsWithdrawals] = React.useState<{ id: string; amountCents: number; withdrawnAt: string; note: string | null }[]>([]);
  const [tipsWithdrawCents, setTipsWithdrawCents] = React.useState<string>("");
  const [tipsWithdrawNote, setTipsWithdrawNote] = React.useState("");
  const [tipsWithdrawing, setTipsWithdrawing] = React.useState(false);
  const [notificationTitle, setNotificationTitle] = React.useState("");
  const [notificationBody, setNotificationBody] = React.useState("");
  const [notificationClubCodes, setNotificationClubCodes] = React.useState<ClubCode[]>([]);
  const [notificationsList, setNotificationsList] = React.useState<
    { id: string; title: string; body: string; clubCodes: string[]; status: string; scheduledFor: string | null; sentAt: string | null }[]
  >([]);
  const [notificationSending, setNotificationSending] = React.useState(false);
  const [notificationScheduledFor, setNotificationScheduledFor] = React.useState("");
  const [pickupsList, setPickupsList] = React.useState<
    { id: string; userId: string; productName: string; quantity: number; status: "READY_FOR_PICKUP" | "PICKED_UP"; source: string; pickedUpAt: string | null; memberName: string | null; memberEmail: string | null }[]
  >([]);
  const [pickupsFilter, setPickupsFilter] = React.useState<"all" | "ready" | "picked">("all");
  const [pickupsSearch, setPickupsSearch] = React.useState("");
  const [pickupsTogglingId, setPickupsTogglingId] = React.useState<string | null>(null);

  // Membership workflow form
  const [membershipClub, setMembershipClub] = React.useState<ClubCode>("");
  const [membershipDescription, setMembershipDescription] = React.useState("");
  const [membershipSaleStart, setMembershipSaleStart] = React.useState("");
  const [membershipSaleEnd, setMembershipSaleEnd] = React.useState("");
  const [membershipYear, setMembershipYear] = React.useState<number | "">(2026);
  const [membershipCapacity, setMembershipCapacity] = React.useState<number | "">("");
  const [membershipPriceCents, setMembershipPriceCents] = React.useState<number | "">("");
  const [membershipPriceInput, setMembershipPriceInput] = React.useState("");
  const [membershipTaxRateId, setMembershipTaxRateId] = React.useState<string>("");
  const [membershipToastDiscountCode, setMembershipToastDiscountCode] = React.useState("");
  const [membershipAllowedClubs, setMembershipAllowedClubs] = React.useState<ClubCode[]>([]);
  const [membershipList, setMembershipList] = React.useState<
    {
      id: string;
      clubCode: string;
      name: string;
      description: string;
      saleStartAt: string | null;
      saleEndAt: string | null;
      year: number;
      capacity: number;
      soldCount: number;
      isActive?: boolean;
      priceCents?: number;
      taxRateId?: string | null;
      toastDiscountCode?: string;
      allowedClubCodes?: ClubCode[];
    }[]
  >([]);
  const [membershipSaving, setMembershipSaving] = React.useState(false);
  const [editingMembershipId, setEditingMembershipId] = React.useState<string | null>(null);

  const loadMemberships = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/memberships");
      if (res.ok) {
        const data = await res.json();
        setMembershipList(data);
      }
    } catch {
      setMembershipList([]);
    }
  }, []);

  React.useEffect(() => {
    if (view === "memberships") loadMemberships();
  }, [view, loadMemberships]);

  const loadTaxRates = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/config/tax-rates");
      if (res.ok) {
        const data: TaxRateOption[] = await res.json();
        setTaxRatesList(data);
      }
    } catch {
      setTaxRatesList([]);
    }
  }, []);

  const loadTipPercentages = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/config/tip-percentages");
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data.suggestedTipPercents) ? data.suggestedTipPercents : [0, 10, 15, 20, 25];
        setSuggestedTipPercents(arr);
        setSuggestedTipPercentsInput(arr.join(", "));
      }
    } catch {
      setSuggestedTipPercents([0, 10, 15, 20, 25]);
      setSuggestedTipPercentsInput("0, 10, 15, 20, 25");
    }
  }, []);

  React.useEffect(() => {
    if (view === "settings" || view === "products" || view === "memberships") loadTaxRates();
  }, [view, loadTaxRates]);

  React.useEffect(() => {
    if (view === "settings") loadTipPercentages();
  }, [view, loadTipPercentages]);

  const loadStripeConfig = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/config/stripe");
      if (res.ok) {
        const data = await res.json();
        setStripeEnabled(!!data.enabled);
        setStripePublishableKey(data.publishableKey || "");
        setStripeSecretKey("");
        setStripeWebhookSecret("");
        setStripeSecretKeyConfigured(!!data.secretKeyConfigured);
        setStripeWebhookConfigured(!!data.webhookSecretConfigured);
        const cents = typeof data.achDefaultThresholdCents === "number" ? data.achDefaultThresholdCents : 5000;
        setStripeAchThresholdDollars(cents > 0 ? cents / 100 : "");
      }
    } catch {
      setStripeEnabled(false);
      setStripePublishableKey("");
      setStripeSecretKeyConfigured(false);
      setStripeWebhookConfigured(false);
    }
  }, []);

  React.useEffect(() => {
    if (view === "settings") loadStripeConfig();
  }, [view, loadStripeConfig]);

  const loadClubs = React.useCallback(async () => {
    setClubsLoadError(null);
    try {
      const res = await apiRequest("/api/clubs");
      if (res.ok) {
        const data = await res.json();
        setClubsFromApi(Array.isArray(data) ? data : []);
      } else {
        setClubsFromApi([]);
        setClubsLoadError(`API returned ${res.status}. Check that the backend is running.`);
      }
    } catch {
      setClubsFromApi([]);
      setClubsLoadError("Could not reach the API. Check that the backend is running and VITE_API_BASE is set (e.g. https://your-backend.up.railway.app).");
    }
  }, [apiRequest]);

  React.useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  React.useEffect(() => {
    if (clubsFromApi && clubsFromApi.length > 0) {
      if (!addMembershipClub || !clubsFromApi.some((c) => c.code === addMembershipClub)) {
        setAddMembershipClub(clubsFromApi[0].code);
      }
      if (!allocationClubCode || !clubsFromApi.some((c) => c.code === allocationClubCode)) {
        setAllocationClubCode(clubsFromApi[0].code);
      }
      if (!membershipClub || !clubsFromApi.some((c) => c.code === membershipClub)) {
        setMembershipClub(clubsFromApi[0].code);
      }
      setClubPrices((prev) =>
        prev.length === 0
          ? clubsFromApi.map((c) => ({ clubCode: c.code, priceCents: "" as number | "" }))
          : prev
      );
    }
  }, [clubsFromApi]);

  const loadTips = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/tips");
      if (res.ok) {
        const data = await res.json();
        setTipsAvailableCents(data.availableCents ?? 0);
        setTipsWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
      } else {
        setTipsAvailableCents(null);
        setTipsWithdrawals([]);
      }
    } catch {
      setTipsAvailableCents(null);
      setTipsWithdrawals([]);
    }
  }, []);

  React.useEffect(() => {
    if (view === "tips") loadTips();
  }, [view, loadTips]);

  const loadNotifications = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotificationsList(Array.isArray(data) ? data : []);
      } else setNotificationsList([]);
    } catch {
      setNotificationsList([]);
    }
  }, []);

  const loadPickups = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/pickups");
      if (res.ok) {
        const data = await res.json();
        setPickupsList(data.pickups ?? []);
      } else {
        setPickupsList([]);
      }
    } catch {
      setPickupsList([]);
    }
  }, []);

  React.useEffect(() => {
    if (view === "notifications") loadNotifications();
    if (view === "pickups") loadPickups();
  }, [view, loadNotifications, loadPickups]);

  const loadFeeConfig = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/config/fees");
      if (res.ok) {
        const data = await res.json();
        setDeveloperFeePercent(
          typeof data.developerFeePercent === "number" ? data.developerFeePercent : ""
        );
        setDeveloperConnectAccountId(data.developerConnectAccountId ?? "");
      }
    } catch {
      setDeveloperFeePercent("");
      setDeveloperConnectAccountId("");
    }
  }, []);

  React.useEffect(() => {
    if (view === "developerFees") loadFeeConfig();
  }, [view, loadFeeConfig]);

  React.useEffect(() => {
    if (!isDeveloper && view === "developerFees") setView("dashboard");
  }, [isDeveloper, view]);

  const loadUsers = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch {
      setUsersList([]);
    }
  }, []);

  const loadUserMemberships = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/user-memberships");
      if (res.ok) {
        const data = await res.json();
        setUserMembershipsList(data);
      }
    } catch {
      setUserMembershipsList([]);
    }
  }, []);

  React.useEffect(() => {
    if (view === "manageMemberships" || view === "memberships") {
      if (view === "manageMemberships") loadUsers();
      loadUserMemberships();
    }
  }, [view, loadUsers, loadUserMemberships]);

  const [productsFromApi, setProductsFromApi] = React.useState<
    { id: string; name: string; clubTags: ClubCode[]; isActive: boolean; orderedNotPickedUpCount: number; inventoryQuantity: number }[] | null
  >(null);

  const loadProducts = React.useCallback(async () => {
    try {
      const res = await apiRequest("/api/products?includeInactive=true");
      if (!res.ok) throw new Error("Failed to load products");
      const list: { id: string; name: string; allowedClubs: string[]; isActive: boolean; orderedNotPickedUpCount?: number; inventoryQuantity?: number }[] = await res.json();
      setProductsFromApi(
        list.map((p) => ({
          id: p.id,
          name: p.name,
          clubTags: (p.allowedClubs || []) as ClubCode[],
          isActive: p.isActive,
          orderedNotPickedUpCount: typeof p.orderedNotPickedUpCount === "number" ? p.orderedNotPickedUpCount : 0,
          inventoryQuantity: typeof p.inventoryQuantity === "number" ? p.inventoryQuantity : 0
        }))
      );
    } catch {
      setProductsFromApi(null);
    }
  }, []);

  React.useEffect(() => {
    if (view !== "products") return;
    loadProducts();
  }, [view, loadProducts]);

  // Stubbed data – used when API is unavailable
  const mockProducts = React.useMemo(
    () => [
      {
        id: "1",
        name: "Barrel-Aged Stout 2026",
        clubTags: ["WOOD", "FOUNDERS"] as ClubCode[],
        isActive: true,
        orderedNotPickedUpCount: 0,
        inventoryQuantity: 0
      },
      {
        id: "2",
        name: "Sap Club IPA Box",
        clubTags: ["SAP"],
        isActive: true,
        orderedNotPickedUpCount: 0,
        inventoryQuantity: 0
      },
      {
        id: "3",
        name: "Cellars Reserve 2024",
        clubTags: ["CELLARS"],
        isActive: false,
        orderedNotPickedUpCount: 0,
        inventoryQuantity: 0
      }
    ],
    []
  );

  const productList = productsFromApi ?? mockProducts;

  const filteredProducts = React.useMemo(() => {
    const filtered = productList.filter((p) =>
      productFilter === "active" ? p.isActive : !p.isActive
    );

    const clubLabel = (code: ClubCode) =>
      clubLabelFromList(clubsFromApi, code);

    const firstClubLabel = (tags: ClubCode[]) =>
      tags.length ? clubLabel([...tags].sort()[0]) : "";

    return filtered.sort((a, b) => {
      if (productSort === "club") {
        const ac = firstClubLabel(a.clubTags);
        const bc = firstClubLabel(b.clubTags);
        const byClub = ac.localeCompare(bc);
        return byClub !== 0 ? byClub : a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [productList, productFilter, productSort]);

  const membersFromUserMemberships = React.useMemo(() => {
    const byUserId = new Map<
      string,
      { name: string; email: string; memberships: { club: string; year: number }[] }
    >();
    for (const rec of userMembershipsList) {
      const clubLabel = clubLabelFromList(clubsFromApi, rec.clubCode);
      const existing = byUserId.get(rec.userId);
      if (existing) {
        existing.memberships.push({ club: clubLabel, year: rec.year });
      } else {
        byUserId.set(rec.userId, {
          name: rec.userName ?? rec.userEmail ?? rec.userId,
          email: rec.userEmail ?? "",
          memberships: [{ club: clubLabel, year: rec.year }]
        });
      }
    }
    return Array.from(byUserId.entries()).map(([userId, data]) => ({
      id: userId,
      name: data.name,
      email: data.email,
      memberships: data.memberships.sort((a, b) => a.club.localeCompare(b.club) || a.year - b.year)
    }));
  }, [userMembershipsList]);

  const sortedMembers = React.useMemo(() => {
    return [...membersFromUserMemberships].sort((a, b) => {
      if (memberSort === "name") {
        return String(a.name).localeCompare(String(b.name));
      }
      if (memberSort === "club") {
        const aClubs = a.memberships.map((m) => m.club).join(" ");
        const bClubs = b.memberships.map((m) => m.club).join(" ");
        return aClubs.localeCompare(bClubs);
      }
      const aMaxYear = Math.max(...a.memberships.map((m) => m.year), 0);
      const bMaxYear = Math.max(...b.memberships.map((m) => m.year), 0);
      return bMaxYear - aMaxYear;
    });
  }, [membersFromUserMemberships, memberSort]);

  const filteredMembers = React.useMemo(() => {
    const q = membersSearchQuery.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((m) => {
      const name = String(m.name ?? "").toLowerCase();
      const email = String(m.email ?? "").toLowerCase();
      const membershipsStr = m.memberships.map((mb) => `${mb.club} ${mb.year}`).join(" ").toLowerCase();
      return name.includes(q) || email.includes(q) || membershipsStr.includes(q);
    });
  }, [sortedMembers, membersSearchQuery]);

  const toggleClub = (code: ClubCode) => {
    setAllowedClubs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const updateClubPrice = (code: ClubCode, value: string) => {
    const parsed = value === "" ? "" : Number(value) * 100;
    setClubPrices((prev) =>
      prev.map((cp) =>
        cp.clubCode === code ? { ...cp, priceCents: parsed } : cp
      )
    );
  };

  const resetProductForm = React.useCallback(() => {
    setEditingProductId(null);
    setName("");
    setDescription("");
    setBasePriceCents("");
    setAllowedClubs([]);
    setClubPrices((clubsFromApi ?? []).map((c) => ({ clubCode: c.code, priceCents: "" as number | "" })));
    setIsPreorder(false);
    setPreorderStart("");
    setPreorderEnd("");
    setReleaseAt("");
    setImageFile(null);
    setTaxRateId("");
    setInventoryQuantity("");
  }, []);

  const loadProductIntoForm = React.useCallback(
    (p: {
      id: string;
      name: string;
      description?: string;
      basePriceCents: number;
      allowedClubs: ClubCode[];
      clubPrices: { clubCode: ClubCode; priceCents: number }[];
      isPreorder: boolean;
      preorderStartAt?: string | null;
      preorderEndAt?: string | null;
      releaseAt?: string | null;
      taxRateId?: string | null;
      inventoryQuantity?: number;
    }) => {
      setEditingProductId(p.id);
      setName(p.name);
      setDescription(p.description ?? "");
      setBasePriceCents(p.basePriceCents);
      setAllowedClubs(p.allowedClubs ?? []);
      setClubPrices(
        (clubsFromApi ?? []).map((c) => {
          const entry = (p.clubPrices ?? []).find((cp) => cp.clubCode === c.code);
          return {
            clubCode: c.code,
            priceCents: entry ? entry.priceCents : ""
          };
        })
      );
      setIsPreorder(!!p.isPreorder);
      setPreorderStart(preorderDateToMidnight(p.preorderStartAt ?? ""));
      setPreorderEnd(preorderDateToMidnight(p.preorderEndAt ?? ""));
      setReleaseAt(preorderDateToMidnight(p.releaseAt ?? ""));
      setTaxRateId(p.taxRateId ?? "");
      setInventoryQuantity(typeof p.inventoryQuantity === "number" ? p.inventoryQuantity : "");
    },
    []
  );

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseCents = typeof basePriceCents === "number" ? basePriceCents : 0;
    const invQty =
      typeof inventoryQuantity === "number" ? inventoryQuantity : (inventoryQuantity === "" ? 0 : Math.floor(Number(inventoryQuantity)) || 0);
    const payload = {
      name,
      description,
      basePriceCents: baseCents,
      currency: "USD",
      allowedClubIds: allowedClubs,
      clubPrices: clubPrices.filter((cp) => cp.priceCents !== "").map((cp) => ({ clubCode: cp.clubCode, priceCents: typeof cp.priceCents === "number" ? cp.priceCents : 0 })),
      isPreorder,
      preorderStartAt: isPreorder && preorderStart ? preorderDateToMidnight(preorderStart) : null,
      preorderEndAt: isPreorder && preorderEnd ? preorderDateToMidnight(preorderEnd) : null,
      releaseAt: isPreorder && releaseAt ? preorderDateToMidnight(releaseAt) : null,
      taxRateId: taxRateId && taxRateId.trim() !== "" ? taxRateId.trim() : null,
      inventoryQuantity: invQty
    };

    try {
      if (editingProductId) {
        const res = await apiRequest(`/api/products/${editingProductId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const text = await res.text();
          // eslint-disable-next-line no-console
          console.error("Failed to update product", text);
          alert("Updating product failed.");
          return;
        }
        alert("Product updated.");
        resetProductForm();
        loadProducts();
        return;
      }
      const res = await apiRequest("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        // eslint-disable-next-line no-console
        console.error("Failed to save product", text);
        alert("Saving product failed – check backend console for details.");
        return;
      }
      // eslint-disable-next-line no-console
      console.log("Saved product", await res.json());
      alert("Product saved. Refresh member preview to see it.");
      resetProductForm();
      loadProducts();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error calling backend", err);
      alert("Could not reach backend. Check the API URL in settings.");
    }
  };

  const handleSaveFeeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeConfigSaving(true);
    try {
      const res = await apiRequest("/api/config/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerFeePercent:
            typeof developerFeePercent === "number" ? developerFeePercent : 0,
          developerConnectAccountId: developerConnectAccountId.trim() || null
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || "Failed to save fee config.");
        return;
      }
      alert("Developer fee config saved.");
    } catch {
      alert("Could not reach backend.");
    } finally {
      setFeeConfigSaving(false);
    }
  };

  const resetMembershipForm = React.useCallback(() => {
    setEditingMembershipId(null);
    setMembershipClub("WOOD");
    setMembershipDescription("");
    setMembershipSaleStart("");
    setMembershipSaleEnd("");
    setMembershipYear(2026);
    setMembershipCapacity("");
    setMembershipPriceCents("");
    setMembershipPriceInput("");
    setMembershipTaxRateId("");
    setMembershipToastDiscountCode("");
    setMembershipAllowedClubs([]);
  }, []);

  const handleCreateMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    const yearNum = typeof membershipYear === "number" ? membershipYear : parseInt(String(membershipYear), 10);
    if (!yearNum || yearNum < 2020 || yearNum > 2030) {
      alert("Please set a valid year (2020–2030).");
      return;
    }
    const name =
      `${clubLabelFromList(clubsFromApi, membershipClub)} ${yearNum}`;
    const payload = {
      clubCode: membershipClub,
      name,
      description: membershipDescription,
      saleStartAt: membershipSaleStart || null,
      saleEndAt: membershipSaleEnd || null,
      year: yearNum,
      capacity: typeof membershipCapacity === "number" ? membershipCapacity : parseInt(String(membershipCapacity), 10) || 0,
      priceCents: (() => {
        const fromInput = membershipPriceInput.trim() !== "" ? parseFloat(membershipPriceInput) : NaN;
        if (!isNaN(fromInput) && fromInput >= 0) return Math.round(fromInput * 100);
        return typeof membershipPriceCents === "number" ? membershipPriceCents : 0;
      })(),
      taxRateId: membershipTaxRateId && membershipTaxRateId.trim() !== "" ? membershipTaxRateId.trim() : null,
      toastDiscountCode: membershipToastDiscountCode.trim() || undefined,
      allowedClubCodes: membershipAllowedClubs
    };
    setMembershipSaving(true);
    try {
      if (editingMembershipId) {
        const res = await apiRequest(`/api/memberships/${editingMembershipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err?.error || "Failed to update membership.");
          return;
        }
        resetMembershipForm();
        await loadMemberships();
        return;
      }
      const res = await apiRequest("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || "Failed to create membership.");
        return;
      }
      resetMembershipForm();
      await loadMemberships();
    } catch {
      alert("Could not reach backend.");
    } finally {
      setMembershipSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#0b0b10",
        color: "#f5f5f7",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          padding: "1.5rem 1.25rem",
          borderRight: "1px solid #1d1d26",
          background:
            "radial-gradient(circle at top, #17172b 0, #050509 55%, #050509 100%)"
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: "2rem" }}>
          Sapwood Admin
        </div>
        <nav style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <span style={{ opacity: 0.6, fontSize: 11, textTransform: "uppercase" }}>
            Main
          </span>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "dashboard"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "dashboard" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "clubs" ? "rgba(86, 119, 252, 0.18)" : "transparent",
              color: view === "clubs" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("clubs")}
          >
            Clubs
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "products" ? "rgba(86, 119, 252, 0.18)" : "transparent",
              color: view === "products" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("products")}
          >
            Products
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "memberships"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "memberships" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("memberships")}
          >
            Memberships
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "pickups" ? "rgba(86, 119, 252, 0.18)" : "transparent",
              color: view === "pickups" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("pickups")}
          >
            Pickups
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "notifications" ? "rgba(86, 119, 252, 0.18)" : "transparent",
              color: view === "notifications" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("notifications")}
          >
            Notifications
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "shop" ? "rgba(86, 119, 252, 0.18)" : "transparent",
              color: view === "shop" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("shop")}
          >
            Shop
          </button>
          <span
            style={{
              marginTop: 16,
              opacity: 0.6,
              fontSize: 11,
              textTransform: "uppercase"
            }}
          >
            Settings
          </span>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "settings"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "settings" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("settings")}
          >
            Tax rates
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "clubs"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "clubs" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("clubs")}
          >
            Clubs (active clubs)
          </button>
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "manageMemberships"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "manageMemberships" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("manageMemberships")}
          >
            Manage memberships
          </button>
          {isDeveloper && (
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "developerFees"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "developerFees" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("developerFees")}
          >
            Developer fees
          </button>
          )}
          <button
            style={{
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background:
                view === "tips"
                  ? "rgba(86, 119, 252, 0.18)"
                  : "transparent",
              color: view === "tips" ? "#f5f5f7" : "#a3a3bf",
              cursor: "pointer"
            }}
            onClick={() => setView("tips")}
          >
            Tips
          </button>
          <button
            type="button"
            style={{
              marginTop: "auto",
              textAlign: "left",
              border: "none",
              borderRadius: 999,
              padding: "0.5rem 0.9rem",
              background: "transparent",
              color: "#a3a3bf",
              cursor: "pointer",
              fontSize: 13
            }}
            onClick={() => logout()}
          >
            Log out
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: "1.5rem 2rem" }}>
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem"
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>
              {view === "dashboard"
                ? "Dashboard"
                : view === "clubs"
                ? "Clubs"
                : view === "products"
                ? "Products"
                : view === "memberships"
                ? "Memberships"
                : view === "pickups"
                ? "Pickups"
                : view === "notifications"
                ? "Notifications"
                : view === "shop"
                ? "Shop"
                : view === "settings"
                ? "Settings"
                : view === "manageMemberships"
                ? "Manage memberships"
                : view === "tips"
                ? "Tips"
                : "Developer fees"}
            </h1>
            <p style={{ fontSize: 13, marginTop: 4, color: "#a3a3bf" }}>
              {view === "dashboard" &&
                "Overview of clubs and products."}
              {view === "clubs" &&
                "Manage clubs (Wood, Sap, Cellars, Founders). Create default clubs or edit names and codes."}
              {view === "products" &&
                "Review all member products, filter by availability, and edit details below."}
              {view === "memberships" &&
                "Create membership offerings (club, year, sale window, capacity) and view enrolled members."}
              {view === "pickups" &&
                "Track member allocations, preorders, and pickup status (coming soon)."}
              {view === "notifications" &&
                "Send push notifications to members of specific clubs."}
              {view === "developerFees" &&
                "Configure how you, as the developer, are paid from in-app sales."}
              {view === "settings" &&
                "Set possible tax rates for products. Admin and developer can manage these; each product can select one."}
              {view === "manageMemberships" &&
                "Forcibly move memberships between accounts, or add and remove them. Admin and developer only."}
              {view === "shop" &&
                "Preview the member-facing Toast shop header and link to your live ordering page."}
              {view === "tips" &&
                "View available tip balance, pull tips out, and see withdrawal history."}
            </p>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#a3a3bf",
              padding: "0.35rem 0.75rem",
              borderRadius: 999,
              border: "1px solid #262637"
            }}
          >
            Role: {isDeveloper ? "Developer" : "Admin"}
          </div>
        </header>

        {view === "dashboard" && (
          <>
            {/* Summary tiles */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
                marginBottom: "1.75rem"
              }}
            >
              <div
                style={{
                  padding: "1rem 1.1rem",
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(86,119,252,0.25), rgba(5,5,15,0.95))",
                  border: "1px solid rgba(86,119,252,0.6)"
                }}
              >
                <div
                  style={{ fontSize: 12, color: "#cfd3ff", marginBottom: 8 }}
                >
                  Active clubs
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>4</div>
                <div style={{ fontSize: 12, color: "#cfd3ff", marginTop: 4 }}>
                  Sap • Wood • Cellars • Founders
                </div>
              </div>

              <div
                style={{
                  padding: "1rem 1.1rem",
                  borderRadius: 16,
                  backgroundColor: "#11111a",
                  border: "1px solid #262637"
                }}
              >
                <div
                  style={{ fontSize: 12, color: "#a3a3bf", marginBottom: 8 }}
                >
                  Member products
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>—</div>
                <div style={{ fontSize: 12, color: "#6f7087", marginTop: 4 }}>
                  Start by creating your first club-only item.
                </div>
              </div>

            </section>
          </>
        )}

        {(view === "dashboard" || view === "products" || view === "settings") && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
              gap: 20,
              alignItems: "flex-start"
            }}
          >
          {view === "settings" ? (
            <>
            {/* Tax rates card */}
            <section
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637"
              }}
            >
              <h2 style={{ fontSize: 16, margin: 0, marginBottom: 4 }}>Tax rates</h2>
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
                Define tax rates that can be applied to products. Admin and developer can edit; select one per product when creating or editing an item.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem 0", border: "1px solid #262637", borderRadius: 12, overflow: "hidden" }}>
                {taxRatesList.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      borderBottom: "1px solid #262637",
                      fontSize: 13
                    }}
                  >
                    <span>{t.name} — {t.ratePercent}%</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Remove "${t.name}"?`)) return;
                        try {
                          const res = await apiRequest(`/api/config/tax-rates/${t.id}`, { method: "DELETE" });
                          if (res.ok) await loadTaxRates();
                          else alert("Could not delete (may be in use).");
                        } catch {
                          alert("Could not reach backend.");
                        }
                      }}
                      style={{
                        padding: "0.2rem 0.5rem",
                        fontSize: 11,
                        border: "1px solid #3d3d52",
                        borderRadius: 6,
                        background: "transparent",
                        color: "#c4a2a2",
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {taxRatesList.length === 0 && (
                  <li style={{ padding: "0.75rem", color: "#6f7087", fontSize: 12 }}>No tax rates yet. Add one below.</li>
                )}
              </ul>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const rate = typeof newTaxPercent === "number" ? newTaxPercent : parseFloat(String(newTaxPercent));
                  if (!newTaxName.trim() || Number.isNaN(rate) || rate < 0 || rate > 100) {
                    alert("Name and a valid rate (0–100) are required.");
                    return;
                  }
                  try {
                    const res = await apiRequest("/api/config/tax-rates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newTaxName.trim(), ratePercent: rate })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      alert(err?.error || "Failed to add tax rate.");
                      return;
                    }
                    setNewTaxName("");
                    setNewTaxPercent("");
                    await loadTaxRates();
                  } catch {
                    alert("Could not reach backend.");
                  }
                }}
                style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}
              >
                <label style={{ flex: "1 1 120px" }}>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Name</div>
                  <input
                    value={newTaxName}
                    onChange={(e) => setNewTaxName(e.target.value)}
                    placeholder="e.g. Standard"
                    style={inputStyle}
                  />
                </label>
                <label style={{ flex: "0 1 100px" }}>
                  <div style={{ marginBottom: 4, fontSize: 12 }}>Rate %</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={newTaxPercent === "" ? "" : newTaxPercent}
                    onChange={(e) => setNewTaxPercent(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                    style={inputStyle}
                  />
                </label>
                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 999,
                    border: "none",
                    background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  Add tax rate
                </button>
              </form>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #262637" }}>
                <h3 style={{ fontSize: 14, margin: 0, marginBottom: 6 }}>Suggested tip percentages</h3>
                <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 10 }}>
                  Percentages shown as tip options in the member checkout cart (e.g. 0, 10, 15, 20, 25). Enter comma-separated numbers (0–100).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <input
                    type="text"
                    value={suggestedTipPercentsInput}
                    onChange={(e) => setSuggestedTipPercentsInput(e.target.value)}
                    placeholder="0, 10, 15, 20, 25"
                    style={{
                      ...inputStyle,
                      minWidth: 200
                    }}
                  />
                  <button
                    type="button"
                    disabled={tipPercentagesSaving}
                    onClick={async () => {
                      const parsed = suggestedTipPercentsInput
                        .split(",")
                        .map((s) => parseFloat(s.trim()))
                        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 100);
                      if (parsed.length === 0) {
                        alert("Enter at least one valid percentage (0–100).");
                        return;
                      }
                      setTipPercentagesSaving(true);
                      try {
                        const res = await apiRequest("/api/config/tip-percentages", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ suggestedTipPercents: parsed })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setSuggestedTipPercents(data.suggestedTipPercents ?? parsed);
                          setSuggestedTipPercentsInput((data.suggestedTipPercents ?? parsed).join(", "));
                        } else {
                          const err = await res.json().catch(() => ({}));
                          alert(err?.error || "Failed to save.");
                        }
                      } catch {
                        alert("Could not reach backend.");
                      } finally {
                        setTipPercentagesSaving(false);
                      }
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(86, 119, 252, 0.25)",
                      color: "#b8c8ff",
                      fontSize: 12,
                      cursor: tipPercentagesSaving ? "wait" : "pointer"
                    }}
                  >
                    {tipPercentagesSaving ? "Saving…" : "Save tip percentages"}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "#6a6a8a", marginTop: 8, marginBottom: 0 }}>
                  Current: {suggestedTipPercents.join(", ")}%
                </p>
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #262637" }}>
                <h3 style={{ fontSize: 14, margin: 0, marginBottom: 6 }}>Monthly sales tax report</h3>
                <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 10 }}>
                  Generate a report of sales taxes collected by rate for a given month (for tax filing). Data is recorded when Stripe payments succeed.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <input
                    type="month"
                    value={salesTaxReportMonth}
                    onChange={(e) => setSalesTaxReportMonth(e.target.value)}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    disabled={salesTaxReportLoading}
                    onClick={async () => {
                      setSalesTaxReportLoading(true);
                      setSalesTaxReportData(null);
                      try {
                        const res = await apiRequest(`/api/reports/sales-tax?month=${encodeURIComponent(salesTaxReportMonth)}`);
                        if (res.ok) {
                          const data = await res.json();
                          setSalesTaxReportData(data);
                        } else {
                          const err = await res.json().catch(() => ({}));
                          alert(err?.error || "Failed to load report.");
                        }
                      } catch {
                        alert("Could not reach backend.");
                      } finally {
                        setSalesTaxReportLoading(false);
                      }
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(86, 119, 252, 0.25)",
                      color: "#b8c8ff",
                      fontSize: 12,
                      cursor: salesTaxReportLoading ? "wait" : "pointer"
                    }}
                  >
                    {salesTaxReportLoading ? "Loading…" : "Generate report"}
                  </button>
                  {salesTaxReportData && (
                    <button
                      type="button"
                      onClick={() => {
                        const rows = [
                          ["Tax rate", "Rate %", "Tax collected ($)", "Transactions"],
                          ...salesTaxReportData.byTaxRate.map((r) => [
                            r.taxRateName,
                            String(r.ratePercent),
                            (r.totalTaxCents / 100).toFixed(2),
                            String(r.transactionCount)
                          ]),
                          ["Total", "", (salesTaxReportData.totalTaxCents / 100).toFixed(2), String(salesTaxReportData.transactionCount)]
                        ];
                        const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `sales-tax-${salesTaxReportData.month}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{
                        padding: "0.5rem 1rem",
                        borderRadius: 8,
                        border: "1px solid #262637",
                        background: "transparent",
                        color: "#a3a3bf",
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      Download CSV
                    </button>
                  )}
                </div>
                {salesTaxReportData && salesTaxReportData.transactionCount === 0 && (
                  <p style={{ fontSize: 13, color: "#8a8cab", margin: 0 }}>No recorded sales for this month.</p>
                )}
                {salesTaxReportData && salesTaxReportData.transactionCount > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #262637", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Tax rate</th>
                          <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Rate %</th>
                          <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Tax collected</th>
                          <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Transactions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesTaxReportData.byTaxRate.map((r) => (
                          <tr key={r.taxRateId} style={{ borderBottom: "1px solid #1e1e2a" }}>
                            <td style={{ padding: "8px 10px" }}>{r.taxRateName}</td>
                            <td style={{ padding: "8px 10px" }}>{r.ratePercent}%</td>
                            <td style={{ padding: "8px 10px" }}>${(r.totalTaxCents / 100).toFixed(2)}</td>
                            <td style={{ padding: "8px 10px" }}>{r.transactionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 8, marginBottom: 0 }}>
                      Total sales tax for {salesTaxReportData.month}: ${(salesTaxReportData.totalTaxCents / 100).toFixed(2)} ({salesTaxReportData.transactionCount} transaction{salesTaxReportData.transactionCount !== 1 ? "s" : ""})
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Stripe integration card */}
            <section
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637",
                marginTop: 20
              }}
            >
              <h2 style={{ fontSize: 16, margin: 0, marginBottom: 4 }}>Stripe integration</h2>
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
                Connect Stripe to accept payments for memberships and products. Admin and developer can configure keys and webhooks here.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setStripeSaving(true);
                  try {
                    const res = await apiRequest("/api/config/stripe", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        enabled: stripeEnabled,
                        publishableKey: stripePublishableKey.trim() || undefined,
                        secretKey: stripeSecretKey.trim() || undefined,
                        webhookSecret: stripeWebhookSecret.trim() || undefined,
                        achDefaultThresholdCents: stripeAchThresholdDollars === "" || stripeAchThresholdDollars <= 0
                          ? 0
                          : Math.round(Number(stripeAchThresholdDollars) * 100)
                      })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      alert(err?.error || "Failed to save Stripe config.");
                      return;
                    }
                    const data = await res.json();
                    setStripeSecretKeyConfigured(!!data.secretKeyConfigured);
                    setStripeWebhookConfigured(!!data.webhookSecretConfigured);
                    setStripeSecretKey("");
                    setStripeWebhookSecret("");
                    alert("Stripe settings saved.");
                  } catch {
                    alert("Could not reach backend.");
                  } finally {
                    setStripeSaving(false);
                  }
                }}
                style={{ maxWidth: 520, fontSize: 13 }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={stripeEnabled}
                    onChange={(e) => setStripeEnabled(e.target.checked)}
                  />
                  <span>Enable Stripe payments</span>
                </label>
                <label style={{ display: "block", marginBottom: 16 }}>
                  <div style={{ marginBottom: 4 }}>ACH as default for payments over ($)</div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stripeAchThresholdDollars === "" ? "" : stripeAchThresholdDollars}
                    onChange={(e) => setStripeAchThresholdDollars(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    placeholder="50"
                    style={{ ...inputStyle, maxWidth: 120 }}
                  />
                  <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>Payments at or above this amount default to ACH. Set to 0 to disable.</div>
                </label>
                <label style={{ display: "block", marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>Publishable key</div>
                  <input
                    type="text"
                    value={stripePublishableKey}
                    onChange={(e) => setStripePublishableKey(e.target.value)}
                    placeholder="pk_live_... or pk_test_..."
                    style={inputStyle}
                    autoComplete="off"
                  />
                  <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>Safe to use in client-side code.</div>
                </label>
                <label style={{ display: "block", marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>Secret key</div>
                  <input
                    type="password"
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    placeholder={stripeSecretKeyConfigured ? "Leave blank to keep current key" : "sk_live_... or sk_test_..."}
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                  {stripeSecretKeyConfigured && (
                    <div style={{ fontSize: 11, color: "#8be0a4", marginTop: 4 }}>Secret key is configured. Enter a new value only to replace it.</div>
                  )}
                </label>
                <label style={{ display: "block", marginBottom: 16 }}>
                  <div style={{ marginBottom: 4 }}>Webhook signing secret</div>
                  <input
                    type="password"
                    value={stripeWebhookSecret}
                    onChange={(e) => setStripeWebhookSecret(e.target.value)}
                    placeholder={stripeWebhookConfigured ? "Leave blank to keep current" : "whsec_..."}
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                  <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>Optional. For verifying Stripe webhook events.</div>
                </label>
                <button
                  type="submit"
                  disabled={stripeSaving}
                  style={{
                    padding: "0.5rem 1.2rem",
                    borderRadius: 999,
                    border: "none",
                    background: "linear-gradient(135deg, #635bff, #7f5dff)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: stripeSaving ? "wait" : "pointer",
                    opacity: stripeSaving ? 0.8 : 1
                  }}
                >
                  {stripeSaving ? "Saving…" : "Save Stripe settings"}
                </button>
              </form>
            </section>
          </>
          ) : (
          <>
          {/* Product editor */}
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10
              }}
            >
              <h2 style={{ fontSize: 16, margin: 0 }}>
                {editingProductId ? "Edit product" : "Create product"}
              </h2>
              <span style={{ fontSize: 11, color: "#6f7087" }}>
                Member-only releases & allocations
              </span>
            </div>

            <form
              onSubmit={handleSubmitProduct}
              style={{ maxWidth: 640, fontSize: 13 }}
            >
              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Item photo</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImageFile(e.target.files && e.target.files[0]
                      ? e.target.files[0]
                      : null)
                  }
                  style={{
                    width: "100%",
                    fontSize: 12,
                    color: "#f5f5f7"
                  }}
                />
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "#8a8cab"
                  }}
                >
                  Optional. This will be shown to members when browsing releases.
                </div>
              </label>

              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: Barrel-Aged Stout 2026"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tasting notes, pickup rules, allocation details…"
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                />
              </label>

              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ marginBottom: 4 }}>Base price (USD)</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    typeof basePriceCents === "number"
                      ? (basePriceCents / 100).toString()
                      : ""
                  }
                  onChange={(e) =>
                    setBasePriceCents(
                      e.target.value === "" ? "" : Number(e.target.value) * 100
                    )
                  }
                  placeholder="0.00"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ marginBottom: 4 }}>Initial inventory</div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={inventoryQuantity === "" ? "" : inventoryQuantity}
                  onChange={(e) =>
                    setInventoryQuantity(
                      e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  }
                  placeholder="0"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                  Stock quantity when creating this product.
                </div>
              </label>

              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ marginBottom: 4 }}>Tax rate</div>
                <select
                  value={taxRateId}
                  onChange={(e) => setTaxRateId(e.target.value)}
                  style={{
                    ...inputStyle,
                    cursor: "pointer"
                  }}
                >
                  <option value="">None</option>
                  {taxRatesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.ratePercent}%)
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                  Configure options under Settings → Tax rates.
                </div>
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1.7fr)",
                  gap: 16,
                  marginBottom: 16
                }}
              >
                <fieldset
                  style={{
                    border: "1px solid #262637",
                    borderRadius: 12,
                    padding: "0.75rem 0.9rem"
                  }}
                >
                  <legend style={legendStyle}>Allowed clubs</legend>
                  {(clubsFromApi ?? []).map((club) => (
                    <label
                      key={club.code}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <input
                        type="checkbox"
                        checked={allowedClubs.includes(club.code)}
                        onChange={() => toggleClub(club.code)}
                      />
                      <span>{club.name}</span>
                    </label>
                  ))}
                </fieldset>

                <fieldset
                  style={{
                    border: "1px solid #262637",
                    borderRadius: 12,
                    padding: "0.75rem 0.9rem"
                  }}
                >
                  <legend style={legendStyle}>Per-club pricing (optional)</legend>
                  <p style={{ fontSize: 11, color: "#8a8cab", marginTop: 0 }}>
                    Leave blank to use base price. If set, that club sees this
                    price instead.
                  </p>
                  {(clubsFromApi ?? []).map((club) => {
                    const entry = clubPrices.find(
                      (cp) => cp.clubCode === club.code
                    );
                    return (
                      <label
                        key={club.code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 6
                        }}
                      >
                        <span style={{ fontSize: 12 }}>{club.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            entry && typeof entry.priceCents === "number"
                              ? (entry.priceCents / 100).toString()
                              : ""
                          }
                          onChange={(e) =>
                            updateClubPrice(club.code, e.target.value)
                          }
                          placeholder="Override"
                          style={{ ...inputStyle, maxWidth: 120 }}
                        />
                      </label>
                    );
                  })}
                </fieldset>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10
                }}
              >
                <input
                  type="checkbox"
                  checked={isPreorder}
                  onChange={(e) => setIsPreorder(e.target.checked)}
                />
                <span>This is a preorder item</span>
              </label>

              {isPreorder && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                    marginBottom: 18,
                    fontSize: 12
                  }}
                >
                  <label style={{ display: "block" }}>
                    <div style={{ marginBottom: 4 }}>Preorder opens</div>
                    <input
                      type="datetime-local"
                      value={preorderStart}
                      onChange={(e) => setPreorderStart(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <div style={{ marginBottom: 4 }}>Preorder closes</div>
                    <input
                      type="datetime-local"
                      value={preorderEnd}
                      onChange={(e) => setPreorderEnd(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <div style={{ marginBottom: 4 }}>Pickup starts</div>
                    <input
                      type="datetime-local"
                      value={releaseAt}
                      onChange={(e) => setReleaseAt(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              )}

              <button
                type="submit"
                style={{
                  padding: "0.55rem 1.3rem",
                  borderRadius: 999,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #5677fc, #7f5dff, #ff7575)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                {editingProductId ? "Update product" : "Save product"}
              </button>
              {editingProductId && (
                <button
                  type="button"
                  onClick={() => resetProductForm()}
                  style={{
                    marginLeft: 10,
                    padding: "0.55rem 1rem",
                    borderRadius: 999,
                    border: "1px solid #262637",
                    background: "transparent",
                    color: "#a3a3bf",
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </section>
          </>
          )}

          </div>
        )}

        {view === "developerFees" && isDeveloper && (
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637",
              maxWidth: 520
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 4 }}>
              Developer fee (your account)
            </h2>
            <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
              Set a percentage of in-app member sales to be pulled into your separate account. Only you (the developer) can change this.
            </p>

            <form onSubmit={handleSaveFeeConfig} style={{ marginTop: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Fee (% of in-app member sales)</div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={
                    typeof developerFeePercent === "number"
                      ? developerFeePercent.toString()
                      : ""
                  }
                  onChange={(e) =>
                    setDeveloperFeePercent(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="e.g. 5.0"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ marginBottom: 4 }}>Your account (Stripe Connect account ID or similar)</div>
                <input
                  type="text"
                  value={developerConnectAccountId}
                  onChange={(e) => setDeveloperConnectAccountId(e.target.value)}
                  placeholder="acct_... or leave blank"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                  The account that receives the fee. Set when using Stripe Connect or your payment setup.
                </div>
              </label>

              <button
                type="submit"
                disabled={feeConfigSaving}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: feeConfigSaving ? "wait" : "pointer",
                  opacity: feeConfigSaving ? 0.8 : 1
                }}
              >
                {feeConfigSaving ? "Saving…" : "Save fee config"}
              </button>
            </form>
          </section>
        )}

        {view === "tips" && (
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637",
              maxWidth: 640
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 4 }}>Tip pool</h2>
            <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
              Tips added at checkout are collected here. Pull funds out and keep a record of when that was done.
            </p>
            {tipsAvailableCents === null ? (
              <p style={{ fontSize: 13, color: "#8a8cab" }}>Loading… (ensure backend is running)</p>
            ) : (
              <>
                <div
                  style={{
                    padding: "1rem 1.2rem",
                    borderRadius: 12,
                    border: "1px solid #262637",
                    backgroundColor: "#17172b",
                    marginBottom: 20
                  }}
                >
                  <div style={{ fontSize: 12, color: "#8a8cab", marginBottom: 4 }}>Available</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    ${(tipsAvailableCents / 100).toFixed(2)}
                  </div>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const cents = Math.round(parseFloat(tipsWithdrawCents) * 100) || 0;
                    if (cents <= 0) {
                      alert("Enter a valid amount.");
                      return;
                    }
                    if (cents > tipsAvailableCents) {
                      alert("Amount exceeds available balance.");
                      return;
                    }
                    setTipsWithdrawing(true);
                    try {
                      const res = await apiRequest("/api/tips/withdraw", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ amountCents: cents, note: tipsWithdrawNote.trim() || undefined })
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        alert(err?.error || "Withdrawal failed.");
                        return;
                      }
                      setTipsWithdrawCents("");
                      setTipsWithdrawNote("");
                      loadTips();
                    } catch {
                      alert("Could not reach backend.");
                    } finally {
                      setTipsWithdrawing(false);
                    }
                  }}
                  style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 24 }}
                >
                  <label>
                    <div style={{ marginBottom: 4, fontSize: 12 }}>Amount to pull ($)</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tipsWithdrawCents}
                      onChange={(e) => setTipsWithdrawCents(e.target.value)}
                      placeholder="0.00"
                      style={inputStyle}
                    />
                  </label>
                  <label>
                    <div style={{ marginBottom: 4, fontSize: 12 }}>Note (optional)</div>
                    <input
                      type="text"
                      value={tipsWithdrawNote}
                      onChange={(e) => setTipsWithdrawNote(e.target.value)}
                      placeholder="e.g. Weekly payout"
                      style={{ ...inputStyle, minWidth: 160 }}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={tipsWithdrawing || tipsAvailableCents <= 0}
                    style={{
                      padding: "0.5rem 1.1rem",
                      borderRadius: 999,
                      border: "none",
                      background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: tipsWithdrawing || tipsAvailableCents <= 0 ? "not-allowed" : "pointer",
                      opacity: tipsAvailableCents <= 0 ? 0.6 : 1
                    }}
                  >
                    {tipsWithdrawing ? "Withdrawing…" : "Pull tips"}
                  </button>
                </form>
                <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Withdrawal history</h3>
                {tipsWithdrawals.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#6f7087" }}>No withdrawals yet.</p>
                ) : (
                  <div style={{ border: "1px solid #262637", borderRadius: 12, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead style={{ backgroundColor: "#171722", textAlign: "left" }}>
                        <tr>
                          <th style={{ padding: "0.5rem 0.75rem" }}>Date</th>
                          <th style={{ padding: "0.5rem 0.75rem" }}>Amount</th>
                          <th style={{ padding: "0.5rem 0.75rem" }}>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tipsWithdrawals.map((w) => (
                          <tr key={w.id} style={{ borderTop: "1px solid #262637" }}>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              {new Date(w.withdrawnAt).toLocaleString()}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>${(w.amountCents / 100).toFixed(2)}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#8a8cab" }}>{w.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {view === "manageMemberships" && (
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637",
              marginBottom: 20
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Add membership to account</h2>
                <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 0 }}>
                  Select a user and assign a club/year membership.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await apiRequest("/api/users/export-csv");
                    if (!res.ok) throw new Error("Export failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `members-export-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {
                    alert("Could not export. Is the backend running?");
                  }
                }}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 999,
                  border: "1px solid #262637",
                  background: "#17172b",
                  color: "#e5e7ff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Export member data (CSV)
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const selectedId = addMembershipUserId.trim();
                if (!selectedId) {
                  alert("Select an account from the search list (click a result), then add membership.");
                  return;
                }
                const selectedUser = usersList.find((u) => u.id === selectedId);
                if (!selectedUser) {
                  alert("Selected account is no longer in the list. Please search and select again.");
                  return;
                }
                const yearNum = typeof addMembershipYear === "number" ? addMembershipYear : parseInt(String(addMembershipYear), 10);
                if (!yearNum || yearNum < 2020 || yearNum > 2030) {
                  alert("Enter a valid year (2020–2030).");
                  return;
                }
                try {
                  const res = await apiRequest("/api/user-memberships", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: selectedUser.id,
                      clubCode: addMembershipClub,
                      year: yearNum
                    })
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert(err?.error || "Failed to add membership.");
                    return;
                  }
                  await loadUserMemberships();
                } catch {
                  alert("Could not reach backend.");
                }
              }}
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 24 }}
            >
              <label style={{ minWidth: 260 }}>
                <div style={{ marginBottom: 4, fontSize: 12 }}>Account</div>
                {addMembershipUserId ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#e5e7ff" }}>
                      {usersList.find((u) => u.id === addMembershipUserId)?.email ?? addMembershipUserId}
                      {usersList.find((u) => u.id === addMembershipUserId)?.name
                        ? ` (${usersList.find((u) => u.id === addMembershipUserId)?.name})`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setAddMembershipUserId(""); setAddMembershipUserSearch(""); setAddMembershipSearchOpen(false); }}
                      style={{ fontSize: 11, padding: "0.2rem 0.5rem", border: "1px solid #3d3d52", borderRadius: 6, background: "transparent", color: "#a3a3bf", cursor: "pointer" }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={addMembershipUserSearch}
                      onChange={(e) => { setAddMembershipUserSearch(e.target.value); setAddMembershipSearchOpen(true); }}
                      onFocus={() => setAddMembershipSearchOpen(true)}
                      onBlur={() => setTimeout(() => setAddMembershipSearchOpen(false), 150)}
                      placeholder="Search by email or name…"
                      style={inputStyle}
                      autoComplete="off"
                    />
                    {addMembershipSearchOpen && (
                      <ul
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "100%",
                          margin: 0,
                          padding: 0,
                          listStyle: "none",
                          maxHeight: 220,
                          overflowY: "auto",
                          background: "#1a1a25",
                          border: "1px solid #262637",
                          borderRadius: 8,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          zIndex: 10
                        }}
                      >
                        {usersList
                          .filter((u) => {
                            const q = addMembershipUserSearch.trim().toLowerCase();
                            if (!q) return true;
                            const email = (u.email ?? "").toLowerCase();
                            const name = (u.name ?? "").toLowerCase();
                            return email.includes(q) || name.includes(q);
                          })
                          .slice(0, 50)
                          .map((u) => (
                            <li
                              key={u.id}
                              onMouseDown={(e) => { e.preventDefault(); setAddMembershipUserId(u.id); setAddMembershipUserSearch(""); setAddMembershipSearchOpen(false); }}
                              style={{
                                padding: "0.5rem 0.6rem",
                                cursor: "pointer",
                                fontSize: 13,
                                borderBottom: "1px solid #262637"
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#262637"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                              {u.email}{u.name ? ` (${u.name})` : ""}
                            </li>
                          ))}
                        {usersList.filter((u) => {
                          const q = addMembershipUserSearch.trim().toLowerCase();
                          if (!q) return true;
                          const email = (u.email ?? "").toLowerCase();
                          const name = (u.name ?? "").toLowerCase();
                          return email.includes(q) || name.includes(q);
                        }).length === 0 && (
                          <li style={{ padding: "0.5rem 0.6rem", fontSize: 12, color: "#8a8cab" }}>No accounts match</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </label>
              <label>
                <div style={{ marginBottom: 4, fontSize: 12 }}>Club</div>
                <select
                  value={addMembershipClub}
                  onChange={(e) => setAddMembershipClub(e.target.value as ClubCode)}
                  style={inputStyle}
                >
                  {(clubsFromApi ?? []).map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ marginBottom: 4, fontSize: 12 }}>Year</div>
                <input
                  type="number"
                  min={2020}
                  max={2030}
                  value={addMembershipYear === "" ? "" : addMembershipYear}
                  onChange={(e) => setAddMembershipYear(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                  style={inputStyle}
                  placeholder="2026"
                />
              </label>
              <button
                type="submit"
                disabled={!addMembershipUserId}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 999,
                  border: "none",
                  background: addMembershipUserId ? "linear-gradient(135deg, #5677fc, #7f5dff)" : "#3d3d52",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: addMembershipUserId ? "pointer" : "not-allowed",
                  opacity: addMembershipUserId ? 1 : 0.7
                }}
              >
                Add membership
              </button>
            </form>

            <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Current memberships</h2>
            <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 12 }}>
              One row per club/year per account. The same person can have multiple rows (e.g. Sap and Wood). Transfer or remove as needed.
            </p>
            {userMembershipsList.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8a8cab", margin: 0 }}>No membership records yet. Add one above or have guests create accounts and purchase.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid #262637", borderRadius: 12, overflow: "hidden" }}>
                {userMembershipsList.map((rec) => (
                  <li
                    key={rec.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "0.6rem 0.75rem",
                      borderBottom: "1px solid #262637",
                      fontSize: 13
                    }}
                  >
                    <span>
                      <strong>{rec.userEmail ?? rec.userId}</strong>
                      {rec.userName ? ` (${rec.userName})` : ""} — {clubLabelFromList(clubsFromApi, rec.clubCode)} {rec.year} — {rec.status}
                    </span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {transferRecordId === rec.id ? (
                        <>
                          <div style={{ position: "relative", minWidth: 200 }}>
                            <input
                              type="text"
                              value={transferToUserSearch}
                              onChange={(e) => { setTransferToUserSearch(e.target.value); setTransferSearchOpen(true); }}
                              onFocus={() => setTransferSearchOpen(true)}
                              onBlur={() => setTimeout(() => setTransferSearchOpen(false), 150)}
                              placeholder="Search account to transfer to…"
                              style={{ ...inputStyle, minWidth: 200, padding: "0.3rem 0.5rem" }}
                              autoComplete="off"
                            />
                            {transferSearchOpen && (
                              <ul
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  right: 0,
                                  top: "100%",
                                  margin: 0,
                                  padding: 0,
                                  listStyle: "none",
                                  maxHeight: 200,
                                  overflowY: "auto",
                                  background: "#1a1a25",
                                  border: "1px solid #262637",
                                  borderRadius: 8,
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                  zIndex: 10
                                }}
                              >
                                {usersList
                                  .filter((u) => u.id !== rec.userId)
                                  .filter((u) => {
                                    const q = transferToUserSearch.trim().toLowerCase();
                                    if (!q) return true;
                                    const email = (u.email ?? "").toLowerCase();
                                    const name = (u.name ?? "").toLowerCase();
                                    return email.includes(q) || name.includes(q);
                                  })
                                  .slice(0, 30)
                                  .map((u) => (
                                    <li
                                      key={u.id}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setTransferToUserId(u.id);
                                        setTransferToUserSearch(u.email + (u.name ? ` (${u.name})` : ""));
                                        setTransferSearchOpen(false);
                                      }}
                                      style={{
                                        padding: "0.4rem 0.6rem",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        borderBottom: "1px solid #262637"
                                      }}
                                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#262637"; }}
                                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                    >
                                      {u.email}{u.name ? ` (${u.name})` : ""}
                                    </li>
                                  ))}
                                {usersList.filter((u) => u.id !== rec.userId).filter((u) => {
                                  const q = transferToUserSearch.trim().toLowerCase();
                                  if (!q) return true;
                                  const email = (u.email ?? "").toLowerCase();
                                  const name = (u.name ?? "").toLowerCase();
                                  return email.includes(q) || name.includes(q);
                                }).length === 0 && (
                                  <li style={{ padding: "0.5rem 0.6rem", fontSize: 12, color: "#8a8cab" }}>No other accounts match</li>
                                )}
                              </ul>
                            )}
                          </div>
                          {transferToUserId && (
                            <span style={{ fontSize: 12, color: "#8be0a4" }}>
                              → {usersList.find((u) => u.id === transferToUserId)?.email ?? transferToUserId}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!transferToUserId) return;
                              try {
                                const res = await apiRequest(`/api/user-memberships/${rec.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: transferToUserId })
                                });
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({}));
                                  alert(err?.error || "Transfer failed.");
                                  return;
                                }
                                setTransferRecordId(null);
                                setTransferToUserId("");
                                setTransferToUserSearch("");
                                await loadUserMemberships();
                              } catch {
                                alert("Could not reach backend.");
                              }
                            }}
                            style={{ padding: "0.3rem 0.6rem", fontSize: 11, borderRadius: 6, border: "none", background: "#5677fc", color: "#fff", cursor: "pointer" }}
                          >
                            Move here
                          </button>
                          <button type="button" onClick={() => { setTransferRecordId(null); setTransferToUserId(""); setTransferToUserSearch(""); setTransferSearchOpen(false); }} style={{ padding: "0.3rem 0.5rem", fontSize: 11, background: "none", border: "1px solid #3d3d52", color: "#a3a3bf", borderRadius: 6, cursor: "pointer" }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setTransferRecordId(rec.id); setTransferToUserId(""); setTransferToUserSearch(""); setTransferSearchOpen(false); }}
                          style={{ padding: "0.25rem 0.5rem", fontSize: 11, border: "1px solid #3d3d52", borderRadius: 6, background: "transparent", color: "#8be0a4", cursor: "pointer" }}
                        >
                          Transfer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Remove this membership from the account?")) return;
                          try {
                            const res = await apiRequest(`/api/user-memberships/${rec.id}`, { method: "DELETE" });
                            if (res.ok) await loadUserMemberships();
                            else alert("Failed to remove.");
                          } catch {
                            alert("Could not reach backend.");
                          }
                        }}
                        style={{ padding: "0.25rem 0.5rem", fontSize: 11, border: "1px solid #3d3d52", borderRadius: 6, background: "transparent", color: "#c4a2a2", cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(view === "memberships" || view === "clubs") && (
            <section
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637",
                marginBottom: 20
              }}
            >
              <h2 style={{ fontSize: 16, margin: 0, marginBottom: 4 }}>Clubs</h2>
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
                Edit club name, code, and description. These clubs are used for memberships and member assignments. Codes must be one of: SAP, WOOD, CELLARS, FOUNDERS.
              </p>
              {clubsFromApi === null && !clubsLoadError ? (
                <p style={{ fontSize: 13, color: "#8a8cab" }}>Loading clubs…</p>
              ) : clubsFromApi?.length === 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: clubsLoadError ? "#c94a4a" : "#6f7087", marginTop: 0, marginBottom: 8 }}>
                    {clubsLoadError ?? "No clubs in the database yet. Create default clubs (Wood, Sap, Cellars, Founders) or retry after restarting the backend."}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!clubsLoadError && (
                      <button
                        type="button"
                        disabled={clubsSeeding}
                        onClick={async () => {
                          setClubsSeeding(true);
                          try {
                            const res = await apiRequest("/api/clubs/seed-defaults", { method: "POST" });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.clubs) setClubsFromApi(data.clubs);
                              else await loadClubs();
                            } else await loadClubs();
                          } finally {
                            setClubsSeeding(false);
                          }
                        }}
                        style={{ padding: "0.4rem 0.8rem", fontSize: 13, cursor: clubsSeeding ? "wait" : "pointer", borderRadius: 8, border: "1px solid #262637", background: "#17172b", color: "#e5e7ff" }}
                      >
                        {clubsSeeding ? "Creating…" : "Create default clubs (Wood, Sap, Cellars, Founders)"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadClubs()}
                      style={{ padding: "0.4rem 0.8rem", fontSize: 13, cursor: "pointer", borderRadius: 8, border: "1px solid #262637", background: "#17172b", color: "#e5e7ff" }}
                    >
                      Retry loading clubs
                    </button>
                  </div>
                </div>
              ) : (
                <>
                {((): boolean => {
                  const defaultCodes = ["WOOD", "SAP", "CELLARS", "FOUNDERS"];
                  const existingCodes = (clubsFromApi ?? []).map((c) => c.code.toUpperCase());
                  return defaultCodes.some((code) => !existingCodes.includes(code));
                })() ? (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: "#8a8cab", marginTop: 0, marginBottom: 8 }}>
                      Add the remaining default clubs (Cellars, Founders) so all four are available.
                    </p>
                    <button
                      type="button"
                      disabled={clubsSeeding}
                      onClick={async () => {
                        setClubsSeeding(true);
                        try {
                          const res = await apiRequest("/api/clubs/seed-defaults", { method: "POST" });
                          if (res.ok) {
                            const data = await res.json();
                            if (data.clubs) setClubsFromApi(data.clubs);
                            else await loadClubs();
                          } else await loadClubs();
                        } finally {
                          setClubsSeeding(false);
                        }
                      }}
                      style={{ padding: "0.4rem 0.8rem", fontSize: 13, cursor: clubsSeeding ? "wait" : "pointer", borderRadius: 8, border: "1px solid #262637", background: "#17172b", color: "#e5e7ff" }}
                    >
                      {clubsSeeding ? "Adding…" : "Add missing default clubs"}
                    </button>
                  </div>
                ) : null}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid #262637", borderRadius: 12, overflow: "hidden" }}>
                  {clubsFromApi.map((club) => (
                    <li
                      key={club.id}
                      style={{
                        borderBottom: "1px solid #262637",
                        padding: "0.6rem 0.75rem",
                        fontSize: 13
                      }}
                    >
                      {editingClubId === club.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <label>
                            <span style={{ fontSize: 11, color: "#8a8cab", display: "block", marginBottom: 2 }}>Name</span>
                            <input
                              value={editClubName}
                              onChange={(e) => setEditClubName(e.target.value)}
                              style={inputStyle}
                              placeholder="e.g. Sap Club"
                            />
                          </label>
                          <label>
                            <span style={{ fontSize: 11, color: "#8a8cab", display: "block", marginBottom: 2 }}>Code</span>
                            <select
                              value={editClubCode}
                              onChange={(e) => setEditClubCode(e.target.value)}
                              style={{ ...inputStyle, cursor: "pointer" }}
                            >
                              {(["SAP", "WOOD", "CELLARS", "FOUNDERS"] as const).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span style={{ fontSize: 11, color: "#8a8cab", display: "block", marginBottom: 2 }}>Description</span>
                            <textarea
                              value={editClubDescription}
                              onChange={(e) => setEditClubDescription(e.target.value)}
                              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                              placeholder="Optional"
                            />
                          </label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/clubs/${club.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      name: editClubName.trim(),
                                      code: editClubCode,
                                      description: editClubDescription.trim()
                                    })
                                  });
                                  if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    alert(err?.error || "Failed to update club.");
                                    return;
                                  }
                                  setEditingClubId(null);
                                  loadClubs();
                                } catch {
                                  alert("Could not reach backend.");
                                }
                              }}
                              style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: 999,
                                border: "none",
                                background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClubId(null);
                                setEditClubName("");
                                setEditClubCode("");
                                setEditClubDescription("");
                              }}
                              style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: 999,
                                border: "1px solid #262637",
                                background: "transparent",
                                color: "#a3a3bf",
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{club.name}</span>
                            <span style={{ color: "#8a8cab", marginLeft: 8 }}>({club.code})</span>
                            {club.description && (
                              <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>{club.description}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClubId(club.id);
                              setEditClubName(club.name);
                              setEditClubCode(club.code);
                              setEditClubDescription(club.description || "");
                            }}
                            style={{
                              padding: "0.25rem 0.6rem",
                              fontSize: 12,
                              border: "1px solid #262637",
                              borderRadius: 6,
                              background: "#17172b",
                              color: "#e5e7ff",
                              cursor: "pointer"
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                </>
              )}
            </section>
        )}

        {view === "memberships" && (
          <>
            <section
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637",
                marginBottom: 20
              }}
            >
              <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>
                {editingMembershipId ? "Edit membership offering" : "Create membership offering"}
              </h2>
              {clubsFromApi && clubsFromApi.length === 0 ? (
                <p style={{ fontSize: 13, color: "#a3a3bf", marginTop: 0, marginBottom: 12 }}>
                  No clubs yet. Go to Clubs in the sidebar to create default clubs (Wood, Sap, Cellars, Founders), then come back here to create a membership.
                </p>
              ) : null}
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
                {editingMembershipId
                  ? "Update the offering below and save."
                  : "Set up a club membership for a given year: when it's on sale and how many spots are available."}
              </p>
              {clubsFromApi && clubsFromApi.length === 0 ? (
                <button
                  type="button"
                  style={{ ...inputStyle, marginBottom: 16, cursor: "pointer" }}
                  onClick={() => setView("clubs")}
                >
                  Go to Clubs
                </button>
              ) : null}
              <form
                onSubmit={handleCreateMembership}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                  maxWidth: 720
                }}
              >
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Club</span>
                  <select
                    value={membershipClub}
                    onChange={(e) => setMembershipClub(e.target.value as ClubCode)}
                    style={inputStyle}
                  >
                    {(clubsFromApi ?? []).map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Year eligible</span>
                  <input
                    type="number"
                    min={2020}
                    max={2030}
                    value={membershipYear === "" ? "" : membershipYear}
                    onChange={(e) =>
                      setMembershipYear(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                    }
                    style={inputStyle}
                    placeholder="e.g. 2026"
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Description</span>
                  <textarea
                    value={membershipDescription}
                    onChange={(e) => setMembershipDescription(e.target.value)}
                    style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                    placeholder="What's included, benefits, etc."
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Available for sale from</span>
                  <input
                    type="datetime-local"
                    value={membershipSaleStart}
                    onChange={(e) => setMembershipSaleStart(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Available for sale until</span>
                  <input
                    type="datetime-local"
                    value={membershipSaleEnd}
                    onChange={(e) => setMembershipSaleEnd(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>How many available</span>
                  <input
                    type="number"
                    min={0}
                    value={membershipCapacity === "" ? "" : membershipCapacity}
                    onChange={(e) =>
                      setMembershipCapacity(
                        e.target.value === "" ? "" : parseInt(e.target.value, 10)
                      )
                    }
                    style={inputStyle}
                    placeholder="Leave empty for unlimited"
                  />
                </label>
                <label style={{ display: "block", minWidth: 0 }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Price (USD)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={membershipPriceInput}
                    onChange={(e) => setMembershipPriceInput(e.target.value)}
                    onBlur={() => {
                      const trimmed = membershipPriceInput.trim();
                      if (trimmed === "") {
                        setMembershipPriceCents("");
                        return;
                      }
                      const parsed = parseFloat(trimmed);
                      if (!isNaN(parsed) && parsed >= 0) {
                        setMembershipPriceCents(Math.round(parsed * 100));
                        setMembershipPriceInput(parsed.toFixed(2));
                      } else {
                        setMembershipPriceInput(membershipPriceCents === "" ? "" : (Number(membershipPriceCents) / 100).toFixed(2));
                      }
                    }}
                    style={{ ...inputStyle, minWidth: 0, boxSizing: "border-box" }}
                    placeholder="e.g. 75.00"
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Tax rate</span>
                  <select
                    value={membershipTaxRateId}
                    onChange={(e) => setMembershipTaxRateId(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="">None</option>
                    {taxRatesList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.ratePercent}%)
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                    Configure options under Settings → Tax rates.
                  </div>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Toast discount code</span>
                  <input
                    type="text"
                    value={membershipToastDiscountCode}
                    onChange={(e) => setMembershipToastDiscountCode(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. WOOD2026"
                  />
                  <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                    This code is shown in the &quot;Order via Toast&quot; section for members with this membership. They paste it at Toast checkout to apply their discount. Leave blank to auto-generate (e.g. club + year).
                  </div>
                </label>
                <fieldset style={{ gridColumn: "1 / -1", border: "1px solid #262637", borderRadius: 12, padding: "0.75rem 0.9rem" }}>
                  <legend style={{ fontSize: 12, color: "#a3a3bf" }}>Available only to existing members of these clubs (e.g. upgrades)</legend>
                  <p style={{ fontSize: 11, color: "#8a8cab", marginTop: 0, marginBottom: 10 }}>
                    Check clubs whose existing members can see and purchase this membership (e.g. renewal or upgrade). Leave all unchecked for first-time memberships that anyone can purchase.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {(clubsFromApi ?? []).map((club) => (
                      <label key={club.code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={membershipAllowedClubs.includes(club.code)}
                          onChange={() =>
                            setMembershipAllowedClubs((prev) =>
                              prev.includes(club.code)
                                ? prev.filter((c) => c !== club.code)
                                : [...prev, club.code]
                            )
                          }
                        />
                        <span>{club.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div style={{ gridColumn: "1 / -1" }}>
                  <button
                    type="submit"
                    disabled={membershipSaving}
                    style={{
                      padding: "0.5rem 1.2rem",
                      borderRadius: 999,
                      border: "none",
                      background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: membershipSaving ? "not-allowed" : "pointer",
                      opacity: membershipSaving ? 0.7 : 1
                    }}
                  >
                    {membershipSaving ? "Saving…" : editingMembershipId ? "Update membership" : "Create membership"}
                  </button>
                  {editingMembershipId && (
                    <button
                      type="button"
                      onClick={() => resetMembershipForm()}
                      style={{
                        marginLeft: 10,
                        padding: "0.5rem 1rem",
                        borderRadius: 999,
                        border: "1px solid #262637",
                        background: "transparent",
                        color: "#a3a3bf",
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637",
                marginBottom: 20
              }}
            >
              <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Membership offerings</h2>
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 12 }}>
                Memberships you&apos;ve created. Shown to guests in the Join a club section when on sale.
              </p>
              {membershipList.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6f7087" }}>
                  No membership offerings yet. Create one above.
                </p>
              ) : (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #262637",
                    overflow: "hidden"
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ backgroundColor: "#171722", textAlign: "left" }}>
                      <tr>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Club</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Year</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Description</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Sale window</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Available</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {membershipList.map((m, idx) => (
                        <tr
                          key={m.id}
                          style={{
                            backgroundColor: idx % 2 === 0 ? "#0d0d14" : "#10101a"
                          }}
                        >
                          <td style={{ padding: "0.45rem 0.75rem" }}>{m.name}</td>
                          <td style={{ padding: "0.45rem 0.75rem" }}>{m.year}</td>
                          <td
                            style={{
                              padding: "0.45rem 0.75rem",
                              color: "#a3a3bf",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {m.description || "—"}
                          </td>
                          <td style={{ padding: "0.45rem 0.75rem", fontSize: 11, color: "#8a8cab" }}>
                            {m.saleStartAt || m.saleEndAt
                              ? `${m.saleStartAt ? new Date(m.saleStartAt).toLocaleDateString() : "…"} – ${m.saleEndAt ? new Date(m.saleEndAt).toLocaleDateString() : "…"}`
                              : "Always"}
                          </td>
                          <td style={{ padding: "0.45rem 0.75rem" }}>
                            {m.capacity === 0 ? "Unlimited" : `${m.soldCount} / ${m.capacity}`}
                          </td>
                          <td style={{ padding: "0.45rem 0.75rem" }}>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/memberships/${m.id}`);
                                  if (!res.ok) throw new Error("Failed to load");
                                  const o = await res.json();
                                  setEditingMembershipId(o.id);
                                  setMembershipClub((o.clubCode || "WOOD") as ClubCode);
                                  setMembershipYear(o.year ?? 2026);
                                  setMembershipDescription(o.description ?? "");
                                  setMembershipSaleStart(
                                    o.saleStartAt
                                      ? new Date(o.saleStartAt).toISOString().slice(0, 16)
                                      : ""
                                  );
                                  setMembershipSaleEnd(
                                    o.saleEndAt
                                      ? new Date(o.saleEndAt).toISOString().slice(0, 16)
                                      : ""
                                  );
                                  setMembershipCapacity(o.capacity ?? "");
                                  setMembershipPriceCents(typeof o.priceCents === "number" ? o.priceCents : "");
                                  setMembershipPriceInput(typeof o.priceCents === "number" ? (o.priceCents / 100).toFixed(2) : "");
                                  setMembershipTaxRateId(o.taxRateId ?? "");
                                  setMembershipToastDiscountCode(o.toastDiscountCode ?? "");
                                  setMembershipAllowedClubs(Array.isArray(o.allowedClubCodes) ? o.allowedClubCodes : []);
                                } catch {
                                  alert("Could not load membership.");
                                }
                              }}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: 12,
                                border: "1px solid #262637",
                                borderRadius: 6,
                                background: "#17172b",
                                color: "#e5e7ff",
                                cursor: "pointer"
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 12
                }}
              >
                <div>
                  <h2 style={{ fontSize: 16, margin: 0 }}>Members</h2>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#8a8cab",
                      marginTop: 4,
                      marginBottom: 0
                    }}
                  >
                    Enrolled members by club and year. Add or edit in Manage memberships.
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Search by name, email, or club…"
                    value={membersSearchQuery}
                    onChange={(e) => setMembersSearchQuery(e.target.value)}
                    style={{ ...inputStyle, maxWidth: 220, fontSize: 12, padding: "0.4rem 0.6rem" }}
                  />
                  <select
                    value={memberSort}
                    onChange={(e) =>
                      setMemberSort(e.target.value as "name" | "club" | "year")
                    }
                    style={{ ...inputStyle, maxWidth: 160, fontSize: 12, padding: "0.4rem 0.6rem" }}
                  >
                    <option value="name">Sort by name</option>
                    <option value="club">Sort by club</option>
                    <option value="year">Sort by year</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const escape = (val: string | null | undefined): string => {
                        if (val == null) return "";
                        const s = String(val);
                        if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                        return s;
                      };
                      const header = "Name,Email,Memberships";
                      const rows = filteredMembers.map((m) =>
                        [
                          escape(m.name),
                          escape(m.email),
                          escape(m.memberships.map((mb) => `${mb.club} ${mb.year}`).join(", "))
                        ].join(",")
                      );
                      const csv = [header, ...rows].join("\r\n");
                      const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `club-members-${new Date().toISOString().slice(0, 10)}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: 8,
                      border: "1px solid #262637",
                      background: "#17172b",
                      color: "#e5e7ff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Export club members CSV
                  </button>
                </div>
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid #262637",
                  overflow: "hidden"
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12
                  }}
                >
                  <thead style={{ backgroundColor: "#171722", textAlign: "left" }}>
                    <tr>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Email</th>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Memberships</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: "1rem 0.75rem", color: "#8a8cab", fontSize: 12 }}>
                          {membersSearchQuery.trim()
                            ? "No members match your search."
                            : "No enrolled members yet. Add memberships under Manage memberships."}
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m, idx) => (
                        <tr
                          key={m.id}
                          style={{
                            backgroundColor:
                              idx % 2 === 0 ? "#0d0d14" : "#10101a"
                          }}
                        >
                          <td style={{ padding: "0.45rem 0.75rem" }}>{m.name}</td>
                          <td
                            style={{
                              padding: "0.45rem 0.75rem",
                              color: "#c3c3e0"
                            }}
                          >
                            {m.email}
                          </td>
                          <td style={{ padding: "0.45rem 0.75rem", color: "#a3a3bf", fontSize: 12 }}>
                            {m.memberships.map((mb) => `${mb.club} ${mb.year}`).join(", ")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {view === "pickups" && (
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637"
            }}
          >
            <h2 style={{ fontSize: 16, margin: 0, marginBottom: 12 }}>Pickups</h2>
            <p style={{ fontSize: 13, color: "#a3a3bf", margin: 0, marginBottom: 16 }}>
              Orders and allocations ready for pickup. Search by member to find their outstanding orders, then mark items as picked up when collected.
            </p>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search by member name or email"
                value={pickupsSearch}
                onChange={(e) => setPickupsSearch(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 320,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #262637",
                  background: "#0d0d12",
                  color: "#f5f5f7",
                  fontSize: 13
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["all", "ready", "picked"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPickupsFilter(f)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #262637",
                    background: pickupsFilter === f ? "rgba(86, 119, 252, 0.2)" : "transparent",
                    color: pickupsFilter === f ? "#f5f5f7" : "#a3a3bf",
                    cursor: "pointer",
                    fontSize: 13
                  }}
                >
                  {f === "all" ? "All" : f === "ready" ? "Ready for pickup" : "Picked up"}
                </button>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #262637", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Member</th>
                    <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Product</th>
                    <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Qty</th>
                    <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Status</th>
                    <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Picked up at</th>
                    <th style={{ padding: "8px 10px", color: "#8a8cab" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const searchLower = pickupsSearch.trim().toLowerCase();
                    const filtered = pickupsList.filter((row) => {
                      if (pickupsFilter === "ready") {
                        if (row.status !== "READY_FOR_PICKUP") return false;
                      } else if (pickupsFilter === "picked") {
                        if (row.status !== "PICKED_UP") return false;
                      }
                      if (searchLower) {
                        const name = (row.memberName ?? "").toLowerCase();
                        const email = (row.memberEmail ?? "").toLowerCase();
                        const id = (row.userId ?? "").toLowerCase();
                        if (!name.includes(searchLower) && !email.includes(searchLower) && !id.includes(searchLower)) return false;
                      }
                      return true;
                    });
                    return filtered.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #1e1e2a" }}>
                        <td style={{ padding: "10px" }}>
                          {row.memberName || row.memberEmail || row.userId}
                        </td>
                        <td style={{ padding: "10px" }}>{row.productName}</td>
                        <td style={{ padding: "10px" }}>{row.quantity}</td>
                        <td style={{ padding: "10px" }}>
                          {row.status === "PICKED_UP" ? "Picked up" : "Ready for pickup"}
                        </td>
                        <td style={{ padding: "10px", color: "#8a8cab" }}>
                          {row.pickedUpAt
                            ? new Date(row.pickedUpAt).toLocaleString()
                            : "—"}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {row.status === "READY_FOR_PICKUP" ? (
                            <button
                              type="button"
                              disabled={pickupsTogglingId === row.id}
                              onClick={async () => {
                                setPickupsTogglingId(row.id);
                                try {
                                  const res = await apiRequest(`/api/pickups/${row.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ pickedUp: true })
                                  });
                                  if (res.ok) loadPickups();
                                  else {
                                    const err = await res.json().catch(() => ({}));
                                    alert(err?.error || "Failed to mark as picked up.");
                                  }
                                } catch {
                                  alert("Could not reach backend.");
                                } finally {
                                  setPickupsTogglingId(null);
                                }
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                border: "none",
                                background: "rgba(86, 119, 252, 0.25)",
                                color: "#b8c8ff",
                                cursor: pickupsTogglingId === row.id ? "wait" : "pointer",
                                fontSize: 12
                              }}
                            >
                              {pickupsTogglingId === row.id ? "…" : "Mark picked up"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={pickupsTogglingId === row.id}
                              onClick={async () => {
                                setPickupsTogglingId(row.id);
                                try {
                                  const res = await apiRequest(`/api/pickups/${row.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ pickedUp: false })
                                  });
                                  if (res.ok) loadPickups();
                                  else {
                                    const err = await res.json().catch(() => ({}));
                                    alert(err?.error || "Failed to mark as not picked up.");
                                  }
                                } catch {
                                  alert("Could not reach backend.");
                                } finally {
                                  setPickupsTogglingId(null);
                                }
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                border: "1px solid #262637",
                                background: "transparent",
                                color: "#a3a3bf",
                                cursor: pickupsTogglingId === row.id ? "wait" : "pointer",
                                fontSize: 12
                              }}
                            >
                              {pickupsTogglingId === row.id ? "…" : "Mark not picked up"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            {pickupsList.length === 0 && (
              <p style={{ fontSize: 13, color: "#6a6a8a", marginTop: 16, marginBottom: 0 }}>
                No pickups to show. Create allocations or preorders to see items here.
              </p>
            )}
            {pickupsList.length > 0 && (() => {
              const searchLower = pickupsSearch.trim().toLowerCase();
              const filteredCount = pickupsList.filter((r) => {
                if (pickupsFilter === "ready" && r.status !== "READY_FOR_PICKUP") return false;
                if (pickupsFilter === "picked" && r.status !== "PICKED_UP") return false;
                if (searchLower) {
                  const name = (r.memberName ?? "").toLowerCase();
                  const email = (r.memberEmail ?? "").toLowerCase();
                  const id = (r.userId ?? "").toLowerCase();
                  if (!name.includes(searchLower) && !email.includes(searchLower) && !id.includes(searchLower)) return false;
                }
                return true;
              }).length;
              return filteredCount === 0 ? (
                <p style={{ fontSize: 13, color: "#6a6a8a", marginTop: 16, marginBottom: 0 }}>
                  {pickupsSearch.trim() ? "No members match your search." : "No items match the current filter."}
                </p>
              ) : null;
            })()}
          </section>
        )}

        {view === "notifications" && (
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637",
              maxWidth: 640,
              marginBottom: 20
            }}
          >
            <h2 style={{ fontSize: 16, margin: 0, marginBottom: 4 }}>Send push notification</h2>
            <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 16 }}>
              Create a push notification and choose which clubs receive it. Delivered via Web Push to members who have enabled notifications in the member app. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in production so subscriptions persist across restarts.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!notificationTitle.trim()) {
                  alert("Enter a title.");
                  return;
                }
                if (notificationClubCodes.length === 0) {
                  alert("Select at least one club.");
                  return;
                }
                setNotificationSending(true);
                try {
                  const res = await apiRequest("/api/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: notificationTitle.trim(),
                      body: notificationBody.trim(),
                      clubCodes: notificationClubCodes,
                      scheduledFor: notificationScheduledFor.trim() || undefined
                    })
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert(err?.error || "Failed to send notification.");
                    return;
                  }
                  const result = await res.json();
                  setNotificationTitle("");
                  setNotificationBody("");
                  setNotificationClubCodes([]);
                  setNotificationScheduledFor("");
                  loadNotifications();
                  if (result.status === "scheduled") {
                    alert(`Notification scheduled for ${new Date(result.scheduledFor).toLocaleString()}.`);
                  } else if (typeof result.sentTo === "number") {
                    alert(`Notification sent to ${result.sentTo} device(s).`);
                  }
                } catch {
                  alert("Could not reach backend.");
                } finally {
                  setNotificationSending(false);
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <label>
                <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Title</span>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="e.g. New release available"
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Message</span>
                <textarea
                  value={notificationBody}
                  onChange={(e) => setNotificationBody(e.target.value)}
                  placeholder="Body text of the notification…"
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                />
              </label>
              <label>
                <span style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Schedule for (optional)</span>
                <input
                  type="datetime-local"
                  value={notificationScheduledFor}
                  onChange={(e) => setNotificationScheduledFor(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                  Leave empty to send immediately. Otherwise the notification will be sent at this time.
                </div>
              </label>
              <fieldset style={{ border: "1px solid #262637", borderRadius: 12, padding: "0.75rem 0.9rem" }}>
                <legend style={{ fontSize: 12, color: "#a3a3bf" }}>Send to clubs</legend>
                <p style={{ fontSize: 11, color: "#8a8cab", marginTop: 0, marginBottom: 10 }}>
                  Select one or more clubs. Only members of these clubs will receive this notification.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {(clubsFromApi ?? []).map((club) => (
                    <label key={club.code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={notificationClubCodes.includes(club.code)}
                        onChange={() =>
                          setNotificationClubCodes((prev) =>
                            prev.includes(club.code)
                              ? prev.filter((c) => c !== club.code)
                              : [...prev, club.code]
                          )
                        }
                      />
                      <span>{club.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                disabled={notificationSending}
                style={{
                  padding: "0.5rem 1.2rem",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: notificationSending ? "not-allowed" : "pointer",
                  opacity: notificationSending ? 0.7 : 1,
                  alignSelf: "flex-start"
                }}
              >
                {notificationSending
                  ? "Sending…"
                  : notificationScheduledFor.trim()
                  ? "Schedule notification"
                  : "Send push notification"}
              </button>
            </form>
          </section>
        )}

        {view === "notifications" && (
          <section
            style={{
              padding: "1.25rem 1.35rem 1.5rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637"
            }}
          >
            <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Notifications</h2>
            <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0, marginBottom: 12 }}>
              Scheduled and sent push notifications.
            </p>
            {notificationsList.length === 0 ? (
              <p style={{ fontSize: 13, color: "#6f7087" }}>No notifications yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid #262637", borderRadius: 12, overflow: "hidden" }}>
                {notificationsList.map((n) => (
                  <li
                    key={n.id}
                    style={{
                      padding: "0.6rem 0.75rem",
                      borderBottom: "1px solid #262637",
                      fontSize: 13,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>{n.title}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            border: "1px solid #262637",
                            color: n.status === "scheduled" ? "#f2c28e" : "#8be0a4"
                          }}
                        >
                          {n.status === "scheduled" ? "Scheduled" : "Sent"}
                        </span>
                      </div>
                      {n.body && <div style={{ color: "#a3a3bf", marginTop: 4, fontSize: 12 }}>{n.body}</div>}
                      <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 6 }}>
                        To: {(n.clubCodes || []).join(", ")}
                        {" · "}
                        {n.status === "scheduled" && n.scheduledFor
                          ? `Scheduled for ${new Date(n.scheduledFor).toLocaleString()}`
                          : n.sentAt
                          ? `Sent ${new Date(n.sentAt).toLocaleString()}`
                          : ""}
                      </div>
                    </div>
                    {n.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("Cancel this scheduled notification?")) return;
                          try {
                            const res = await apiRequest(`/api/notifications/${n.id}`, { method: "DELETE" });
                            if (res.ok) loadNotifications();
                            else alert("Could not cancel.");
                          } catch {
                            alert("Could not reach backend.");
                          }
                        }}
                        style={{
                          fontSize: 11,
                          padding: "0.25rem 0.5rem",
                          border: "1px solid #4a2020",
                          borderRadius: 6,
                          background: "transparent",
                          color: "#e88",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === "products" && (
          <section
            style={{
              marginTop: 20,
              padding: "1rem 1.1rem",
              borderRadius: 18,
              backgroundColor: "#11111a",
              border: "1px solid #262637"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10
              }}
            >
              <h2 style={{ fontSize: 15, margin: 0 }}>Product list</h2>
              <div style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                <select
                  value={productSort}
                  onChange={(e) =>
                    setProductSort(e.target.value as "name" | "club")
                  }
                  style={{
                    ...inputStyle,
                    maxWidth: 200,
                    fontSize: 12,
                    paddingTop: "0.35rem",
                    paddingBottom: "0.35rem"
                  }}
                >
                  <option value="name">Sort by name</option>
                  <option value="club">Sort by available club</option>
                </select>
                <button
                  type="button"
                  onClick={() => setProductFilter("active")}
                  style={{
                    padding: "0.35rem 0.7rem",
                    borderRadius: 999,
                    border:
                      productFilter === "active"
                        ? "1px solid #5677fc"
                        : "1px solid #262637",
                    backgroundColor:
                      productFilter === "active" ? "#17172b" : "transparent",
                    color:
                      productFilter === "active" ? "#e5e7ff" : "#a3a3bf",
                    cursor: "pointer"
                  }}
                >
                  For sale
                </button>
                <button
                  type="button"
                  onClick={() => setProductFilter("inactive")}
                  style={{
                    padding: "0.35rem 0.7rem",
                    borderRadius: 999,
                    border:
                      productFilter === "inactive"
                        ? "1px solid #5677fc"
                        : "1px solid #262637",
                    backgroundColor:
                      productFilter === "inactive" ? "#17172b" : "transparent",
                    color:
                      productFilter === "inactive" ? "#e5e7ff" : "#a3a3bf",
                    cursor: "pointer"
                  }}
                >
                  Not for sale
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#a3a3bf", marginBottom: 8 }}>
              Showing {productFilter === "active" ? "active" : "archived"}{" "}
              products{productsFromApi ? "" : " (stubbed data)"}.
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredProducts.map((p) => {
                const invQty = "inventoryQuantity" in p ? (p as { inventoryQuantity: number }).inventoryQuantity : 0;
                const isEditingInv = editingInventoryProductId === p.id;
                return (
                  <li
                    key={p.id}
                    style={{
                      padding: "0.6rem 0.5rem",
                      borderBottom: "1px solid #1a1a25",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 2 }}>
                        Clubs:{" "}
                        {p.clubTags
                          .map((code) => clubLabelFromList(clubsFromApi, code))
                          .join(", ")}
                      </div>
                      <div style={{ fontSize: 11, color: "#8a8cab", marginTop: 4 }}>
                        Ordered, not picked up: {p.orderedNotPickedUpCount ?? 0}
                        {" · "}
                        Inventory: {isEditingInv ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              value={inlineInventoryValue}
                              onChange={(e) => setInlineInventoryValue(e.target.value)}
                              style={{ ...inputStyle, width: 64, padding: "0.2rem 0.4rem", fontSize: 11 }}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const val = Math.max(0, parseInt(inlineInventoryValue, 10) || 0);
                                try {
                                  const res = await apiRequest(`/api/products/${p.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ inventoryQuantity: val })
                                  });
                                  if (res.ok) {
                                    setEditingInventoryProductId(null);
                                    setInlineInventoryValue("");
                                    loadProducts();
                                  } else alert("Failed to update inventory.");
                                } catch {
                                  alert("Could not reach backend.");
                                }
                              }}
                              style={{ marginLeft: 6, padding: "0.2rem 0.5rem", fontSize: 11, cursor: "pointer", borderRadius: 6, border: "1px solid #262637", background: "#17172b", color: "#e5e7ff" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingInventoryProductId(null); setInlineInventoryValue(""); }}
                              style={{ marginLeft: 4, padding: "0.2rem 0.5rem", fontSize: 11, cursor: "pointer", borderRadius: 6, border: "1px solid #262637", background: "transparent", color: "#a3a3bf" }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {invQty}
                            {productsFromApi && (
                              <button
                                type="button"
                                onClick={() => { setEditingInventoryProductId(p.id); setInlineInventoryValue(String(invQty)); }}
                                style={{ marginLeft: 6, padding: "0 0.3rem", fontSize: 10, cursor: "pointer", color: "#5677fc" }}
                              >
                                Edit
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "0.2rem 0.6rem",
                          borderRadius: 999,
                          border: "1px solid #262637",
                          color: p.isActive ? "#8be0a4" : "#f2c28e"
                        }}
                      >
                        {p.isActive ? "For sale" : "Not for sale"}
                      </span>
                      {productsFromApi && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              setAllocationModalProduct({ id: p.id, name: p.name });
                              setAllocationTargetType("club");
                              setAllocationClubCode("WOOD");
                              setAllocationMemberIds("");
                              setAllocationQuantityPerPerson(1);
                              setAllocationPullFromInventory(false);
                              try {
                                const res = await apiRequest(`/api/products/${p.id}/allocations`);
                                if (res.ok) {
                                  const list = await res.json();
                                  setAllocationList(Array.isArray(list) ? list : []);
                                } else setAllocationList([]);
                              } catch {
                                setAllocationList([]);
                              }
                            }}
                            style={{ fontSize: 11, padding: "0.25rem 0.5rem", cursor: "pointer", borderRadius: 6, border: "1px solid #262637", background: "#17172b", color: "#e5e7ff" }}
                          >
                            Allocate
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await apiRequest(`/api/products/${p.id}`);
                                if (!res.ok) throw new Error("Failed to load");
                                const full = await res.json();
                                loadProductIntoForm(full);
                              } catch {
                                alert("Could not load product.");
                              }
                            }}
                            style={{ fontSize: 11, padding: "0.25rem 0.5rem", cursor: "pointer", borderRadius: 6, border: "1px solid #262637", background: "#17172b", color: "#e5e7ff" }}
                          >
                            Edit
                          </button>
                          {p.isActive ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/products/${p.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ isActive: false })
                                  });
                                  if (res.ok) loadProducts();
                                  else alert("Failed to update.");
                                } catch {
                                  alert("Could not reach backend.");
                                }
                              }}
                              style={{ fontSize: 11, padding: "0.25rem 0.5rem", cursor: "pointer", borderRadius: 6, border: "1px solid #262637", background: "transparent", color: "#f2c28e" }}
                            >
                              Remove from sale
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/products/${p.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ isActive: true })
                                  });
                                  if (res.ok) loadProducts();
                                  else alert("Failed to update.");
                                } catch {
                                  alert("Could not reach backend.");
                                }
                              }}
                              style={{ fontSize: 11, padding: "0.25rem 0.5rem", cursor: "pointer", borderRadius: 6, border: "1px solid #262637", background: "transparent", color: "#8be0a4" }}
                            >
                              Put on sale
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Remove "${p.name}" completely? This cannot be undone.`)) return;
                              try {
                                const res = await apiRequest(`/api/products/${p.id}`, { method: "DELETE" });
                                if (res.ok) {
                                  if (editingProductId === p.id) resetProductForm();
                                  loadProducts();
                                } else alert("Failed to delete.");
                              } catch {
                                alert("Could not reach backend.");
                              }
                            }}
                            style={{ fontSize: 11, padding: "0.25rem 0.5rem", cursor: "pointer", borderRadius: 6, border: "1px solid #4a2020", background: "transparent", color: "#e88" }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {allocationModalProduct && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 100
                }}
                onClick={() => setAllocationModalProduct(null)}
              >
                <div
                  style={{
                    backgroundColor: "#11111a",
                    border: "1px solid #262637",
                    borderRadius: 18,
                    padding: "1.25rem 1.5rem",
                    maxWidth: 420,
                    width: "90%"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: 15 }}>
                    Allocate: {allocationModalProduct.name}
                  </h3>
                  {allocationList.length > 0 && (
                    <div style={{ fontSize: 12, color: "#8a8cab", marginBottom: 12 }}>
                      Existing: {allocationList.length} allocation(s) —{" "}
                      {allocationList.map((a) =>
                        a.targetType === "club"
                          ? `${a.clubCode} × ${a.quantityPerPerson} (${a.totalQuantity} total)`
                          : `${a.memberIds.length} members × ${a.quantityPerPerson}`
                      ).join("; ")}
                    </div>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!allocationModalProduct) return;
                      const qty = typeof allocationQuantityPerPerson === "number" ? allocationQuantityPerPerson : parseInt(String(allocationQuantityPerPerson), 10);
                      if (!Number.isInteger(qty) || qty < 1) {
                        alert("Quantity per person must be at least 1.");
                        return;
                      }
                      const body: { quantityPerPerson: number; targetType: "club" | "members"; clubCode?: string; memberIds?: string[]; pullFromInventory: boolean } = {
                        quantityPerPerson: qty,
                        targetType: allocationTargetType,
                        pullFromInventory: allocationPullFromInventory
                      };
                      if (allocationTargetType === "club") {
                        body.clubCode = allocationClubCode;
                      } else {
                        const ids = allocationMemberIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
                        if (ids.length === 0) {
                          alert("Enter at least one member ID (e.g. m1, m2).");
                          return;
                        }
                        body.memberIds = ids;
                      }
                      setAllocationSaving(true);
                      try {
                        const res = await apiRequest(`/api/products/${allocationModalProduct.id}/allocations`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body)
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          alert(data?.error || "Failed to create allocation.");
                          return;
                        }
                        const listRes = await apiRequest(`/api/products/${allocationModalProduct.id}/allocations`);
                        if (listRes.ok) {
                          const list = await listRes.json();
                          setAllocationList(Array.isArray(list) ? list : []);
                        }
                        loadProducts();
                      } catch {
                        alert("Could not reach backend.");
                      } finally {
                        setAllocationSaving(false);
                      }
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a3a3bf" }}>Target</label>
                      <div style={{ display: "flex", gap: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input
                            type="radio"
                            checked={allocationTargetType === "club"}
                            onChange={() => setAllocationTargetType("club")}
                          />
                          <span>Club</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input
                            type="radio"
                            checked={allocationTargetType === "members"}
                            onChange={() => setAllocationTargetType("members")}
                          />
                          <span>Individual members</span>
                        </label>
                      </div>
                    </div>
                    {allocationTargetType === "club" ? (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a3a3bf" }}>Club</label>
                        <select
                          value={allocationClubCode}
                          onChange={(e) => setAllocationClubCode(e.target.value as ClubCode)}
                          style={{ ...inputStyle, maxWidth: 200 }}
                        >
                          {(clubsFromApi ?? []).map((c) => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a3a3bf" }}>
                          Member IDs (comma-separated, e.g. m1, m2)
                        </label>
                        <input
                          type="text"
                          value={allocationMemberIds}
                          onChange={(e) => setAllocationMemberIds(e.target.value)}
                          placeholder="m1, m2, m3"
                          style={inputStyle}
                        />
                      </div>
                    )}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a3a3bf" }}>Quantity per person</label>
                      <input
                        type="number"
                        min={1}
                        value={allocationQuantityPerPerson === "" ? "" : allocationQuantityPerPerson}
                        onChange={(e) => setAllocationQuantityPerPerson(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                        style={{ ...inputStyle, maxWidth: 100 }}
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={allocationPullFromInventory}
                          onChange={(e) => setAllocationPullFromInventory(e.target.checked)}
                        />
                        <span style={{ fontSize: 12 }}>Pull from product inventory</span>
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setAllocationModalProduct(null)}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #262637", background: "transparent", color: "#a3a3bf", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={allocationSaving}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #5677fc", background: "#5677fc", color: "#fff", cursor: allocationSaving ? "not-allowed" : "pointer" }}
                      >
                        {allocationSaving ? "Creating…" : "Create allocation"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "shop" && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr)",
              gap: 18,
              alignItems: "flex-start"
            }}
          >
            <div
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637"
              }}
            >
              <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 4 }}>
                Toast member header
              </h2>
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0 }}>
                This is the header members see above your Toast online ordering
                page, showing their available promo codes.
              </p>
              <div
                style={{
                  marginTop: 12,
                  padding: "0.9rem 0.9rem",
                  borderRadius: 14,
                  backgroundColor: "#171722",
                  border: "1px solid #262637"
                }}
              >
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  Your clubs: Sap Club, Wood Club
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 6
                  }}
                >
                  <span
                    style={{
                      padding: "0.35rem 0.6rem",
                      borderRadius: 999,
                      backgroundColor: "#222236",
                      fontSize: 12
                    }}
                  >
                    Sap Club code: <strong>SAP2026</strong>
                  </span>
                  <span
                    style={{
                      padding: "0.35rem 0.6rem",
                      borderRadius: 999,
                      backgroundColor: "#222236",
                      fontSize: 12
                    }}
                  >
                    Wood Club code: <strong>WOOD2026</strong>
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#9b9dc1" }}>
                  Members copy their promo code here, then paste it at checkout
                  in Toast to apply their discount.
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "1.25rem 1.35rem 1.5rem",
                borderRadius: 18,
                backgroundColor: "#11111a",
                border: "1px solid #262637"
              }}
            >
              <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 4 }}>
                Toast online store
              </h2>
              <p style={{ fontSize: 12, color: "#8a8cab", marginTop: 0 }}>
                Members open Toast in an in-app browser (new tab on web; modal
                browser on mobile). Toast cannot be embedded in an iframe.
              </p>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    "https://order.toasttab.com/online/sapwood-cellars-brewery-8980-md-108",
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "0.6rem 1rem",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #5677fc, #7f5dff)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Open Toast to order
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid #2a2a3a",
  backgroundColor: "#050509",
  color: "#f5f5f7",
  fontSize: 13
};

const legendStyle: React.CSSProperties = {
  padding: "0 4px",
  fontSize: 11,
  textTransform: "uppercase",
  color: "#8a8cab"
};

