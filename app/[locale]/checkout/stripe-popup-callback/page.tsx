"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldCheck, XCircle, Loader2 } from "lucide-react";

export default function StripePopupCallbackPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "success";
  const tier = searchParams.get("tier") || "pro";
  const serviceType = searchParams.get("serviceType") || "analysis";
  const sessionId = searchParams.get("session_id") || "";

  const isSuccess = status === "success";
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Notify parent / opener window
    if (typeof window !== "undefined" && window.opener) {
      try {
        window.opener.postMessage(
          {
            type: isSuccess ? "VELMERE_STRIPE_PAYMENT_SUCCESS" : "VELMERE_STRIPE_PAYMENT_CANCELLED",
            tier,
            serviceType,
            sessionId,
          },
          window.location.origin
        );
      } catch (e) {
        console.warn("Could not postMessage to opener:", e);
      }

      // Auto close after brief delay for smooth visual feedback
      const timer = setTimeout(() => {
        try {
          window.close();
          setClosed(true);
        } catch (e) {
          console.warn("Could not close popup window:", e);
        }
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, tier, serviceType, sessionId]);

  const handleManualClose = () => {
    try {
      window.close();
    } catch {
      // fallback
    }
  };

  return (
    <div className="min-h-screen bg-[#061016] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0a1820]/95 p-8 shadow-2xl backdrop-blur-xl">
        {isSuccess ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Płatność Zakończona Sukcesem!
            </h1>
            <p className="text-sm text-white/70 mb-6">
              Licencja analityczna <span className="font-semibold text-emerald-400 uppercase">{tier}</span> została pomyślnie aktywowana.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-white/50 mb-6 bg-white/[0.03] py-2 px-4 rounded-lg border border-white/5 font-mono">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              <span>Przekazywanie uprawnień i zamykanie okna...</span>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <XCircle className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Płatność Anulowana
            </h1>
            <p className="text-sm text-white/70 mb-6">
              Transakcja nie została sfinalizowana. Twoje konto nie zostało obciążone.
            </p>
          </>
        )}

        <button
          onClick={handleManualClose}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider bg-white/10 hover:bg-white/15 border border-white/10 text-white transition-all"
        >
          {closed ? "Okno zamknięte" : "Zamknij to okno"}
        </button>
      </div>
    </div>
  );
}
