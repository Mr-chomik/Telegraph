export interface ViewerSource {
  id: string;
  channelName: string | null;
  channelUsername: string | null;
  url: string | null;
  messageId: number | null;
}

export interface ViewerImage {
  url: string;
  caption: string | null;
  attribution: string | null;
}

export interface ViewerArticle {
  id: string;
  storyId: string | null;
  page: number;
  pageOrder: number;
  section: string | null;
  sectionIndex: number | null;
  format: string;
  headline: string;
  summary: string | null;
  body: string | null;
  featured: boolean;
  isUncertain: boolean;
  teaser: boolean;
  layoutKind: string | null;
  image: ViewerImage | null;
  sources: ViewerSource[];
}

export interface ViewerEdition {
  id: string;
  kind: string;
  editionDate: string;
  label: string | null;
  pageCount: number | null;
  publishedAt: string | null;
  masthead: { title: string; dateLabel: string } | null;
}

export interface ViewerPage {
  page: number;
  kind: "cover" | "section" | "light-reading";
  section: string | null;
  articles: ViewerArticle[];
}
