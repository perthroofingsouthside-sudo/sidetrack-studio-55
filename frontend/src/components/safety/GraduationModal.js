/* GraduationModal — guardian-approved move from Gamer (Grommet) to Creator.
   Flow: grommet requests → PIN issued → guardian enters PIN → graduated. */
import { useState, useRef } from "react";
import { GraduationCap, ShieldCheck, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function GraduationModal({ open, onClose, onGraduated }) {
  const [step, setStep] = useState("intro"); // intro | pin | done
  const [guardianCode, setGuardianCode] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [busy, setBusy] = useState(false);
  const userId = useRef((() => {
    let id = localStorage.getItem("sidetrack_voter_id");
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("sidetrack_voter_id", id);
    }
    return id;
  })());

  if (!open) return null;

  const requestGraduation = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/safety/graduation/request`, { user_id: userId.current });
      if (res.data.status === "already_graduated") {
        onGraduated();
        return;
      }
      setGuardianCode(res.data.guardian_code);
      setStep("pin");
    } catch {
      toast.error("Couldn't start graduation — try again");
    } finally { setBusy(false); }
  };

  const approve = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/safety/graduation/approve`, { user_id: userId.current, code: pinInput.trim() });
      setStep("done");
      setTimeout(() => onGraduated(), 1400);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Incorrect PIN");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(4,4,6,0.9)", backdropFilter: "blur(12px)" }} data-testid="graduation-modal">
      <div className="skeu-panel w-full max-w-sm p-6 rounded-3xl relative">
        <button onClick={onClose} data-testid="graduation-close"
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-[#5C5C6B] hover:text-white">
          <X className="w-4 h-4" />
        </button>

        {step === "intro" && (
          <div className="text-center">
            <GraduationCap className="w-10 h-10 text-[#FF5F1F] mx-auto mb-3" style={{ filter: "drop-shadow(0 0 14px rgba(255,95,31,0.5))" }} />
            <h3 className="font-['Outfit'] text-xl font-black text-white">Level Up to Creator</h3>
            <p className="text-[11px] text-[#A0A0B0] mt-2 leading-snug">
              Creator mode unlocks social posting, rap battles & peer ratings — it&rsquo;s built for 18+.
              A guardian needs to approve your graduation.
            </p>
            <Button onClick={requestGraduation} disabled={busy} data-testid="graduation-request-btn"
              className="mt-4 w-full h-11 rounded-xl bg-[#FF5F1F] hover:bg-[#FF7A42] text-white font-black text-xs uppercase tracking-wider">
              Get Guardian PIN
            </Button>
          </div>
        )}

        {step === "pin" && (
          <div className="text-center">
            <KeyRound className="w-9 h-9 text-[#39FF14] mx-auto mb-3" style={{ filter: "drop-shadow(0 0 14px rgba(57,255,20,0.5))" }} />
            <h3 className="font-['Outfit'] text-lg font-black text-white">Hand to your guardian</h3>
            <div className="skeu-screen mt-3 py-3 px-4">
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-black mb-1">Guardian PIN</p>
              <p className="font-mono text-3xl font-black text-[#39FF14] tracking-[0.4em]" data-testid="guardian-pin-display"
                style={{ textShadow: "0 0 16px rgba(57,255,20,0.6)" }}>{guardianCode}</p>
            </div>
            <p className="text-[10px] text-[#5C5C6B] mt-3 leading-snug">
              Guardian: by entering this PIN you approve this player&rsquo;s move to the 18+ Creator ecosystem.
            </p>
            <Input value={pinInput} onChange={(e) => setPinInput(e.target.value)} maxLength={4}
              placeholder="Guardian enters PIN"
              className="mt-3 h-11 bg-[#0A0A0D] border-white/10 text-center font-mono text-lg tracking-[0.3em] rounded-xl"
              data-testid="guardian-pin-input" />
            <Button onClick={approve} disabled={busy || pinInput.trim().length !== 4} data-testid="graduation-approve-btn"
              className="mt-3 w-full h-11 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-black text-xs uppercase tracking-wider">
              Approve Graduation
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4" data-testid="graduation-done">
            <ShieldCheck className="w-12 h-12 text-[#39FF14] mx-auto mb-3" style={{ filter: "drop-shadow(0 0 18px rgba(57,255,20,0.6))" }} />
            <h3 className="font-['Outfit'] text-xl font-black text-white">Graduated!</h3>
            <p className="text-[11px] text-[#A0A0B0] mt-1">Creator mode unlocked. Welcome to the full ecosystem.</p>
          </div>
        )}
      </div>
    </div>
  );
}
