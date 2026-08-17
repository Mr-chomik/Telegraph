"use client";

import type { ReactNode } from "react";

/**
 * Lightweight markdown-lite inline renderer for article bodies:
 * `**bold**`, `*italic*`, `[label](url)` links and bare http(s) URLs.
 * Only http(s) URLs become anchors; everything else is plain text.
 */

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
const BARE_URL_RE = /(https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?])/g;

function withBareUrls(text: string, key: string): ReactNode[] {
  const parts = text.split(BARE_URL_RE);
  return parts.map((part, i) => {
    if (part.startsWith("http")) {
      return (
        <a
          key={`${key}-u${i}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-dark underline-offset-2 hover:text-accent hover:decoration-accent"
        >
          {part}
        </a>
      );
    }
    return part ? <span key={`${key}-s${i}`}>{part}</span> : null;
  });
}

function segmentNodes(seg: string, key: string): ReactNode {
  if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
    return <strong key={key}>{seg.slice(2, -2)}</strong>;
  }
  if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
    return <em key={key}>{seg.slice(1, -1)}</em>;
  }
  const link = seg.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
  if (link) {
    const href = link[2] ?? "";
    if (/^https?:\/\//i.test(href)) {
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-dark underline-offset-2 hover:text-accent hover:decoration-accent"
        >
          {link[1]}
        </a>
      );
    }
  }
  return <span key={key}>{withBareUrls(seg, key)}</span>;
}

/** Render one paragraph of article text with inline formatting. */
export function RichText({ text }: { text: string }) {
  const segments = text.split(INLINE_RE).filter((s) => s.length > 0);
  const nodes = segments.map((seg, i) => segmentNodes(seg, `rt-${i}`));
  // Preserve single-line breaks inside a paragraph (footer lines etc.).
  return <>{withNewlines(nodes)}</>;
}

function withNewlines(nodes: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (const node of nodes) {
    if (typeof node === "string") {
      const lines = node.split("\n");
      lines.forEach((line, i) => {
        if (i > 0) out.push(<br key={`br-${out.length}`} />);
        if (line) out.push(line);
      });
    } else {
      out.push(node);
    }
  }
  return out;
}