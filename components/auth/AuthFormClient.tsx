"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import Image from "next/image";
import { Link } from "@/navigation";
import { useLocale } from "next-intl";
import { completeVelmerePasswordRecovery, createVelmereAccountSession, requestVelmerePasswordRecovery, startVelmereGoogleOAuth, VelmereAuthConfirmationRequiredError } from "@/components/auth/AuthGate";
import { useWalletConnect } from "@/lib/wallet/useWalletConnect";
import { useWalletUiStore } from "@/store/useWalletUiStore";

type AuthFormClientProps = {
  labels?: {
    email?: string;
    password?: string;
    signIn?: string;
    privateAccount?: string;
    title?: string;
    body?: string;
    googlePreview?: string;
    notLive?: string;
    emailAccess?: string;
    createAccount?: string;
    alreadyHave?: string;
    forgotPassword?: string;
    returnHome?: string;
    previewNotice?: string;
    minimumPassword?: string;
    emailError?: string;
    passwordError?: string;
    walletRequired?: string;
    trustLine?: string;
    trustCards?: readonly (readonly [string, string])[];
  };
};

const localCopy = {
  pl: {
    signInTab: "Logowanie",
    createTab: "Nowe konto",
    continueWithGoogle: "Kontynuuj przez Google",
    signUpWithGoogle: "Zarejestruj się przez Google",
    orWithEmail: "lub przez e-mail",
    previewBody: "Zobacz prywatną warstwę bez łączenia portfela.",
    optionalWallet: "Logowanie portfelami Web3",
    walletBody: "Połącz portfel tylko wtedy, gdy chcesz korzystać z funkcji Web3.",
    showPassword: "Pokaż hasło",
    hidePassword: "Ukryj hasło",
    resetMessage: "Odzyskiwanie hasła będzie prowadzone bezpieczną wiadomością e-mail. Na tym etapie skontaktuj się z obsługą Velmère.",
    privacy: "Nigdy nie prosimy o seed phrase ani klucz prywatny.",
    createTitle: "Nowe konto.",
    createBody: "Spokojna rejestracja konta. Portfel opcjonalny. Bez seed phrases.",
    alreadyHaveAccount: "Masz już konto? Zaloguj się",
  },
  de: {
    signInTab: "Anmelden",
    createTab: "Neues Konto",
    continueWithGoogle: "Mit Google fortfahren",
    signUpWithGoogle: "Mit Google registrieren",
    orWithEmail: "oder mit E-Mail",
    previewBody: "Entdecke den privaten Bereich, ohne ein Wallet zu verbinden.",
    optionalWallet: "Web3-Wallet-Anmeldung",
    walletBody: "Verbinde es nur, wenn du Web3-Funktionen nutzen möchtest.",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort ausblenden",
    resetMessage: "Die Passwort-Wiederherstellung erfolgt über eine sichere E-Mail. Kontaktiere in dieser Vorschau den Velmère Support.",
    privacy: "Wir fragen niemals nach Seed Phrase oder Private Key.",
    createTitle: "Neues Konto.",
    createBody: "Ruhige Registrierung. Wallet optional. Keine Seed Phrases.",
    alreadyHaveAccount: "Schon ein Konto? Anmelden",
  },
  en: {
    signInTab: "Sign in",
    createTab: "New account",
    continueWithGoogle: "Continue with Google",
    signUpWithGoogle: "Sign up with Google",
    orWithEmail: "or with email",
    previewBody: "Explore the private layer without connecting a wallet.",
    optionalWallet: "Web3 Wallet Access",
    walletBody: "Connect only when you want to use Web3 features.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    resetMessage: "Password recovery will use a secure email. During this preview, contact Velmère support for account help.",
    privacy: "We never ask for a seed phrase or private key.",
    createTitle: "New account.",
    createBody: "Quiet account registration. Wallet optional. No seed phrases.",
    alreadyHaveAccount: "Already have an account? Sign in",
  },
} as const;

