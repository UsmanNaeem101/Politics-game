import { GI, type GIName } from './gi';

/** A game-icons.net glyph in the current text colour. */
export function GIcon({ name, size = 18, title, className = '' }: { name: GIName; size?: number; title?: string; className?: string }) {
  const esc = (t: string) => t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  return (
    <svg
      className={`gicon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      // The glyphs are static, generated from a vetted icon set.
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${esc(title)}</title>` : '') + GI[name] }}
    />
  );
}

export type { GIName };
