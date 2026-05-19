import { useState, useEffect, useRef, useCallback } from "react";
import {
  Headphones, Zap, GraduationCap, Heart, Home, Guitar, Star, Check, Sparkles,
  ArrowLeft, Loader2, CheckCircle2, XCircle, Music2, ShoppingCart, Users, Mic2, Lock, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const TIER_ICONS = {
  listener: Headphones,
  individual: Zap,
  individual_covers: Mic2,
  student: GraduationCap,
  couple_duo: Heart,
  family: Home,
  adult_band: Guitar,
  under18_band: Star,
  covers_addon: Music2,
};

const TIER_COLORS = {
  listener: { ring: "#FF6B00", glow: "rgba(255,107,0,0.35)", bg: "rgba(255,107,0,0.08)" },
  individual: { ring: "#39FF14", glow: "rgba(57,255,20,0.25)", bg: "rgba(57,255,20,0.06)" },
  individual_covers: { ring: "#FF6B00", glow: "rgba(255,107,0,0.3)", bg: "rgba(255,107,0,0.07)" },
  student: { ring: "#39FF14", glow: "rgba(57,255,20,0.2)", bg: "rgba(57,255,20,0.05)" },
  couple_duo: { ring: "#FF6B00", glow: "rgba(255,107,0,0.2)", bg: "rgba(255,107,0,0.05)" },
  family: { ring: "#39FF14", glow: "rgba(57,255,20,0.2)", bg: "rgba(57,255,20,0.05)" },
  adult_band: { ring: "#FF6B00", glow: "rgba(255,107,0,0.2)", bg: "rgba(255,107,0,0.05)" },
  under18_band: { ring: "#39FF14", glow: "rgba(57,255,20,0.2)", bg: "rgba(57,255,20,0.05)" },
  covers_addon: { ring: "#FF6B00", glow: "rgba(255,107,0,0.2)", bg: "rgba(255,107,0,0.06)" },
};

export default function PricingPage({ onBack }) {
  const [tiers, setTiers] = useState([]);
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [ownershipProducts, setOwnershipProducts] = useState([]);
  const userId = useRef(
    localStorage.getItem("sidetrack_voter_id") ||
      (() => { const id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); return id; })()
  );

  useEffect(() => {
    loadTiers();
    loadStatus();
    loadStoreInfo();
    loadOwnership();
    loadOwnershipProducts();
    checkReturnFromStripe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkReturnFromStripe = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const paymentResult = params.get("payment");
    if (paymentResult === "cancelled") {
      setPaymentStatus("cancelled");
      toast.error("Payment cancelled. You can try again anytime.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (sessionId) {
      setPaymentStatus("polling");
      pollPaymentStatus(sessionId, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollPaymentStatus = async (sessionId, attempt) => {
    if (attempt >= 8) { setPaymentStatus("expired"); toast.error("Payment verification timed out."); window.history.replaceState({}, "", window.location.pathname); return; }
    try {
      const res = await axios.get(`${API}/payments/status/${sessionId}`);
      if (res.data.payment_status === "paid") { setPaymentStatus("paid"); toast.success("Payment successful!"); window.history.replaceState({}, "", window.location.pathname); loadStatus(); loadOwnership(); loadTiers(); return; }
      if (res.data.status === "expired") { setPaymentStatus("expired"); toast.error("Session expired."); window.history.replaceState({}, "", window.location.pathname); return; }
      setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), 2000);
    } catch (err) { console.error("Poll error:", err); setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), 2000); }
  };

  const loadTiers = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/tiers?user_id=${userId.current}`);
      if (res.data.success) setTiers(res.data.tiers);
    } catch (err) { console.error("Load tiers error:", err); }
    finally { setLoading(false); }
  };

  const loadStatus = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/${userId.current}/status`);
      if (res.data.success) setCurrentSub(res.data);
    } catch (err) { console.error("Load status error:", err); }
  };

  const loadOwnership = async () => {
    try {
      const res = await axios.get(`${API}/ownership/${userId.current}/status`);
      if (res.data.success) setOwnership(res.data);
    } catch (err) { console.error("Load ownership error:", err); }
  };

  const loadOwnershipProducts = async () => {
    try {
      const res = await axios.get(`${API}/ownership/products`);
      if (res.data.success) setOwnershipProducts(res.data.products);
    } catch (err) { console.error("Load ownership products error:", err); }
  };

  const loadStoreInfo = async () => {
    try {
      const res = await axios.get(`${API}/store/pricing`);
      if (res.data.success) setStoreInfo(res.data);
    } catch (err) { console.error("Load store info:", err); }
  };

  const selectTier = async (tierKey) => {
    // Client-side gate (UX); backend enforces too
    const tier = tiers.find(t => t.key === tierKey);
    if (tier?.locked) {
      toast.error("Unlock the Creator Ecosystem ($79.98 AUD) to access this tier", { duration: 4000 });
      return;
    }
    setSelecting(tierKey);
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        tier_key: tierKey, user_id: userId.current, origin_url: window.location.origin,
      });
      if (res.data.success && res.data.url) window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create checkout");
      setSelecting(null);
    }
  };

  // Simulate a Creator Ecosystem payment (used while Stripe AUD configuration may be pending)
  const simulateOwnership = async (productKey) => {
    setSelecting(productKey);
    try {
      const res = await axios.post(`${API}/ownership/simulate`, {
        tier_key: productKey, user_id: userId.current,
      });
      if (res.data.success) {
        setOwnership(res.data);
        loadTiers();
        if (res.data.is_owned) {
          toast.success("Creator Ecosystem unlocked! All tiers available.", { duration: 4000 });
        } else {
          toast.success(`Payment ${res.data.payments_made}/${res.data.payments_required} recorded`, { duration: 3000 });
        }
      }
    } catch (err) {
      toast.error("Failed to record payment");
    } finally {
      setSelecting(null);
    }
  };

  const checkoutOwnership = async (productKey) => {
    setSelecting(productKey);
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        tier_key: productKey, user_id: userId.current, origin_url: window.location.origin,
      });
      if (res.data.success && res.data.url) window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create checkout");
      setSelecting(null);
    }
  };

  const listenerTier = tiers.find(t => t.key === "listener");
  const creatorTiers = tiers.filter(t => t.category === "creator");
  const bandTiers = tiers.filter(t => t.category === "band");
  const coverAddon = tiers.find(t => t.key === "covers_addon");

  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="pricing-page">
      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="px-4 sm:px-6 py-6 pb-28 max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" onClick={onBack} className="text-[#5C5C6B] hover:text-white p-2" data-testid="pricing-back-btn">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-black text-white" data-testid="pricing-heading">
                Choose Your <span className="text-[#FF6B00] glow-text-orange">Plan</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#5C5C6B] mt-1">Unlock the full Pocket Products experience</p>
            </div>
          </div>

          {/* Payment status banners */}
          {paymentStatus === "polling" && (
            <div className="rounded-2xl border border-[#FF6B00]/30 p-4 flex items-center gap-3 animate-pulse" style={{ background: "rgba(255,107,0,0.06)" }} data-testid="payment-polling">
              <Loader2 className="w-5 h-5 text-[#FF6B00] animate-spin" />
              <p className="text-sm font-bold text-white">Verifying your payment...</p>
            </div>
          )}
          {paymentStatus === "paid" && (
            <div className="rounded-2xl border border-[#39FF14]/30 p-4 flex items-center gap-3" style={{ background: "rgba(57,255,20,0.06)" }} data-testid="payment-success">
              <CheckCircle2 className="w-5 h-5 text-[#39FF14]" />
              <p className="text-sm font-bold text-white">Payment successful! Your subscription is active.</p>
            </div>
          )}
          {paymentStatus === "cancelled" && (
            <div className="rounded-2xl border border-white/10 p-4 flex items-center gap-3" data-testid="payment-cancelled">
              <XCircle className="w-5 h-5 text-[#5C5C6B]" />
              <p className="text-sm text-[#5C5C6B]">Payment cancelled — choose a plan when you're ready</p>
            </div>
          )}

          {/* ── CREATOR ECOSYSTEM OWNERSHIP (Hero) ────── */}
          <OwnershipHero
            ownership={ownership}
            products={ownershipProducts}
            selecting={selecting}
            onCheckout={checkoutOwnership}
            onSimulate={simulateOwnership}
          />

          {/* ── LISTENER TIER (Hero) ────────────────── */}
          {listenerTier && (
            <section data-testid="listener-section">
              <div className="relative rounded-2xl overflow-hidden border border-[#FF6B00]/40"
                style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.10) 0%, rgba(5,5,10,0.95) 60%)", boxShadow: "0 0 40px rgba(255,107,0,0.15)" }}>
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#FF6B00] text-[#05050A] text-[10px] font-black uppercase tracking-wider">Most Popular</div>
                <div className="p-5 sm:p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,107,0,0.15)", boxShadow: "0 0 20px rgba(255,107,0,0.3)" }}>
                      <Headphones className="w-6 h-6 text-[#FF6B00]" />
                    </div>
                    <div>
                      <h2 className="font-['Outfit'] text-xl font-black text-white" data-testid="listener-tier-name">{listenerTier.name}</h2>
                      <p className="text-xs text-[#FF6B00] font-semibold">{listenerTier.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-4xl font-['Outfit'] font-black text-white">${listenerTier.price.toFixed(2)}</span>
                    <span className="text-sm text-[#5C5C6B]">/ month</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#39FF14]/15 text-[#39FF14] text-[10px] font-bold uppercase">First month free</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {listenerTier.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-[#C0C0C8]">
                        <Check className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  <Button onClick={() => selectTier("listener")} disabled={selecting === "listener" || currentSub?.tier_key === "listener"}
                    className="w-full h-12 rounded-xl font-bold text-sm text-[#05050A] bg-[#FF6B00] hover:bg-[#FF6B00]/90" style={{ boxShadow: "0 0 24px rgba(255,107,0,0.4)" }} data-testid="listener-select-btn">
                    {currentSub?.tier_key === "listener" ? "Current Plan" : selecting === "listener" ? "Processing..." : <><Sparkles className="w-4 h-4 mr-2" /> Start Listening</>}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── CREATOR TIERS ─────────────────────── */}
          <section data-testid="creator-tiers-section">
            <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#39FF14]" /> Creator Plans
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {creatorTiers.map(tier => (
                <TierCard key={tier.key} tier={tier} selecting={selecting} currentTierKey={currentSub?.tier_key} onSelect={selectTier} />
              ))}
            </div>
          </section>

          {/* ── BAND TIERS ────────────────────────── */}
          <section data-testid="band-tiers-section">
            <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-4 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" /> Band Plans
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bandTiers.map(tier => (
                <TierCard key={tier.key} tier={tier} selecting={selecting} currentTierKey={currentSub?.tier_key} onSelect={selectTier} />
              ))}
            </div>
          </section>

          {/* ── COVERS ADD-ON ─────────────────────── */}
          {coverAddon && (
            <section data-testid="covers-addon-section">
              <div className="rounded-2xl border border-[#FF6B00]/20 p-4 sm:p-5 flex items-center gap-4" style={{ background: "rgba(255,107,0,0.04)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
                  <Music2 className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Covers Add-on — <span className="text-[#FF6B00]">${coverAddon.price.toFixed(2)}/mo</span></p>
                  <p className="text-[10px] text-[#5C5C6B] mt-0.5">Stack with any plan. Unlimited cover recordings & distribution rights.</p>
                </div>
                <Button onClick={() => selectTier("covers_addon")} disabled={selecting === "covers_addon"}
                  className="h-9 px-4 rounded-xl text-xs font-bold bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/30 hover:bg-[#FF6B00]/25" data-testid="covers-addon-btn">
                  {selecting === "covers_addon" ? "..." : "Add"}
                </Button>
              </div>
            </section>
          )}

          {/* ── PAY-PER-SONG & REVENUE SPLIT ──────── */}
          {storeInfo && (
            <section data-testid="pay-per-song-section">
              <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-4 flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-[#FF6B00]" /> Song Store
              </h3>
              <div className="rounded-2xl border border-white/5 p-5 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-white">Buy individual songs</p>
                    <p className="text-xs text-[#5C5C6B] mt-0.5">Tracks outside curated playlists available to purchase</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-['Outfit'] font-black text-[#FF6B00]">${storeInfo.price_per_song.toFixed(2)}</span>
                    <p className="text-[10px] text-[#5C5C6B]">per song</p>
                  </div>
                </div>

                {/* Revenue Split */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl p-3 border border-[#39FF14]/15" style={{ background: "rgba(57,255,20,0.04)" }}>
                    <p className="text-2xl font-['Outfit'] font-black text-[#39FF14]">{storeInfo.artist_cut_pct}%</p>
                    <p className="text-[10px] text-[#5C5C6B] uppercase tracking-wider font-bold">To Artist</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-2xl font-['Outfit'] font-black text-[#5C5C6B]">{storeInfo.platform_cut_pct}%</p>
                    <p className="text-[10px] text-[#5C5C6B] uppercase tracking-wider font-bold">Platform Fee</p>
                  </div>
                </div>

                {/* Curated categories */}
                <div>
                  <p className="text-[10px] text-[#5C5C6B] uppercase tracking-wider font-bold mb-2">Included with all subscriptions:</p>
                  <div className="flex flex-wrap gap-2">
                    {storeInfo.curated_categories.map(cat => (
                      <span key={cat} className="px-2.5 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-[10px] font-bold">{cat}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Competition Reward */}
          <div className="rounded-2xl border border-[#39FF14]/20 p-4 sm:p-5 flex items-center gap-4" style={{ background: "rgba(57,255,20,0.04)" }} data-testid="competition-reward-banner">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(57,255,20,0.12)" }}>
              <Star className="w-5 h-5 text-[#39FF14]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Win a Battle = 1 Month Free</p>
              <p className="text-[11px] text-[#5C5C6B] mt-0.5">Top-voted cover each week earns a free month of any Pro tier.</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function TierCard({ tier, selecting, currentTierKey, onSelect }) {
  const Icon = TIER_ICONS[tier.key] || Zap;
  const colors = TIER_COLORS[tier.key] || TIER_COLORS.individual;
  const isCurrent = currentTierKey === tier.key;
  const isLocked = !!tier.locked;

  return (
    <div className={`relative rounded-2xl border p-4 flex flex-col justify-between transition-all hover:border-white/10 ${tier.highlight ? "border-[#FF6B00]/30" : "border-white/5"} ${isLocked ? "opacity-95" : ""}`}
      style={{ background: colors.bg }} data-testid={`tier-card-${tier.key}`}>
      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 rounded-2xl bg-black/55 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-3 text-center" data-testid={`tier-locked-${tier.key}`}>
          <div className="w-10 h-10 rounded-full bg-[#39FF14]/15 border border-[#39FF14]/40 flex items-center justify-center mb-2"
               style={{ boxShadow: "0 0 20px rgba(57,255,20,0.25)" }}>
            <Lock className="w-5 h-5 text-[#39FF14]" />
          </div>
          <p className="text-[11px] font-black text-[#39FF14] uppercase tracking-wider">Ownership Required</p>
          <p className="text-[10px] text-[#C0C0C8] mt-1 leading-tight">Unlock the Creator Ecosystem to access this discounted tier</p>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${colors.ring}20` }}>
            <Icon className="w-4.5 h-4.5" style={{ color: colors.ring }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{tier.name}</p>
            <p className="text-[10px] text-[#5C5C6B]">{tier.tagline}</p>
          </div>
          {tier.includes_covers && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-[#FF6B00]/15 text-[#FF6B00] text-[8px] font-bold uppercase">Covers</span>
          )}
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-['Outfit'] font-black text-white">${tier.price.toFixed(2)}</span>
          <span className="text-[10px] text-[#5C5C6B]">/ mo</span>
        </div>
        <ul className="space-y-1.5 mb-4">
          {tier.features.map(f => (
            <li key={f} className="flex items-start gap-1.5 text-xs text-[#A0A0B0]">
              <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: colors.ring }} />{f}
            </li>
          ))}
        </ul>
      </div>
      <Button onClick={() => onSelect(tier.key)} disabled={selecting === tier.key || isCurrent || isLocked}
        className="w-full h-9 rounded-xl text-xs font-bold transition-all"
        style={{ background: isCurrent ? "rgba(57,255,20,0.15)" : `${colors.ring}18`, color: isCurrent ? "#39FF14" : colors.ring, border: `1px solid ${isCurrent ? "rgba(57,255,20,0.3)" : `${colors.ring}30`}` }}
        data-testid={`tier-select-${tier.key}`}>
        {isCurrent ? "Current Plan" : selecting === tier.key ? "Processing..." : "Choose Plan"}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Ownership Hero — Creator Ecosystem unlock
// ─────────────────────────────────────────────────
function OwnershipHero({ ownership, products, selecting, onCheckout, onSimulate }) {
  if (!products || products.length === 0) return null;
  const full = products.find(p => p.key === "ownership_full");
  const finance = products.find(p => p.key === "ownership_finance");
  const isOwned = ownership?.is_owned;
  const isFinancing = ownership?.status === "financing";
  const progress = ownership?.progress_pct || 0;
  const made = ownership?.payments_made || 0;
  const required = ownership?.payments_required || 12;
  const remaining = ownership?.payments_remaining || 12;

  return (
    <section data-testid="ownership-hero">
      <div className="relative rounded-2xl overflow-hidden border-2"
        style={{
          borderColor: isOwned ? "rgba(57,255,20,0.5)" : "rgba(255,107,0,0.5)",
          background: isOwned
            ? "linear-gradient(135deg, rgba(57,255,20,0.10) 0%, rgba(5,5,10,0.96) 65%)"
            : "linear-gradient(135deg, rgba(255,107,0,0.12) 0%, rgba(57,255,20,0.05) 50%, rgba(5,5,10,0.96) 100%)",
          boxShadow: isOwned ? "0 0 50px rgba(57,255,20,0.18)" : "0 0 50px rgba(255,107,0,0.18)",
        }}>
        {/* Status badge */}
        <div className="absolute top-3 right-3 z-10">
          {isOwned ? (
            <span className="badge-glass px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-[#39FF14] border-[#39FF14]/40 flex items-center gap-1" data-testid="ownership-status-owned">
              <Crown className="w-3 h-3" /> Owner
            </span>
          ) : isFinancing ? (
            <span className="badge-glass px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-[#FF6B00] border-[#FF6B00]/40" data-testid="ownership-status-financing">
              Financing {made}/{required}
            </span>
          ) : (
            <span className="badge-glass px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-[#FF6B00] border-[#FF6B00]/40">
              Unlock Required
            </span>
          )}
        </div>

        <div className="p-5 sm:p-7">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: "rgba(255,107,0,0.15)", boxShadow: "0 0 22px rgba(255,107,0,0.3)" }}>
              <Crown className="w-6 h-6 text-[#FF6B00]" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-xl font-black text-white leading-tight" data-testid="ownership-headline">
                Unlock the <span className="text-[#FF6B00] glow-text-orange">Creator Ecosystem</span>
              </h2>
              <p className="text-[11px] text-[#39FF14] font-semibold uppercase tracking-wider mt-0.5">
                Eligibility for community-discounted tiers
              </p>
            </div>
          </div>

          {/* Financing progress (when financing) */}
          {isFinancing && (
            <div className="mb-5 p-3 rounded-xl border border-[#FF6B00]/30" style={{ background: "rgba(255,107,0,0.05)" }} data-testid="ownership-progress-bar">
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-white font-bold">Payment {made} of {required}</span>
                <span className="text-[#FF6B00] font-bold">{remaining} to go</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #FF6B00 0%, #39FF14 100%)",
                    boxShadow: "0 0 12px rgba(255,107,0,0.5)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Owned state */}
          {isOwned ? (
            <div className="p-4 rounded-xl border border-[#39FF14]/30 flex items-center gap-3" style={{ background: "rgba(57,255,20,0.06)" }}>
              <CheckCircle2 className="w-6 h-6 text-[#39FF14] shrink-0" />
              <div>
                <p className="text-sm font-black text-white">Creator Ecosystem Unlocked</p>
                <p className="text-[11px] text-[#5C5C6B]">All discounted tiers (Student / Band / Family / Couple) are available below.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Two CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {/* Buy Once */}
                {full && (
                  <div className="rounded-xl border border-[#FF6B00]/30 p-4 flex flex-col" style={{ background: "rgba(255,107,0,0.05)" }} data-testid="ownership-full-card">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-['Outfit'] font-black text-white">${full.price.toFixed(2)}</span>
                      <span className="text-xs text-[#FF6B00] font-bold uppercase tracking-wider">AUD</span>
                    </div>
                    <p className="text-[11px] text-[#5C5C6B] font-medium mb-3">{full.tagline}</p>
                    <ul className="space-y-1 mb-4 flex-1">
                      {full.benefits.slice(0, 3).map(b => (
                        <li key={b} className="flex items-start gap-1.5 text-[11px] text-[#C0C0C8]">
                          <Check className="w-3 h-3 text-[#FF6B00] shrink-0 mt-0.5" />{b}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button onClick={() => onCheckout("ownership_full")} disabled={selecting === "ownership_full"}
                        className="flex-1 h-10 rounded-xl text-xs font-bold text-[#05050A] bg-[#FF6B00] hover:bg-[#FF6B00]/90"
                        style={{ boxShadow: "0 0 20px rgba(255,107,0,0.35)" }}
                        data-testid="ownership-full-checkout-btn">
                        {selecting === "ownership_full" ? "..." : "Buy Once"}
                      </Button>
                      <Button onClick={() => onSimulate("ownership_full")} disabled={selecting === "ownership_full"}
                        className="h-10 px-3 rounded-xl text-[10px] font-bold border border-[#FF6B00]/40 text-[#FF6B00] bg-transparent hover:bg-[#FF6B00]/10"
                        title="Dev simulate" data-testid="ownership-full-sim-btn">
                        Sim
                      </Button>
                    </div>
                  </div>
                )}

                {/* Finance */}
                {finance && (
                  <div className="rounded-xl border border-[#39FF14]/30 p-4 flex flex-col" style={{ background: "rgba(57,255,20,0.05)" }} data-testid="ownership-finance-card">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-['Outfit'] font-black text-white">${finance.price.toFixed(2)}</span>
                      <span className="text-xs text-[#39FF14] font-bold">/ mo × 12</span>
                    </div>
                    <p className="text-[11px] text-[#5C5C6B] font-medium mb-3">
                      {finance.tagline} <span className="text-[#39FF14]">(Total ${finance.total_value} AUD)</span>
                    </p>
                    <ul className="space-y-1 mb-4 flex-1">
                      {finance.benefits.slice(0, 3).map(b => (
                        <li key={b} className="flex items-start gap-1.5 text-[11px] text-[#C0C0C8]">
                          <Check className="w-3 h-3 text-[#39FF14] shrink-0 mt-0.5" />{b}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button onClick={() => onCheckout("ownership_finance")} disabled={selecting === "ownership_finance"}
                        className="flex-1 h-10 rounded-xl text-xs font-bold text-[#05050A] bg-[#39FF14] hover:bg-[#39FF14]/90"
                        style={{ boxShadow: "0 0 20px rgba(57,255,20,0.35)" }}
                        data-testid="ownership-finance-checkout-btn">
                        {selecting === "ownership_finance" ? "..." : "Subscribe to Own"}
                      </Button>
                      <Button onClick={() => onSimulate("ownership_finance")} disabled={selecting === "ownership_finance"}
                        className="h-10 px-3 rounded-xl text-[10px] font-bold border border-[#39FF14]/40 text-[#39FF14] bg-transparent hover:bg-[#39FF14]/10"
                        title="Dev simulate next payment" data-testid="ownership-finance-sim-btn">
                        Sim
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-[#5C5C6B] text-center">
                Non-owners are restricted to the <span className="text-white font-bold">Listener</span> and <span className="text-white font-bold">Individual Creator</span> tiers.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
