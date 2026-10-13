"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { messages } from "@/lib/messages";
import { safeNextPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; success?: string; email?: string };

const e = messages.auth.errors;
const emailSchema = z.email(e.invalidEmail);

function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return e.invalidCredentials;
    case "email_not_confirmed":
      return e.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
      return e.userExists;
    case "weak_password":
      return e.weakPassword;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return e.rateLimited;
    default:
      return e.unknown;
  }
}

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!emailSchema.safeParse(email).success) return { error: e.invalidEmail, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.code), email };

  redirect(next);
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!emailSchema.safeParse(email).success) return { error: e.invalidEmail, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Self-registration is allowed, also via a magic link.
    options: { shouldCreateUser: true, emailRedirectTo: callbackUrl(next) },
  });
  if (error) return { error: authErrorMessage(error.code), email };

  return { success: messages.auth.magicLinkSent, email };
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: e.fullNameRequired, email };
  if (!emailSchema.safeParse(email).success) return { error: e.invalidEmail, email };
  if (password.length < 8) return { error: e.weakPassword, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: callbackUrl("/teams") },
  });
  if (error) return { error: authErrorMessage(error.code), email };

  // Email confirmation off (e.g. local): logged in immediately.
  if (data.session) redirect("/teams");
  return { success: messages.auth.signupCheckEmail, email };
}
