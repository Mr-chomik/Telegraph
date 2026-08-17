import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@telegraph/db";
import { NewspaperViewer } from "@/components/newspaper/newspaper-viewer";
import type { ViewerArticle, ViewerEdition } from "@/components/newspaper/types";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Newspaper" };

export default async function NewspaperPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const db = prisma();
  const edition = await db.edition.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: [{ page: "asc" }, { pageOrder: "asc" }],
        include: { sources: true },
      },
    },
  });
  if (!edition) notFound();

  const lang: "ru" | "en" = session.language === "en" ? "en" : "ru";
  const articles: ViewerArticle[] = edition.articles.map((a) => {
    const layout = (a.layout ?? {}) as {
      kind?: string;
      teaser?: boolean;
      cover?: boolean;
      media?: { path?: string; caption?: string | null } | null;
    };
    const media = layout.media;
    const image: ViewerArticle["image"] =
      media?.path && typeof media.path === "string"
        ? {
            url: `/api/media/${encodeURIComponent(media.path.split(/[\\/]/).pop() ?? "")}`,
            caption: media.caption ?? null,
            attribution: null,
          }
        : null;
    return {
      id: a.id,
      storyId: a.storyId,
      page: a.page ?? 1,
      pageOrder: a.pageOrder ?? 0,
      section: a.section,
      sectionIndex: a.sectionIndex,
      format: a.format ?? "BRIEF",
      headline: a.headline ?? "",
      summary: a.summary,
      body: a.body,
      featured: a.featured ?? false,
      isUncertain: a.isUncertain ?? false,
      teaser: layout.teaser ?? false,
      layoutKind: layout.kind ?? null,
      image,
      sources: a.sources.map((s) => ({
        id: s.id,
        channelName: s.channelName,
        channelUsername: s.channelUsername,
        url: s.url,
        messageId: s.messageId,
      })),
    };
  });

  const mastheadJson = (edition.configSnapshot ?? {}) as {
    masthead?: { title?: string; dateLabel?: string };
  };
  const masthead =
    mastheadJson.masthead?.title && mastheadJson.masthead?.dateLabel
      ? { title: mastheadJson.masthead.title, dateLabel: mastheadJson.masthead.dateLabel }
      : null;
  const viewerEdition: ViewerEdition = {
    id: edition.id,
    kind: edition.kind,
    editionDate: edition.editionDate.toISOString(),
    label: edition.label,
    pageCount: edition.pageCount,
    publishedAt: edition.publishedAt?.toISOString() ?? null,
    masthead,
  };

  return (
    <div>
      {articles.length === 0 ? (
        <div className="client-card px-6 py-12 text-center">
          <p className="section-banner mb-6 inline-block px-4 py-1.5">Edition</p>
          <p className="font-ui mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            This edition has no articles yet. Run the processing and edition jobs to typeset the
            paper.
          </p>
        </div>
      ) : (
        <NewspaperViewer edition={viewerEdition} articles={articles} lang={lang} />
      )}
    </div>
  );
}
