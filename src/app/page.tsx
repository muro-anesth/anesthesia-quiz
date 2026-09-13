"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Home() {
  useEffect(() => {
    // Wait for Firebase to restore the saved session before choosing a page.
    return onAuthStateChanged(auth, (user) => {
      window.location.replace(user ? "/quiz" : "/login");
    }, () => window.location.replace("/login"));
  }, []);
  return <p role="status" style={{ color: "#e2eaf4", textAlign: "center", padding: "40px 16px" }}>ログイン状態を確認しています…</p>;
}
