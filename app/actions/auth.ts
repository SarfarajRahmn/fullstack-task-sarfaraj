"use server";

import { auth } from "@/lib/auth";
import { signInSchema, signUpSchema } from "@/lib/validations";
import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface AuthState {
  error: string | null;
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const payload = {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };

  const parsed = signUpSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors["confirmPassword"]?.[0] ??
        parsed.error.flatten().fieldErrors.email?.[0] ??
        "Please check the form values and try again.",
    };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: `${parsed.data.firstName} ${parsed.data.lastName}`,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  redirect("/feed");
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const payload = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = signInSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors.email?.[0] ??
        "Please enter a valid email and password.",
    };
  }

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  redirect("/feed");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    return error.message || "Authentication failed. Please try again.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