const authErrorMessages = {
  pl: {
    oauth_cancelled: "Logowanie przez Google zostało anulowane przez użytkownika.",
    callback_rejected: "Weryfikacja autoryzacji Google nie powiodła się. Spróbuj ponownie.",
    flow_state_invalid: "Sesja logowania Google wygasła. Spróbuj ponownie.",
    flow_identity_mismatch: "Niezgodność tożsamości konta Google.",
    missing_oauth_config: "Dostawca Google OAuth nie jest jeszcze aktywny w konfiguracji Supabase.",
    auth_config_unavailable: "Logowanie Google nie jest obecnie aktywne (brak konfiguracji dostawcy w Supabase). Użyj logowania e-mail.",
    session_family_inactive: "Twoja poprzednia sesja wygasła. Zaloguj się ponownie.",
    default: "Wystąpił błąd autoryzacji. Spróbuj ponownie lub zaloguj się e-mailem.",
  },
  en: {
    oauth_cancelled: "Google sign-in was cancelled by user.",
    callback_rejected: "Google authentication verification failed. Please try again.",
    flow_state_invalid: "Google authorization session expired. Please try again.",
    flow_identity_mismatch: "Google account identity mismatch.",
    missing_oauth_config: "Google OAuth provider is not active in Supabase configuration.",
    auth_config_unavailable: "Google sign-in is currently unavailable (provider not configured in Supabase). Please use email sign-in.",
    session_family_inactive: "Your previous session has expired. Please sign in again.",
    default: "An authentication error occurred. Please try again or use email sign-in.",
  },
  de: {
    oauth_cancelled: "Die Google-Anmeldung wurde vom Benutzer abgebrochen.",
    callback_rejected: "Google-Authentifizierungsprüfung fehlgeschlagen. Bitte erneut versuchen.",
    flow_state_invalid: "Google-Autorisierungssitzung abgelaufen. Bitte erneut versuchen.",
    flow_identity_mismatch: "Google-Kontoidentitätsabweichung.",
    missing_oauth_config: "Google OAuth-Provider ist in der Supabase-Konfiguration nicht aktiv.",
    auth_config_unavailable: "Google-Anmeldung ist derzeit nicht verfügbar (Provider in Supabase nicht konfiguriert). Bitte E-Mail nutzen.",
    session_family_inactive: "Ihre vorherige Sitzung ist abgelaufen. Bitte erneut anmelden.",
    default: "Authentifizierungsfehler aufgetreten. Bitte erneut versuchen oder E-Mail nutzen.",
  },
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl border border-velmere-danger/[0.24] bg-velmere-danger/[0.08] px-4 py-3 text-xs leading-6 text-red-100/[0.88]">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" aria-hidden="true" />
      {children}
    </p>
  );
}

function displayNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Velmère Member";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 32) || "Velmère Member";
}

function WalletButton({ icon, title, body, onClick, disabled }: { icon: string; title: string; body: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0c0e12] px-3 text-left transition-all hover:border-cyan-200/[0.22] hover:bg-cyan-300/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035]">
        <Image src={icon} alt="" width={16} height={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-white/[0.80]">{title}</span>
        <span className="block truncate text-[10px] text-white/[0.38]">{body}</span>
      </span>
    </button>
  );
}

