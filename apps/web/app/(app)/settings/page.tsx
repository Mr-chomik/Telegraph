import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@telegraph/db";
import { SettingsForm } from "@/components/settings-form";
import { SourcesPreferences } from "@/components/sources-preferences";
import { getMySources } from "@/lib/my-sources";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = prisma();
  const [prefs, mySources] = await Promise.all([
    db.userPreference.findUnique({ where: { userId: session.id } }),
    getMySources(session.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-rule pb-3">
        <p className="font-ui text-xs uppercase tracking-[0.24em] text-accent">Settings</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink">Your newspaper</h1>
        <p className="font-ui mt-1 text-sm text-ink-soft">
          Language, humour section, amount of content, and your source mix for
          the personal digest.
        </p>
      </header>

      <div className="client-card px-6 py-6">
        <SettingsForm
          initial={{
            language: prefs?.language === "en" ? "en" : "ru",
            humorEnabled: prefs?.humorEnabled ?? true,
            contentAmount: (prefs?.contentAmount as "light" | "normal" | "full") ?? "normal",
            myNewspaperEnabled: prefs?.myNewspaperEnabled ?? false,
          }}
        />
      </div>

      <SourcesPreferences initialChannels={mySources} />

      <p className="font-ui text-xs text-ink-faint">
        Signed in as {session.email}. Language here also sets the interface used by the
        newspaper viewer.
      </p>
    </div>
  );
}