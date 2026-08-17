import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";
import { SectionLink } from "./section-link";

export const metadata: Metadata = { title: "Latest" };

export default async function AppHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  const db = prisma();

  const latestEdition = await db.edition.findFirst({
    orderBy: { editionDate: "desc" },
    include: {
      articles: {
        orderBy: [{ page: "asc" }, { pageOrder: "asc" }],
        take: 30,
      },
    },
  });

  const storyCount = await db.story.count({ where: { status: "ACCEPTED" } });
  const channelCount = await db.channel.count({ where: { enabled: true } });

  return (
    <div className="space-y-10">
      <header className="pt-4 text-center">
        <h1 className="masthead text-4xl md:text-5xl">The Daily News</h1>
        <p className="masthead-date mt-3">Automated editorial room · Telegram · Free &amp; open</p>
        <hr className="hairline-heavy mt-5" />
        <hr className="hairline mt-[3px]" />
      </header>

      <section className="py-2">
        {latestEdition ? (
          <SectionLink edition={latestEdition} />
        ) : (
          <EmptyLatest />
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard label="Processed stories" value={storyCount} />
        <StatCard label="Active channels" value={channelCount} />
        <StatCard label="Welcome" value={session ? (session.name ?? session.email) : ""} />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="client-card px-5 py-4">
      <p className="font-ui text-xs uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold text-ink">{String(value)}</p>
    </div>
  );
}

function EmptyLatest() {
  return (
    <div className="client-card px-6 py-10 text-center">
      <h2 className="font-display text-2xl font-bold">No edition published yet</h2>
      <p className="font-ui mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Editions are assembled from collected Telegram posts. Run the worker and processing job, or
        seed demo content with <code className="bg-paper-deep px-1">npm run db:seed:demo</code>.
      </p>
    </div>
  );
}