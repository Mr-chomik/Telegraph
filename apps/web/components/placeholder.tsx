interface PlaceholderProps {
  title: string;
  description?: string;
  note?: string;
}

export function Placeholder({ title, description, note }: PlaceholderProps) {
  return (
    <div className="client-card px-6 py-12 text-center">
      <p className="section-banner mb-6 inline-block px-4 py-1.5">{title}</p>
      {description && (
        <p className="font-ui mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
      {note && (
        <p className="font-ui mx-auto mt-4 max-w-md text-xs text-ink-faint">{note}</p>
      )}
    </div>
  );
}