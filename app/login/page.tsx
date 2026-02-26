"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      alert("登入失敗");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
      <form
        onSubmit={submit}
        className="p-6 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3 w-80"
      >
        <div className="text-lg font-semibold">管理員登入</div>

        <input
          type="password"
          className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800"
          placeholder="輸入密碼"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button className="w-full py-2 rounded-lg bg-white text-black font-semibold">
          登入
        </button>
      </form>
    </div>
  );
}