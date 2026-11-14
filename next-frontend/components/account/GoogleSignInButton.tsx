"use client";

import { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/lib/auth/api";

type GoogleSignInButtonProps = {
  mode: "login" | "register";
  onSuccessUser: (user: AuthUser) => void;
  onError: (message: string) => void;
};

function GoogleButtonInner({ mode, onSuccessUser, onError }: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [isPending, setIsPending] = useState(false);

  async function handleSuccess(response: CredentialResponse) {
    if (!response.credential) {
      onError("Google did not return a sign-in credential. Please try again.");
      return;
    }

    setIsPending(true);
    try {
      const user = await loginWithGoogle(response.credential);
      onSuccessUser(user);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={`mb-6 flex w-full justify-center ${isPending ? "pointer-events-none opacity-60" : ""}`}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError("Google sign-in was cancelled or failed. Please try again.")}
        text={mode === "register" ? "signup_with" : "continue_with"}
        shape="rectangular"
        theme="outline"
        size="large"
        width="380"
      />
    </div>
  );
}

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Sign-In"
        className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {props.mode === "register" ? "Sign up with Google" : "Continue with Google"}
        <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
          Setup needed
        </span>
      </button>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleButtonInner {...props} />
    </GoogleOAuthProvider>
  );
}

