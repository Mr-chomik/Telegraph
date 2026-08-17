"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SourceChannel {
  id: string;
  telegramUsername: string;
  title: string | null;
  status: string;
  categoryKey: string | null;
  postCount: number;
  weight: number;
  enabled: boolean;
  mine: boolean;
}

const WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const WEIGHT_HINT = [
  "",
  "почти не влияет",
  "",
  "",
  "стандартно",
  "",
  "",
  "заметно больше",
  "",
  "максимум материала",
];

export function SourcesPreferences({ initialChannels }: { initialChannels: SourceChannel[] }) {
  const router = useRouter();
  const [channels, setChannels] = useState<SourceChannel[]>(initialChannels);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/me/sources");
      if (!res.ok) throw new Error("Failed to load sources");
      const data = (await res.json()) as { channels: SourceChannel[] };
      setChannels(data.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function save(channelId: string, weight: number, enabled: boolean) {
    const res = await fetch("/api/me/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: [{ channelId, weight, enabled }] }),
    });
    if (!res.ok) {
      setError("Не удалось сохранить настройки источника");
      return;
    }
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, weight, enabled } : c)));
  }

  async function addChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim()) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = (await res.json()) as { channel?: SourceChannel; error?: string };
      if (!res.ok || !data.channel) {
        setError(data.error ?? "Не удалось добавить канал");
        return;
      }
      setUsername("");
      setNotice(`Канал @${data.channel.telegramUsername} добавлен — проверяется и скоро будет собираться.`);
      await load();
      router.refresh();
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function removeChannel(id: string, username_: string) {
    if (!confirm(`Удалить канал @${username_} и его посты?`)) return;
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (res.ok) {
        await load();
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Не удалось удалить канал");
      }
    } catch {
      setError("Сетевая ошибка");
    }
  }

  return (
    <section className="client-card px-6 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold">Источники</h2>
          <p className="font-ui mt-1 text-sm text-ink-soft">
            Вес источника задаёт, сколько материала из него попадает в ваш личный выпуск.
          </p>
        </div>
        <span className="font-ui shrink-0 text-xs uppercase tracking-widest text-ink-faint">
          {`${channels.length} каналов`}
        </span>
      </div>

      {error && (
        <p role="alert" className="font-ui mt-3 border-l-2 border-accent bg-paper-dim px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="font-ui mt-3 border-l-2 border-ink bg-paper-dim px-3 py-2 text-sm text-ink-soft">
          {notice}
        </p>
      )}

      <form onSubmit={addChannel} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@example_channel или t.me/example_channel"
          className="font-ui w-full border border-rule bg-paper px-3 py-2 text-ink focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !username.trim()}
          className="font-ui shrink-0 bg-ink px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Добавляю…" : "Добавить канал"}
        </button>
      </form>
      <p className="font-ui mt-1 text-xs text-ink-faint">
        Любой публичный Telegram-канал. После добавления он будет собираться в общий выпуск.
      </p>

      {channels.length === 0 ? (
        <p className="font-ui mt-4 text-sm text-ink-faint">Каналов пока нет — добавьте первый выше.</p>
      ) : (        <ul className="mt-4 divide-y divide-rule">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display truncate text-sm font-bold">{c.title ?? c.telegramUsername}</span>
                  <a
                    href={`https://t.me/${c.telegramUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-ui shrink-0 text-xs text-accent hover:underline"
                  >
                    @{c.telegramUsername}
                  </a>
                  {c.mine && (
                    <span className="font-ui shrink-0 text-[10px] uppercase tracking-widest text-ink-faint">моё</span>
                  )}
                </div>
                <p className="font-ui text-xs text-ink-faint">
                  {c.postCount} постов
                  {c.categoryKey ? ` · ${c.categoryKey}` : ""}
                  {c.status === "VALIDATING" ? " · проверяется…" : ""}
                  {c.status === "ERROR" ? " · ошибка" : ""}
                </p>
              </div>

              <div className="font-ui flex shrink-0 items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => void save(c.id, c.weight, e.target.checked)}
                    className="accent-ink"
                  />
                  <span className="text-xs uppercase tracking-wider text-ink-soft">
                    {c.enabled ? "вкл" : "выкл"}
                  </span>
                </label>
                <select
                  value={c.weight}
                  disabled={!c.enabled}
                  onChange={(e) => void save(c.id, Number(e.target.value), c.enabled)}
                  className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink-soft disabled:opacity-40"
                  aria-label={`Вес источника ${c.title ?? c.telegramUsername}`}
                >
                  {WEIGHTS.map((w) => (
                    <option key={w} value={w}>
                      {w} {WEIGHT_HINT[w] ? `· ${WEIGHT_HINT[w]}` : ""}
                    </option>
                  ))}
                </select>
                {c.mine && (
                  <button
                    type="button"
                    onClick={() => void removeChannel(c.id, c.telegramUsername)}
                    className="border border-rule px-2 py-1.5 text-xs uppercase tracking-wider text-accent transition-colors hover:border-accent"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}