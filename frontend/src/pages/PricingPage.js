import { useState, useEffect, useRef, useCallback } from "react";
import {
  Crown,
  Zap,
  Users,
  GraduationCap,
  Heart,
  Home,
  Guitar,
  Star,
  Check,
  Sparkles,
  ArrowLeft,
  MessageCircle,
  Palette,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const TIER_ICONS = {
  stadium_vip: Crown,
  individual: Zap,
  student: GraduationCap,
  couple_duo: Heart,
  family: Home,
  adult_band: Guitar,
  under18_band: Star,
};

const TIER_COLORS = {
  stadium_vip: { ring: "#FF6B00", glow: "rgba(255,107,0,0.35)", bg: "rgba(255,107,0,0.08)" },
  individual: { ring: "#39FF14", glow: "rgba(57,255,20,0.25)", bg: "rgba(57,255,20,0.06)" },
  student: { ring: "#39FF14", glow: "rgba(57,255,20,0.2)", bg: "rgba(57,255,20,0.05)" },
  couple_duo: { ring: "#FF6B00", glow: "rgba(255,107,0,0.2)", bg: "rgba(255,107,0,0.05)" },
  family: { ring: "#39FF14", glow: "rgba(57,255,20,0.2)", bg: "rgba(57,255,20,0.05)" },
  adult_band: { ring: "#FF6B00", glow: "rgba(255,107,0,0.2)", bg: "rgba(255,107,0,0.05)" },
  under18_band: { ring: "#39FF14", glow: "rgba(57,255,20,0.2)", bg: "rgba(57,255,20,0.05)" },
};

const VIP_PERKS = [
  { icon: Palette, label: "Neon Badges", desc: "Exclusive chat badges & emojis" },
  { icon: Send, label: "Save Mixes", desc: "Save & share your Fan Mixer creations" },
  { icon: MessageCircle, label: "Priority DMs", desc: "Direct message artists during live sessions" },
];

export default function PricingPage({ onBack }) {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // null | "polling" | "paid" | "cancelled" | "expired"
  const userId = useRef(
    localStorage.getItem("sidetrack_voter_id") ||
      (() => {
        const id = crypto.randomUUID();
        localStorage.setItem("sidetrack_voter_id", id);
        return id;
      })()
  );

  useEffect(() => {
    loadTiers();
    loadStatus();
    checkReturnFromStripe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if returning from Stripe checkout
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
    const maxAttempts = 8;
    if (attempt >= maxAttempts) {
      setPaymentStatus("expired");
      toast.error("Payment verification timed out. Check your profile for status.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    try {
      const res = await axios.get(`${API}/payments/status/${sessionId}`);
      if (res.data.payment_status === "paid") {
        setPaymentStatus("paid");
        toast.success("Payment successful! Your Pro subscription is now active.");
        window.history.replaceState({}, "", window.location.pathname);
        loadStatus(); // Refresh subscription status
        return;
      } else if (res.data.status === "expired") {
        setPaymentStatus("expired");
        toast.error("Payment session expired. Please try again.");
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      // Still pending — poll again
      setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), 2000);
    } catch (err) { console.error("Pricing load error:", err);
      setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), 2000);
    }
  };

  const loadTiers = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/tiers`);
      if (res.data.success) setTiers(res.data.tiers);
    } catch (err) { console.error("Pricing load error:", err);
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/${userId.current}/status`);
      if (res.data.success) setCurrentSub(res.data);
    } catch (err) { console.error("Pricing load error:", err);
      /* silent */
    }
  };

  const selectTier = async (tierKey) => {
    setSelecting(tierKey);
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        tier_key: tierKey,
        user_id: userId.current,
        origin_url: window.location.origin,
      });
      if (res.data.success && res.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create checkout session");
      setSelecting(null);
    }
  };

  const vipTier = tiers.find((t) => t.key === "stadium_vip");
  const creatorTiers = tiers.filter((t) => t.category === "creator");
  const bandTiers = tiers.filter((t) => t.category === "band");

  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="pricing-page">
      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="px-4 sm:px-6 py-6 pb-28 max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-[#5C5C6B] hover:text-white p-2"
                data-testid="pricing-back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1
                className="font-['Outfit'] text-3xl sm:text-4xl font-black text-white"
                data-testid="pricing-heading"
              >
                Go <span className="text-[#FF6B00] glow-text-orange">Pro</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#5C5C6B] mt-1">
                Unlock the full Pocket Products experience
              </p>
            </div>
          </div>

          {/* Payment Status Banner */}
          {paymentStatus === "polling" && (
            <div className="rounded-2xl border border-[#FF6B00]/30 p-4 flex items-center gap-3 animate-pulse" style={{ background: "rgba(255,107,0,0.06)" }} data-testid="payment-polling">
              <Loader2 className="w-5 h-5 text-[#FF6B00] animate-spin" />
              <div>
                <p className="text-sm font-bold text-white">Verifying your payment...</p>
                <p className="text-[10px] text-[#5C5C6B]">Please wait while we confirm with Stripe</p>
              </div>
            </div>
          )}
          {paymentStatus === "paid" && (
            <div className="rounded-2xl border border-[#39FF14]/30 p-4 flex items-center gap-3" style={{ background: "rgba(57,255,20,0.06)" }} data-testid="payment-success">
              <CheckCircle2 className="w-5 h-5 text-[#39FF14]" />
              <div>
                <p className="text-sm font-bold text-white">Payment successful!</p>
                <p className="text-[10px] text-[#39FF14]">Your Pro subscription is now active</p>
              </div>
            </div>
          )}
          {paymentStatus === "cancelled" && (
            <div className="rounded-2xl border border-white/10 p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.02)" }} data-testid="payment-cancelled">
              <XCircle className="w-5 h-5 text-[#5C5C6B]" />
              <p className="text-sm text-[#5C5C6B]">Payment cancelled — choose a plan when you're ready</p>
            </div>
          )}

          {/* ── STADIUM VIP ─────────────────────────────── */}
          {vipTier && (
            <section data-testid="vip-section">
              <div
                className="relative rounded-2xl overflow-hidden border border-[#FF6B00]/40"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,107,0,0.10) 0%, rgba(5,5,10,0.95) 60%)",
                  boxShadow: "0 0 40px rgba(255,107,0,0.15), 0 0 80px rgba(255,107,0,0.06)",
                }}
              >
                {/* Ribbon */}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#FF6B00] text-[#05050A] text-[10px] font-black uppercase tracking-wider">
                  Fan Favourite
                </div>

                <div className="p-5 sm:p-7">
                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: "rgba(255,107,0,0.15)",
                        boxShadow: "0 0 20px rgba(255,107,0,0.3)",
                      }}
                    >
                      <Crown className="w-6 h-6 text-[#FF6B00]" />
                    </div>
                    <div>
                      <h2
                        className="font-['Outfit'] text-xl font-black text-white"
                        data-testid="vip-tier-name"
                      >
                        {vipTier.name}
                      </h2>
                      <p className="text-xs text-[#FF6B00] font-semibold">{vipTier.tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-4xl font-['Outfit'] font-black text-white">
                      ${vipTier.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-[#5C5C6B]">/ month</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#39FF14]/15 text-[#39FF14] text-[10px] font-bold uppercase">
                      First month free
                    </span>
                  </div>

                  {/* VIP Perk Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    {VIP_PERKS.map((p) => (
                      <div
                        key={p.label}
                        className="rounded-xl p-3 border border-white/5"
                        style={{ background: "rgba(255,107,0,0.06)" }}
                      >
                        <p.icon className="w-5 h-5 text-[#FF6B00] mb-2" />
                        <p className="text-xs font-bold text-white">{p.label}</p>
                        <p className="text-[10px] text-[#5C5C6B] mt-0.5 leading-snug">{p.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2 mb-5">
                    {vipTier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-[#C0C0C8]">
                        <Check className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    onClick={() => selectTier("stadium_vip")}
                    disabled={selecting === "stadium_vip" || currentSub?.tier_key === "stadium_vip"}
                    className="w-full h-12 rounded-xl font-bold text-sm text-[#05050A] bg-[#FF6B00] hover:bg-[#FF6B00]/90 transition-all"
                    style={{
                      boxShadow: "0 0 24px rgba(255,107,0,0.4)",
                    }}
                    data-testid="vip-select-btn"
                  >
                    {currentSub?.tier_key === "stadium_vip" ? (
                      "Current Plan"
                    ) : selecting === "stadium_vip" ? (
                      <span className="animate-pulse">Processing...</span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Get Stadium VIP
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── CREATOR TIERS ─────────────────────────── */}
          <section data-testid="creator-tiers-section">
            <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#39FF14]" /> Creator Plans
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {creatorTiers.map((tier) => (
                <TierCard
                  key={tier.key}
                  tier={tier}
                  selecting={selecting}
                  currentTierKey={currentSub?.tier_key}
                  onSelect={selectTier}
                />
              ))}
            </div>
          </section>

          {/* ── BAND TIERS ────────────────────────────── */}
          <section data-testid="band-tiers-section">
            <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-4 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" /> Band Plans
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bandTiers.map((tier) => (
                <TierCard
                  key={tier.key}
                  tier={tier}
                  selecting={selecting}
                  currentTierKey={currentSub?.tier_key}
                  onSelect={selectTier}
                />
              ))}
            </div>
          </section>

          {/* Competition Reward Banner */}
          <div
            className="rounded-2xl border border-[#39FF14]/20 p-4 sm:p-5 flex items-center gap-4"
            style={{ background: "rgba(57,255,20,0.04)" }}
            data-testid="competition-reward-banner"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(57,255,20,0.12)" }}
            >
              <Star className="w-5 h-5 text-[#39FF14]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Win a Battle = 1 Month Free</p>
              <p className="text-[11px] text-[#5C5C6B] mt-0.5 leading-snug">
                Top-voted cover each week earns a free month of any Pro tier. Keep competing!
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Reusable Tier Card ────────────────────────── */
function TierCard({ tier, selecting, currentTierKey, onSelect }) {
  const Icon = TIER_ICONS[tier.key] || Zap;
  const colors = TIER_COLORS[tier.key] || TIER_COLORS.individual;
  const isCurrent = currentTierKey === tier.key;

  return (
    <div
      className="rounded-2xl border border-white/5 p-4 flex flex-col justify-between transition-all hover:border-white/10"
      style={{ background: colors.bg }}
      data-testid={`tier-card-${tier.key}`}
    >
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${colors.ring}20` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color: colors.ring }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{tier.name}</p>
            <p className="text-[10px] text-[#5C5C6B]">{tier.tagline}</p>
          </div>
        </div>

        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-['Outfit'] font-black text-white">
            ${tier.price.toFixed(2)}
          </span>
          <span className="text-[10px] text-[#5C5C6B]">/ mo</span>
        </div>

        <ul className="space-y-1.5 mb-4">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs text-[#A0A0B0]">
              <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: colors.ring }} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <Button
        onClick={() => onSelect(tier.key)}
        disabled={selecting === tier.key || isCurrent}
        className="w-full h-9 rounded-xl text-xs font-bold transition-all"
        style={{
          background: isCurrent ? "rgba(57,255,20,0.15)" : `${colors.ring}18`,
          color: isCurrent ? "#39FF14" : colors.ring,
          border: `1px solid ${isCurrent ? "rgba(57,255,20,0.3)" : `${colors.ring}30`}`,
        }}
        data-testid={`tier-select-${tier.key}`}
      >
        {isCurrent ? "Current Plan" : selecting === tier.key ? "Processing..." : "Choose Plan"}
      </Button>
    </div>
  );
}
