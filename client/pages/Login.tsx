import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCurrentUser, useProfili } from "../lib/useUser";
import {
  Mail,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertTriangle,
  User,
  Crown,
  BookOpen,
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { toast } from "sonner";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loginEmailMutation, oauthLoginMutation } = useCurrentUser();
  const { profili = [] } = useProfili();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  // Se l'utente è già loggato, reindirizza
  useEffect(() => {
    if (user) {
      navigate(user.ruolo === "manager" ? "/manager/calendario" : "/");
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  // 1. Invio Richiesta OTP via Email (Opzione A)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Inserisci un indirizzo email valido.");
      return;
    }

    try {
      const res = await loginEmailMutation.mutateAsync({
        email,
        requestOtpOnly: true,
      });
      setGeneratedOtp(res.demoOtp || "464646");
      setStep("otp");
      toast.success(res.messaggio || "Codice di verifica generato!");
    } catch (err: any) {
      toast.error(err.message || "Errore nella richiesta del codice.");
    }
  };

  // 2. Verifica OTP ed Entrata (Opzione A)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      toast.error("Inserisci il codice di verifica a 6 cifre.");
      return;
    }

    try {
      const res = await loginEmailMutation.mutateAsync({
        email,
        code: otpCode,
      });
      if (res.user) {
        navigate(res.user.ruolo === "manager" ? "/manager/calendario" : "/");
      }
    } catch (err: any) {
      toast.error(err.message || "Codice non valido o scaduto.");
    }
  };

  // 3. Social Login (Opzione C: Google / Apple)
  const handleSocialLogin = async (provider: "google" | "apple", demoEmail?: string, demoName?: string) => {
    try {
      const emailToUse =
        demoEmail ||
        (email.trim()
          ? email.trim().toLowerCase()
          : provider === "google"
          ? "firenzepersonaltrainer@gmail.com"
          : "daniele.casci@gmail.com");
      const nameToUse =
        demoName ||
        (emailToUse === "firenzepersonaltrainer@gmail.com"
          ? "Stefano Tronconi"
          : emailToUse.split("@")[0]);
      const res = await oauthLoginMutation.mutateAsync({
        provider,
        email: emailToUse,
        name: nameToUse,
      });
      if (res.user) {
        navigate(res.user.ruolo === "manager" ? "/manager/calendario" : "/");
      }
    } catch (err: any) {
      toast.error(err.message || "Accesso social non riuscito.");
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center px-4 py-8 max-w-sm mx-auto">
      {/* BRAND & LOGO */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <img
            src="/logo-area46-transparent.png"
            alt="Area46 Landmine Lab"
            className="h-24 w-auto object-contain drop-shadow-md"
          />
        </div>
        <h1 className="text-xl font-black text-zinc-900 tracking-tight">
          Area46 Landmine Lab
        </h1>
        <p className="text-xs font-semibold text-zinc-500 mt-1">
          Accedi al tuo diario, alle postazioni Lab e ai tuoi allenamenti.
        </p>
      </div>

      {/* BOX AUTENTICAZIONE */}
      <div className="p-5 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-4">
        {/* OPZIONE C: SOCIAL LOGIN VELOCE (GOOGLE & APPLE) */}
        <div className="space-y-2">
          {/* Tasto Google */}
          <button
            type="button"
            disabled={oauthLoginMutation.isPending}
            onClick={() => handleSocialLogin("google")}
            className="w-full h-11 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-2xs cursor-pointer"
          >
            {/* SVG Logo Google */}
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continua con Google</span>
          </button>

          {/* Tasto Apple */}
          <button
            type="button"
            disabled={oauthLoginMutation.isPending}
            onClick={() => handleSocialLogin("apple")}
            className="w-full h-11 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-2xs cursor-pointer"
          >
            {/* SVG Logo Apple */}
            <svg className="size-4 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1 .08 2.02-.49 2.64-1.24z" />
            </svg>
            <span>Continua con Apple</span>
          </button>
        </div>

        {/* DIVISORE PULITO STILE GOOGLE */}
        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-zinc-200 w-full" />
          <span className="bg-white px-2.5 text-[10px] uppercase font-bold text-zinc-400 shrink-0">
            oppure tramite email
          </span>
        </div>

        {/* OPZIONE A: EMAIL + CODICE OTP */}
        {step === "email" ? (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700 block">
                Email Utente
              </label>
              <Input
                type="email"
                placeholder="nome@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={loginEmailMutation.isPending}
              className="w-full h-11 rounded-xl bg-[#1c00ff] hover:bg-[#1600cc] text-white font-black text-xs"
            >
              {loginEmailMutation.isPending ? "Invio in corso..." : "Ricevi Codice di Accesso (OTP) →"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px]">
              Abbiamo generato il tuo codice per <strong>{email}</strong>.
              {generatedOtp && (
                <div className="mt-1 font-mono font-bold text-xs text-[#1c00ff]">
                  Codice Demo di verifica: {generatedOtp}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700 block">
                Inserisci il Codice a 6 Cifre
              </label>
              <Input
                type="text"
                placeholder="464646"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                required
                className="h-11 rounded-xl text-center font-mono font-bold tracking-widest text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("email")}
                className="flex-1 h-11 rounded-xl text-xs"
              >
                Indietro
              </Button>
              <Button
                type="submit"
                disabled={loginEmailMutation.isPending}
                className="flex-1 h-11 rounded-xl bg-[#1c00ff] hover:bg-[#1600cc] text-white font-black text-xs"
              >
                {loginEmailMutation.isPending ? "Verifica..." : "Entra nel Lab"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ACCESSO RAPIDO TESTER / DEMO (DISCRETO E COMODO) */}
      <div className="mt-6 p-4 rounded-3xl bg-zinc-50 border border-zinc-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Accesso Rapido Tester & Gestore
          </span>
          <span className="text-[9px] bg-zinc-200 text-zinc-700 font-bold px-1.5 py-0.5 rounded">
            Fase di Test
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Coach Tronconi */}
          <button
            type="button"
            onClick={() => handleSocialLogin("google", "firenzepersonaltrainer@gmail.com", "Stefano Tronconi")}
            className="w-full p-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-left transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-zinc-900 text-[#e3ff00] flex items-center justify-center font-black text-xs">
                <ShieldCheck className="size-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900 leading-none">
                  Stefano Tronconi (Coach)
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  firenzepersonaltrainer@gmail.com
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[#1c00ff]">&rarr;</span>
          </button>

          {/* Daniele Casci (Atleta) */}
          <button
            type="button"
            onClick={() => handleSocialLogin("apple", "daniele.casci@gmail.com", "Daniele Casci")}
            className="w-full p-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-left transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-[#1c00ff]/10 text-[#1c00ff] flex items-center justify-center font-black text-xs border border-[#1c00ff]/20">
                <User className="size-3.5 text-[#1c00ff]" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900 leading-none">
                  Daniele Casci (Atleta)
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  daniele.casci@gmail.com
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[#1c00ff]">&rarr;</span>
          </button>

          {/* Roberto Sestito (Atleta) */}
          <button
            type="button"
            onClick={() => handleSocialLogin("google", "robertoilario.sestito@gmail.com", "Roberto Sestito")}
            className="w-full p-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-left transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center font-black text-xs">
                <User className="size-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900 leading-none">
                  Roberto Sestito (Atleta)
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  robertoilario.sestito@gmail.com
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[#1c00ff]">&rarr;</span>
          </button>

          {/* Altri Atleti Censiti (inclusi profili atleta creati dal coach) */}
          {profili
            .filter(
              (p) =>
                p.ruolo === "atleta" &&
                p.email !== "daniele.casci@gmail.com" &&
                p.email !== "robertoilario.sestito@gmail.com"
            )
            .map((atleta) => (
              <button
                key={atleta.id}
                type="button"
                onClick={() =>
                  handleSocialLogin(
                    "google",
                    atleta.email,
                    `${atleta.nome} ${atleta.cognome}`.trim()
                  )
                }
                className="w-full p-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-left transition-all flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs border border-emerald-200">
                    <User className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900 leading-none">
                      {atleta.nome} {atleta.cognome} (Atleta)
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {atleta.email}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#1c00ff]">&rarr;</span>
              </button>
            ))}
        </div>
      </div>

      {/* FOOTER LINK VISITATORI */}
      <div className="mt-4 text-center">
        <Link
          to="/tariffario"
          className="text-xs text-zinc-500 hover:text-[#1c00ff] underline cursor-pointer"
        >
          Non sei ancora iscritto? Esplora le Tariffe e i Pacchetti Lab &rarr;
        </Link>
      </div>
    </div>
  );
}
