import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";
import { SourcesClient } from "./sources-client";

export const metadata: Metadata = { title: "Channel sources" };

export default async function SourcesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = prisma();
  const [channels, categories] = await Promise.all([
    db.channel.findMany({
      orderBy: [{ priority: "asc" }, { title: "asc" }],
      include: { category: true },
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const serializedChannels = channels.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
  }));

  return (
    <SourcesClient
      channels={serializedChannels}
      categories={categories.map((c) => ({ id: c.id, key: c.key, nameRu: c.nameRu, nameEn: c.nameEn }))}
      isAdmin={session.role === "ADMIN"}
    />
  );
}