import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY in server environment.");
  }
  return new Stripe(secretKey);
}

export type ServiceType = "analysis" | "audit" | "browser" | "real_markets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tier,
      serviceType = "analysis",
      assetId,
      symbol,
      contractAddress,
      locale = "pl",
      isPopup = true,
    } = body;

    if (!tier || (tier !== "pro" && tier !== "advanced")) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy poziom (wymagane 'pro' lub 'advanced')." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const isPro = tier === "pro";

    // Determine pricing and descriptions per service
    let unitAmount = 1499; // default 14.99 EUR
    let productName = "";
    let productDescription = "";

    if (serviceType === "audit") {
      unitAmount = isPro ? 7999 : 39999; // 79.99 EUR or 399.99 EUR
      productName = isPro
        ? `Velmère Security — Audyt Smart Kontraktu Pro (${symbol || contractAddress?.slice(0, 10) || "EVM"})`
        : `Velmère Security — Audyt Smart Kontraktu Advanced (${symbol || contractAddress?.slice(0, 10) || "EVM"})`;
      productDescription = isPro
        ? `Automatyczny audyt dekompilacji EVM, analiza SWC/CWE, OWASP Top 10 SC, detekcja honeypot/backdoor i raport PDF 1.7.`
        : `Kompleksowa dekompilacja bajtokodu, dowody formalne niezmienników, PoC exploit scenarios, pieczęć kryptograficzna SHA-256 i certyfikat RFC 3161.`;
    } else if (serviceType === "browser") {
      unitAmount = isPro ? 1999 : 19999; // 19.99 EUR or 199.99 EUR
      productName = isPro
        ? `Velmère Lens & Browser — Raport Wywiadowczy Pro`
        : `Velmère Lens & Browser — Raport Wywiadowczy Advanced & PDF Forge`;
      productDescription = isPro
        ? `Dostęp do pełnego korpusu dowodowego, wskaźników zaufania i eksportu analitycznego Pro.`
        : `Instytucjonalny silnik PDF Forge A4, wieloźródłowy dowód kryptograficzny i pełna telemetria Advanced.`;
    } else {
      // Default: analysis or real_markets
      unitAmount = isPro ? 1499 : 14999; // 14.99 EUR or 149.99 EUR
      productName = isPro
        ? `Velmère Market Integrity — Analiza Pro (${symbol || "Asset"})`
        : `Velmère Market Integrity — Analiza Advanced (${symbol || "Asset"})`;
      productDescription = isPro
        ? `Pakiet 14 sygnałów dowodowych, arkusze głębokości L3 ±2%, radar wielorybów on-chain oraz audyt slippage dla ${symbol || "aktywa"}.`
        : `Instytucjonalny pakiet 20 sygnałów, formalna dekompilacja smart kontraktu, audyt honeypot/backdoor, modele AI oraz certyfikat RFC 3161 dla ${symbol || "aktywa"}.`;
    }

    // Determine URLs
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const origin = req.headers.get("origin") || `${protocol}://${host}`;

    const cleanAssetId = assetId || "bitcoin";

    let successUrl = "";
    let cancelUrl = "";

    if (isPopup) {
      successUrl = `${origin}/${locale}/checkout/stripe-popup-callback?status=success&tier=${tier}&serviceType=${serviceType}&session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${origin}/${locale}/checkout/stripe-popup-callback?status=cancelled&tier=${tier}&serviceType=${serviceType}`;
    } else {
      if (serviceType === "audit") {
        successUrl = `${origin}/${locale}/security?payment=success&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${origin}/${locale}/security?payment=cancelled&tier=${tier}`;
      } else if (serviceType === "browser") {
        successUrl = `${origin}/${locale}/search?payment=success&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${origin}/${locale}/search?payment=cancelled&tier=${tier}`;
      } else {
        const basePath = serviceType === "real_markets" ? "real-markets" : "shield";
        successUrl = `${origin}/${locale}/${basePath}/assets/${cleanAssetId}?payment=success&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${origin}/${locale}/${basePath}/assets/${cleanAssetId}?payment=cancelled&tier=${tier}`;
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        tier,
        serviceType,
        assetId: cleanAssetId,
        symbol: symbol || "ASSET",
        contractAddress: contractAddress || "",
        platform: "Velmère RegTech & Security Assurance",
        environment: process.env.NODE_ENV || "development",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe nie zwrócił adresu URL sesji płatności.");
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      tier,
      serviceType,
      amount: unitAmount / 100,
      currency: "EUR",
    });
  } catch (err: unknown) {
    console.error("[STRIPE_CHECKOUT_ERROR]:", err);
    const errorMessage = err instanceof Error ? err.message : "Nieoczekiwany błąd sesji płatności Stripe.";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "Brak parametru sessionId." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      ok: true,
      paid: session.payment_status === "paid",
      status: session.status,
      tier: session.metadata?.tier || "pro",
      serviceType: session.metadata?.serviceType || "analysis",
      assetId: session.metadata?.assetId || "bitcoin",
      customerEmail: session.customer_details?.email,
    });
  } catch (err: unknown) {
    console.error("[STRIPE_VERIFY_ERROR]:", err);
    const errorMessage = err instanceof Error ? err.message : "Błąd weryfikacji sesji Stripe.";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
