import React from "react";

/** API base; same as member app. */
function getApiBase(): string {
  const env = typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  if (env && String(env).trim()) {
    let base = String(env).trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(base)) base = "https://" + base;
    return base;
  }
  return "";
}

type PickupItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  status: string;
  pickedUpAt: string | null;
};

type Data = {
  member: { id: string; name: string | null; email: string | null };
  pickups: PickupItem[];
};

/**
 * Standalone staff pickup page: open at /staff-pickup?memberId=xxx (e.g. from QR scan).
 * Fetches pickups from API and lets staff mark items picked up. No auth.
 */
export const StaffPickupPage: React.FC = () => {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const memberId = params.get("memberId")?.trim() ?? "";

  const [state, setState] = React.useState<"loading" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const [data, setData] = React.useState<Data | null>(null);
  const [markingId, setMarkingId] = React.useState<string | null>(null);

  const api = getApiBase();

  const load = React.useCallback(() => {
    if (!memberId) {
      setState("error");
      setErrorMsg("No member ID in URL. Use ?memberId=...");
      return;
    }
    if (!api) {
      setState("error");
      setErrorMsg("API URL not configured (VITE_API_BASE).");
      return;
    }
    setState("loading");
    setErrorMsg("");
    const url = `${api}/api/pickups/by-member/${encodeURIComponent(memberId)}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) {
          return r.text().then((t) => {
            let msg = `Request failed (${r.status})`;
            try {
              const j = JSON.parse(t);
              if (j?.error) msg = j.error;
            } catch {
              if (t && t.length < 200) msg = t;
            }
            throw new Error(msg);
          });
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        setState("ok");
      })
      .catch((e: Error) => {
        setState("error");
        setErrorMsg(e?.message ?? "Request failed");
      });
  }, [memberId, api]);

  React.useEffect(() => {
    load();
  }, [load]);

  const markPickedUp = (id: string) => {
    if (!api) return;
    setMarkingId(id);
    fetch(`${api}/api/pickups/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickedUp: true })
    })
      .then((r) => {
        if (r.ok) load();
        else return r.json().then((j) => Promise.reject(new Error(j?.error ?? "Failed")));
      })
      .catch(() => setMarkingId(null))
      .finally(() => setMarkingId(null));
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#0f0f14",
      color: "#e8e8e8",
      fontFamily: "system-ui, sans-serif",
      padding: 16,
      boxSizing: "border-box"
    },
    h1: { fontSize: "1.25rem", margin: "0 0 8px 0" },
    sub: { color: "#888", fontSize: "0.875rem", marginBottom: 16 },
    card: {
      background: "#1a1a22",
      border: "1px solid #2a2a35",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12
    },
    row: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid #2a2a35"
    },
    badge: { fontSize: "0.75rem", padding: "2px 8px", borderRadius: 6 },
    btn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#5677fc", color: "#fff", fontSize: "0.875rem", cursor: "pointer" },
    error: { color: "#f28b82" },
    empty: { color: "#888" }
  };

  if (state === "loading") {
    return (
      <div style={styles.page}>
        <p style={styles.empty}>Loading…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={styles.page}>
        <p style={styles.error}>{errorMsg}</p>
        {memberId && api && (
          <button type="button" style={{ ...styles.btn, marginTop: 12 }} onClick={load}>
            Retry
          </button>
        )}
      </div>
    );
  }

  const name = data?.member?.name || data?.member?.email || (data?.member?.id ? `Member ${data.member.id}` : "Member");

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Pickups for {name}</h1>
      <p style={styles.sub}>Member ID: {memberId}</p>

      {!data?.pickups?.length ? (
        <div style={styles.card}>
          <p style={styles.empty}>No items to pick up for this member.</p>
        </div>
      ) : (
        data.pickups.map((p) => {
          const isReady = p.status === "READY_FOR_PICKUP";
          return (
            <div key={p.id} style={styles.card}>
              <div style={styles.row}>
                <div>
                  <strong>{p.productName || "Item"}</strong> × {p.quantity}
                  <br />
                  <span
                    style={{
                      ...styles.badge,
                      background: isReady ? "rgba(86, 119, 252, 0.25)" : "rgba(110, 200, 120, 0.2)",
                      color: isReady ? "#b8c8ff" : "#8be0a4"
                    }}
                  >
                    {isReady ? "Ready for pickup" : "Picked up" + (p.pickedUpAt ? ` – ${new Date(p.pickedUpAt).toLocaleString()}` : "")}
                  </span>
                </div>
                {isReady && (
                  <button
                    type="button"
                    style={styles.btn}
                    disabled={markingId === p.id}
                    onClick={() => markPickedUp(p.id)}
                  >
                    {markingId === p.id ? "…" : "Mark picked up"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
