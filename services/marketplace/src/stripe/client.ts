// Single Stripe SDK instance, reused everywhere — Connect onboarding today, charges/
// transfers/refunds once the membership saga lands (see payment/ once that exists).
import Stripe from "stripe";
import { env } from "../config/env";

// A placeholder key lets the app boot (and everything except Stripe calls work) even
// when unconfigured — same "don't fail startup, only the feature that needs it fails"
// pattern as Core's R2Config. A real call with this key just 401s from Stripe's side.
// No explicit apiVersion — the SDK pins the version it was built against, which avoids
// a type mismatch between that literal and whatever this package version expects.
export const stripe = new Stripe(env.stripe.secretKey || "sk_test_unconfigured");
