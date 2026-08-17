interface PhotoPlateProps {
  src: string;
  alt: string;
  caption?: string | null;
  className?: string;
  imgClassName?: string;
}

/**
 * A photo rendered like an old newspaper plate: a slightly sepia, mat-finished
 * print framed by a thin double border, with a small-caps caption line.
 */
export function PhotoPlate({ src, alt, caption, className, imgClassName }: PhotoPlateProps) {
  return (
    <figure className={className}>
      <div className="border border-rule bg-paper-deep p-1 shadow-[0_1px_0_0_#1c1b17,0_6px_16px_-12px_rgba(28,27,23,0.5)]">
        <div className="border border-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={`w-full object-cover sepia-[0.24] contrast-[1.06] brightness-[0.99] ${imgClassName ?? ""}`}
          />
        </div>
      </div>
      {caption && (
        <figcaption className="font-ui mt-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
