"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

type Passkey = {
  id: number;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export default function PasskeyManager({
  initialPasskeys,
  required = false,
}: {
  initialPasskeys: Passkey[];
  required?: boolean;
}) {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [status, setStatus] = useState<"idle" | "registering" | "error" | "success">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus("registering");
    setError(null);

    try {
      const optionsRes = await fetch("/api/auth/admin/passkey/register/options", {
        method: "POST",
      });
      if (!optionsRes.ok) {
        throw new Error("Could not start passkey registration.");
      }
      const options = await optionsRes.json();

      const registrationResponse = await startRegistration(options);

      const verifyRes = await fetch("/api/auth/admin/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: registrationResponse,
          deviceLabel: deviceLabel.trim() || "Unnamed device",
        }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error || "Could not verify passkey.");
      }

      setPasskeys((prev) => [
        ...prev,
        {
          id: Date.now(),
          deviceLabel: deviceLabel.trim() || "Unnamed device",
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
      ]);
      setDeviceLabel("");
      setStatus("success");

      // بعد أول تسجيل ناجح، لو كانت الصفحة إجبارية، رجّع المستخدم
      // للصفحة الرئيسية بعد ثانيتين — الـ Guard مش هيحجبه بعد كده.
      if (required) {
        setTimeout(() => {
          window.location.href = "/admin/dashboard";
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong registering the passkey."
      );
      setStatus("error");
    }
  }

  return (
    <div className="max-w-lg">
      {required && (
        <div className="mb-6 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
          <p className="text-sm font-medium text-amber-300">
            You must add a passkey before you can access the rest of the admin console.
            This is required once for every new account.
          </p>
        </div>
      )}

      <h1 className="text-xl font-bold text-[#16324F]">Passkeys</h1>
      <p className="mt-1 text-sm text-[#5C7A96]">
        {required
          ? "Add a passkey using your device's PIN, fingerprint, or security key. Your password alone will no longer be enough to sign in after this."
          : "Your account already requires a passkey alongside your password. Add another one here if you use a second device."}
      </p>

      <ul className="mt-6 divide-y divide-[#DCEEFF] rounded-lg border border-[#DCEEFF]">
        {passkeys.length === 0 && (
          <li className="p-4 text-sm text-[#5C7A96]">No passkeys registered yet.</li>
        )}
        {passkeys.map((p) => (
          <li key={p.id} className="p-4">
            <p className="font-medium text-[#16324F]">{p.deviceLabel}</p>
            <p className="text-xs text-[#5C7A96]">
              Added {new Date(p.createdAt).toLocaleDateString()}
              {p.lastUsedAt &&
                ` — last used ${new Date(p.lastUsedAt).toLocaleDateString()}`}
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleRegister} className="mt-6 flex gap-2">
        <input
          type="text"
          placeholder="Device label, e.g. Work laptop"
          value={deviceLabel}
          onChange={(e) => setDeviceLabel(e.target.value)}
          className="flex-1 rounded-lg border border-[#DCEEFF] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
        />
        <button
          type="submit"
          disabled={status === "registering"}
          className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "registering" ? "Adding..." : "Add this device"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
      {status === "success" && !required && (
        <p className="mt-3 text-sm font-medium text-green-600">Passkey added.</p>
      )}
      {status === "success" && required && (
        <p className="mt-3 text-sm font-medium text-green-600">
          Passkey added — taking you to the dashboard...
        </p>
      )}
    </div>
  );
}