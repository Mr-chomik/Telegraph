"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface CategoryLite {
  id: string;
  key: string;
  nameRu: string;
  nameEn: string;
}

interface ChannelLite {
  id: string;
  telegramUsername: string;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
  categoryId: string | null;
  enabled: boolean;
  priority: number;
  isDefaultSource: boolean;
  status: "ACTIVE" | "VALIDATING" | "ERROR" | "DISABLED";
  lastSyncAt: string | null;
  lastError: string | null;
  postCount: number;
  qualityScore: number;
  createdAt: string;
}

interface SourcesClientProps {
  channels: ChannelLite[];
  categories: CategoryLite[];
  isAdmin: boolean;
}

const STATUS_LABEL: Record<ChannelLite["status"], string> = {
  ACTIVE: "Active",
  VALIDATING: "Validating…",
  ERROR: "Error",
  DISABLED: "Disabled",
};

export function SourcesClient({ channels, categories, isAdmin }: SourcesClientProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [priority, setPriority] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  async function addChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          categoryKey: categoryKey || undefined,
          priority: Number(priority),
        }),
      });
      const data = (await res.json()) as { channel?: ChannelLite; error?: string };
      if (!res.ok || !data.channel) {
        setError(data.error ?? "Could not add channel.");
        return;
      }
      setUsername("");
      setPriority("5");
      setNotice(`Channel @${data.channel.telegramUsername} added — validating via Telegram.`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateChannel(id: string, body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
        return true;
      }
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Update failed.");
      return false;
    } catch {
      setError("Network error.");
      return false;
    }
  }

  async function removeChannel(id: string, username_: string) {
    if (!confirm(`Remove channel @${username_} and its posts?`)) return;
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Could not remove channel.");
      }
    } catch {
      setError("Network error.");
    }
  }

  const ordered = [...channels].sort(
    (a, b) =>
      a.priority - b.priority || (a.title ?? a.telegramUsername).localeCompare(b.title ?? b.telegramUsername),
  );

  return (
    <div className="space-y-8">
      <form onSubmit={addChannel} className="client-card space-y-4 p-5">
        <h2 className="font-display text-xl font-bold">Add a public Telegram channel</h2>
        {error && (
          <p role="alert" className="font-ui border-l-2 border-accent bg-paper-dim px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="font-ui border-l-2 border-ink bg-paper-dim px-3 py-2 text-sm text-ink-soft">
            {notice}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_120px_auto]">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@example_channel or t.me/example_channel"
            className="font-ui w-full border border-rule bg-paper px-3 py-2 text-ink focus:border-accent"
          />
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            className="font-ui w-full border border-rule bg-paper px-2 py-2 text-sm text-ink-soft"
          >
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.nameRu}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="font-ui w-full border border-rule bg-paper px-2 py-2 text-sm text-ink-soft"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
              <option key={p} value={p}>
                Priority {p}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="font-ui bg-ink px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        <p className="font-ui text-xs text-ink-faint">
          Public channels only. The worker validates the name via Telegram&apos;s MTProto API and
          begins collecting posts.
        </p>
      </form>

      <section>
        {ordered.length === 0 ? (
          <div className="client-card px-6 py-10 text-center">
            <p className="font-display text-xl font-bold">No channels yet</p>
            <p className="font-ui mt-2 text-sm text-ink-soft">
              Add your first channel above. Default channels arrive from the admin panel.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {ordered.map((c) => (
              <li key={c.id} className="client-card p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="shrink-0">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt=""
                        className="h-12 w-12 border border-rule object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center border border-rule bg-paper-deep font-display text-xl font-bold text-ink-soft">
                        {(c.title ?? c.telegramUsername).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-display text-lg font-bold">{c.title ?? c.telegramUsername}</h3>
                      <a
                        href={`https://t.me/${c.telegramUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-ui text-sm text-accent hover:underline"
                      >
                        @{c.telegramUsername}
                      </a>
                      <span
                        className={`font-ui text-xs uppercase tracking-widest ${
                          c.status === "ERROR" ? "text-accent" : "text-ink-faint"
                        }`}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                      {c.isDefaultSource && (
                        <span className="font-ui text-xs uppercase tracking-widest text-ink-faint">
                          default
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="font-ui mt-1 line-clamp-2 text-sm text-ink-soft">{c.description}</p>
                    )}
                    {c.lastError && (
                      <p className="font-ui mt-1 truncate text-xs text-accent">{c.lastError}</p>
                    )}
                    <p className="font-ui mt-2 text-xs text-ink-faint">
                      {c.postCount} posts · synced{" "}
                      {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "never"} · quality {c.qualityScore.toFixed(2)}
                    </p>
                  </div>

                  <div className="font-ui flex flex-wrap items-center gap-2 text-sm">
                    <select
                      value={categoryById.get(c.categoryId ?? "")?.key ?? ""}
                      onChange={(e) => {
                        const cat = categories.find((x) => x.key === e.target.value);
                        void updateChannel(c.id, { categoryId: cat?.id ?? null });
                      }}
                      className="border border-rule bg-paper px-2 py-1.5 text-ink-soft"
                    >
                      <option value="">No category</option>
                      {categories.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.nameRu}
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.priority}
                      onChange={(e) =>
                        void updateChannel(c.id, { priority: Number(e.target.value) })
                      }
                      className="border border-rule bg-paper px-2 py-1.5 text-ink-soft"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                        <option key={p} value={p}>
                          P{p}
                        </option>
                      ))}
                    </select>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => void updateChannel(c.id, { enabled: e.target.checked })}
                        className="accent-ink"
                      />
                      <span className="text-xs uppercase tracking-wider text-ink-soft">On</span>
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void removeChannel(c.id, c.telegramUsername)}
                        className="border border-rule px-2 py-1.5 text-xs uppercase tracking-wider text-accent transition-colors hover:border-accent"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}