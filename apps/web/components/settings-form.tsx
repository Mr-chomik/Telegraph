"use client";

import { useState } from "react";

export interface SettingsSnapshot {
  language: "ru" | "en";
  humorEnabled: boolean;
  contentAmount: "light" | "normal" | "full";
  myNewspaperEnabled: boolean;
}

export function SettingsForm({ initial }: { initial: SettingsSnapshot }) {
  const [form, setForm] = useState<SettingsSnapshot>(initial);
  const [status, setStatus] = useState<{ kind: "idle" | "saved" | "error"; message?: string }>({
    kind: "idle",
  });

  async function save(): Promise<void> {
    setStatus({ kind: "idle" });
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setStatus({ kind: "saved", message: "Saved" });
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "error", message: data?.error ?? "Failed to save" });
    }
  }

  return (
    <div className="space-y-6">
      <Field label="Language / Язык">
        <div className="flex gap-2">
          {(["ru", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setForm((f) => ({ ...f, language: lang }))}
              className={`font-ui border px-4 py-1.5 text-sm uppercase tracking-widest transition-colors ${
                form.language === lang
                  ? "border-ink bg-ink text-paper"
                  : "border-rule text-ink-soft hover:border-rule-dark hover:text-ink"
              }`}
            >
              {lang === "ru" ? "Русский" : "English"}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Amount of content / Объём выпуска">
        <div className="flex gap-2">
          {(["light", "normal", "full"] as const).map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setForm((f) => ({ ...f, contentAmount: amount }))}
              className={`font-ui border px-4 py-1.5 text-sm capitalize tracking-widest transition-colors ${
                form.contentAmount === amount
                  ? "border-ink bg-ink text-paper"
                  : "border-rule text-ink-soft hover:border-rule-dark hover:text-ink"
              }`}
            >
              {amount}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Humor section / Юмор">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.humorEnabled}
            onChange={(e) => setForm((f) => ({ ...f, humorEnabled: e.target.checked }))}
            className="h-4 w-4 accent-[#8a1f1f]"
          />
          <span className="font-ui text-sm text-ink-soft">
            Light Reading / Лёгкое чтение (funny stories)
          </span>
        </label>
      </Field>

      <hr className="hairline" />

      <div>
        <button
          type="button"
          onClick={save}
          className="font-ui bg-ink px-6 py-2 text-sm font-bold uppercase tracking-widest text-paper transition-colors hover:bg-ink-soft"
        >
          Save
        </button>
        {status.kind === "saved" && (
          <span className="font-ui ml-3 text-sm text-ink-soft">{status.message}</span>
        )}
        {status.kind === "error" && (
          <span className="font-ui ml-3 text-sm text-accent">{status.message}</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-ui text-xs uppercase tracking-widest text-ink-faint">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}