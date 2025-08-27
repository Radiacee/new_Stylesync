"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function SignInPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // Parse hash fragment for access_token, refresh_token, etc.
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = Object.fromEntries(new URLSearchParams(hash));
      if (params.access_token && params.refresh_token) {
        // Complete sign-in with Supabase
        if (supabase) {
          supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          }).then(({ error }) => {
            if (error) {
              setStatus("Error confirming email: " + error.message);
            } else {
              setStatus("Email confirmed! Redirecting...");
              setTimeout(() => router.push("/paraphrase"), 2000);
            }
          });
        } else {
          setStatus("Supabase client not available.");
        }
      } else if (params.error) {
        setStatus("Error: " + params.error);
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Sign In</h1>
        <p className="text-gray-300 mb-6">{status || "Please check your email for a confirmation link."}</p>
      </div>
    </div>
  );
}