export default function AuthFormClient({ labels }: AuthFormClientProps) {
  const locale = useLocale() as keyof typeof localCopy;
  const searchParams = useSearchParams();
  const recoveryMode = searchParams.get("recovery") === "1";
  const local = localCopy[locale] ?? localCopy.en;
  const accountHref = `/${locale || "pl"}/account`;
  const goToAccount = () => { window.location.assign(accountHref); };
  const wallet = useWalletConnect();
  const walletUi = useWalletUiStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [error, setError] = useState<string | null>(null);
  const [devNotice, setDevNotice] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailLabel = labels?.email ?? "Email";
  const passwordLabel = labels?.password ?? "Password";

  useEffect(() => {
    const authErrorCode = searchParams.get("auth_error");
    if (authErrorCode) {
      const msgs = authErrorMessages[locale] ?? authErrorMessages.en;
      const msg = msgs[authErrorCode as keyof typeof msgs] ?? msgs.default;
      setError(msg);
    }
  }, [searchParams, locale]);

  const validate = () => {
    if (!recoveryMode && (!email.includes("@") || email.length < 6)) return labels?.emailError ?? "Enter a valid email address.";
    if (password.length < (recoveryMode ? 10 : 8)) return recoveryMode ? "New password must contain at least 10 characters." : labels?.passwordError ?? "Password must contain at least 8 characters.";
    return null;
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    void (async () => {
      try {
        if (recoveryMode) {
          await completeVelmerePasswordRecovery(password);
        } else {
          await createVelmereAccountSession({
            provider: "email",
            mode,
            password,
            displayName: displayNameFromEmail(email),
            email,
            locale: locale === "pl" || locale === "de" ? locale : "en",
          });
        }
        goToAccount();
      } catch (caught) {
        setError(caught instanceof VelmereAuthConfirmationRequiredError
          ? "Check your email and confirm the account before signing in."
          : mode === "create"
            ? "Unable to create the account. Check the details or try signing in."
            : "Unable to sign in. Check the email and password.");
      } finally {
        setLoading(false);
      }
    })();
  };

  const continueAsPreview = () => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await createVelmereAccountSession({ provider: "preview", displayName: "Velmère Preview" });
        goToAccount();
      } catch {
        setError("Member preview is unavailable. Try again after the account service is restored.");
      } finally {
        setLoading(false);
      }
    })();
  };

  const continueWithGoogle = async () => {
    setLoading(true);
    setError(null);
    setDevNotice(null);
    try {
      await startVelmereGoogleOAuth(locale);
    } catch (caught: unknown) {
      const isProduction = process.env.NODE_ENV === "production";
      const code = caught instanceof Error ? caught.message : String(caught);
      if (code === "auth_config_unavailable" || code === "missing_oauth_config" || code === "google_oauth_start_failed") {
        if (!isProduction) {
          setDevNotice({
            message: locale === "pl"
              ? "Google OAuth nie jest jeszcze aktywny w konfiguracji Supabase. W środowisku developerskim możesz uruchomić jawny tryb symulacji:"
              : locale === "de"
              ? "Google OAuth ist in der Supabase-Konfiguration noch nicht aktiviert. Im Entwicklungsmodus können Sie die explizite Vorschau starten:"
              : "Google OAuth is not enabled in Supabase yet. In development mode, you can start the explicit preview mode:",
          });
        } else {
          setError(
            locale === "pl"
              ? "Logowanie przez Google jest obecnie niedostępne (brak aktywnego dostawcy Google OAuth w Supabase). Użyj logowania e-mail."
              : locale === "de"
              ? "Google-Anmeldung ist derzeit nicht verfügbar (Google OAuth in Supabase nicht aktiv). Bitte E-Mail nutzen."
              : "Google sign-in is currently unavailable (Google OAuth not active in Supabase). Please use email sign-in."
          );
        }
      } else {
        setError(
          locale === "pl"
            ? "Wystąpił błąd podczas logowania przez Google. Spróbuj ponownie lub zaloguj się e-mailem."
            : locale === "de"
            ? "Fehler bei der Google-Anmeldung. Bitte erneut versuchen oder E-Mail nutzen."
            : "An error occurred during Google sign-in. Please try again or use email sign-in."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerDevGoogleFallback = async () => {
    setLoading(true);
    setError(null);
    setDevNotice(null);
    try {
      await createVelmereAccountSession({
        locale: locale === "pl" || locale === "de" ? locale : "en",
        provider: "google_preview",
        email: "member.google.preview@velmere.dev",
        displayName: "Google Preview Member [DEV]",
      });
      goToAccount();
    } catch {
      setError("Dev preview is currently unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const isCreate = mode === "create";
  const currentTitle = isCreate
    ? (labels?.createAccount ? `${labels.createAccount}.` : local.createTitle)
    : (labels?.title ?? "Sign in.");
  const currentBody = isCreate
    ? local.createBody
    : (labels?.body ?? "Account first. Wallet optional. No seed phrases.");

  return (
    <section className="velmere-command-shell w-full relative flex flex-col justify-between rounded-[1.75rem] border border-white/[0.09] bg-[#07090c] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] min-h-[520px] lg:min-h-[580px] h-full" data-pass2005-auth-form="solid-cyan-focus-no-heavy-blur">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/[0.03] blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-col justify-between h-full">
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="velmere-label text-cyan-100/[0.78]">{labels?.privateAccount ?? "Private account"}</p>
              <h2 className="mt-1 font-serif text-2xl md:text-3xl leading-tight text-white">
                {currentTitle}
              </h2>
              <p className="mt-1 text-xs text-velmere-muted leading-relaxed">
                {currentBody}
              </p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/[0.16] bg-cyan-300/[0.055] text-cyan-100">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>

          {/* Luxury Tab Switcher (No plastic buttons!) */}
          <div
            className="mt-3.5 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-black/[0.35] p-1"
            role="tablist"
            aria-label={labels?.privateAccount ?? "Account access"}
          >
            <button
              type="button"
              id="auth-tab-signin"
              role="tab"
              aria-selected={mode === "signin"}
              aria-controls="auth-access-panel"
              tabIndex={mode === "signin" ? 0 : -1}
              onClick={() => { setMode("signin"); setError(null); }}
              className={`min-h-[34px] rounded-lg text-xs font-semibold tracking-wide transition-all ${
                mode === "signin"
                  ? "border border-white/[0.18] bg-white/[0.12] text-white shadow-sm"
                  : "text-white/[0.44] hover:text-white"
              }`}
            >
              {local.signInTab}
            </button>
            <button
              type="button"
              id="auth-tab-create"
              role="tab"
              aria-selected={mode === "create"}
              aria-controls="auth-access-panel"
              tabIndex={mode === "create" ? 0 : -1}
              onClick={() => { setMode("create"); setError(null); }}
              className={`min-h-[34px] rounded-lg text-xs font-semibold tracking-wide transition-all ${
                mode === "create"
                  ? "border border-white/[0.18] bg-white/[0.12] text-white shadow-sm"
                  : "text-white/[0.44] hover:text-white"
              }`}
            >
              {local.createTab}
            </button>
          </div>

          {/* Primary Google OAuth Access */}
          <div className="mt-3">
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 font-medium text-xs text-white/[0.92] shadow-sm transition hover:border-cyan-200/[0.30] hover:bg-white/[0.08] active:scale-[0.99] disabled:opacity-50"
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span>
                {mode === "create" ? local.signUpWithGoogle : local.continueWithGoogle}
              </span>
            </button>
            {devNotice ? (
              <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-xs text-amber-200" data-testid="auth-dev-fallback-notice">
                <p className="leading-relaxed text-[11px]">{devNotice.message}</p>
                <button
                  type="button"
                  onClick={triggerDevGoogleFallback}
                  disabled={loading}
                  className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/20 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/30 active:scale-[0.98] transition disabled:opacity-40"
                >
                  <span>[DEV FALLBACK] Podgląd konta Google</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative my-2.5 flex items-center justify-center">
            <div className="w-full border-t border-white/[0.08]" />
            <span className="absolute bg-[#07090c] px-2 text-[10px] uppercase tracking-wider text-white/[0.35]">
              {local.orWithEmail}
            </span>
          </div>

          {/* Form */}
          <form
            id="auth-access-panel"
            role="tabpanel"
            aria-labelledby={`auth-tab-${mode}`}
            onSubmit={submit}
            noValidate
            className="space-y-2"
          >
            <div>
              <input
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(null); }}
                type="email"
                autoComplete="email"
                placeholder={emailLabel}
                className="w-full rounded-xl border border-white/[0.09] bg-black/[0.38] px-3.5 py-2 text-xs text-white placeholder:text-white/[0.30] focus:border-cyan-200/40 focus:outline-none"
              />
            </div>

            <div className="relative">
              <input
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(null); }}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                placeholder={labels?.minimumPassword ?? passwordLabel}
                className="w-full rounded-xl border border-white/[0.09] bg-black/[0.38] px-3.5 py-2 pr-10 text-xs text-white placeholder:text-white/[0.30] focus:border-cyan-200/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/[0.34] transition hover:text-white"
                aria-label={showPassword ? local.hidePassword : local.showPassword}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            </div>

            <FieldError>{error ?? undefined}</FieldError>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d4af37]/[0.45] bg-[#d4af37]/[0.15] text-[#f5ecd5] font-semibold text-xs uppercase tracking-wider transition hover:bg-[#d4af37]/[0.25] active:scale-[0.99] disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : mode === "create" ? <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> : <LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
              {recoveryMode ? "Set new password" : mode === "create" ? labels?.createAccount ?? "Create account" : labels?.signIn ?? "Sign in"}
            </button>
          </form>

          {/* Forgot password / Mode switch */}
          <div className="mt-1.5 flex justify-end">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => {
                  if (!email.includes("@")) { setError(labels?.emailError ?? "Enter a valid email address."); return; }
                  setLoading(true);
                  setError(null);
                  void requestVelmerePasswordRecovery(email, locale)
                    .then((message) => setError(message))
                    .catch(() => setError(local.resetMessage))
                    .finally(() => setLoading(false));
                }}
                className="text-[11px] text-white/[0.38] transition hover:text-cyan-100"
              >
                {labels?.forgotPassword ?? "Forgot password?"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-[11px] text-white/[0.38] transition hover:text-cyan-100"
              >
                {local.alreadyHaveAccount}
              </button>
            )}
          </div>

          {/* Mode create: optional wallet ("logowanie portfelami") */}
          {mode === "create" ? (
            <div className="mt-2.5 rounded-xl border border-white/[0.08] bg-[#080b0f] p-2.5 shadow-inner" data-pass2005-auth-wallet-panel="solid-no-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
                  <p className="text-xs font-medium text-white/[0.85]">{local.optionalWallet}</p>
                </div>
                <span className="rounded border border-cyan-400/[0.2] bg-cyan-400/[0.06] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-cyan-200/[0.85]">
                  Web3
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/[0.42] leading-relaxed">
                {local.walletBody}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <WalletButton
                  icon="/wallets/metamask.svg"
                  title="MetaMask"
                  body={walletUi.connected && walletUi.chainType === "evm" ? walletUi.shortAddress : "EVM"}
                  disabled={walletUi.connected && walletUi.chainType === "solana"}
                  onClick={() => void wallet.connectMetaMask()}
                />
                <WalletButton
                  icon="/wallets/phantom.svg"
                  title="Phantom"
                  body={walletUi.connected && walletUi.chainType === "solana" ? walletUi.shortAddress : "Solana"}
                  disabled={walletUi.connected && walletUi.chainType === "evm"}
                  onClick={() => void wallet.connectPhantom()}
                />
              </div>
            </div>
          ) : null}

          {/* Quick Preview Links */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={continueAsPreview}
              disabled={loading}
              className="flex h-8 w-full items-center justify-between rounded-xl border border-white/[0.06] bg-black/[0.22] px-3 text-left transition hover:border-cyan-200/[0.18] hover:bg-cyan-300/[0.025] disabled:opacity-50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3 w-3 shrink-0 text-cyan-200/[0.7]" aria-hidden="true" />
                <span className="truncate text-[11px] font-medium text-white/[0.60]">{labels?.googlePreview ?? "Podgląd strefy członkowskiej"}</span>
              </span>
              <span className="rounded-full border border-white/[0.07] px-1.5 py-0.2 font-mono text-[7px] uppercase tracking-[0.1em] text-white/[0.28]">
                Preview
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
