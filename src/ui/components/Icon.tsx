// A handful of line glyphs drawn for this game, in the current text colour.

const PATHS: Record<string, string> = {
  dagger: 'M12 2 L14 9 L12 15 L10 9 Z M7 15 H17 M12 15 V20 M10.5 20 H13.5',
  eye: 'M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z M12 9.5 A2.5 2.5 0 1 1 12 14.5 A2.5 2.5 0 1 1 12 9.5',
  scroll: 'M6 4 H17 A2 2 0 0 1 17 8 H8 V18 A2 2 0 0 1 4 18 V6 A2 2 0 0 1 6 4 Z M8 8 V18 A2 2 0 0 0 10 20 H19 A2 2 0 0 0 19 16 H10 M11 11 H15 M11 13.5 H15',
  crown: 'M3 18 L3 8 L8 12 L12 5 L16 12 L21 8 L21 18 Z M3 20.5 H21',
  bars: 'M5 3 V21 M10 3 V21 M15 3 V21 M20 3 V21 M3 8 H22',
  quill: 'M20 3 C12 4 7 10 5 19 M5 19 L4 21 M9 13 C12 13 15 11 17 8 M20 3 C19 8 16 12 9 13',
  coin: 'M12 4 A8 8 0 1 1 12 20 A8 8 0 1 1 12 4 M12 8 V16 M9.5 10 C9.5 8 14.5 8 14.5 10 C14.5 12 9.5 12 9.5 14 C9.5 16 14.5 16 14.5 14',
  hourglass: 'M6 3 H18 M6 21 H18 M7 3 C7 9 17 9 17 12 C17 15 7 15 7 21 M17 3 C17 9 7 9 7 12 C7 15 17 15 17 21',
  hand: 'M8 13 V5 A1.5 1.5 0 0 1 11 5 V11 M11 10 V3.5 A1.5 1.5 0 0 1 14 3.5 V11 M14 10 V5 A1.5 1.5 0 0 1 17 5 V13 C17 18 14 21 11 21 C8 21 6 19 5 16 L4 13 A1.5 1.5 0 0 1 7 12 L8 13',
  web: 'M12 3 V21 M3 12 H21 M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4 M12 7 L16 8 L17 12 L16 16 L12 17 L8 16 L7 12 L8 8 Z',
  hall: 'M3 21 H21 M5 21 V10 M19 21 V10 M3 10 L12 3 L21 10 M9 21 V14 H15 V21',
  book: 'M4 5 C7 4 10 4 12 6 C14 4 17 4 20 5 V19 C17 18 14 18 12 20 C10 18 7 18 4 19 Z M12 6 V20',
  skull: 'M12 3 C7 3 4 6.5 4 11 C4 14 5.5 15.5 7 16.5 V20 H17 V16.5 C18.5 15.5 20 14 20 11 C20 6.5 17 3 12 3 Z M9 11 A1.5 1.5 0 1 1 9 12 M15 11 A1.5 1.5 0 1 1 15 12 M10 20 V18 M14 20 V18',
  people: 'M8 11 A3 3 0 1 1 8 5 A3 3 0 1 1 8 11 M2 20 C2 15 14 15 14 20 M16 11 A3 3 0 1 0 16 5 M16 14 C19 14 22 16 22 20',
  key: 'M8 8 A4 4 0 1 1 8 16 A4 4 0 1 1 8 8 M12 12 H21 M18 12 V15 M21 12 V14',
  close: 'M5 5 L19 19 M19 5 L5 19',
  sun: 'M12 8 A4 4 0 1 1 12 16 A4 4 0 1 1 12 8 M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M4.9 19.1 L6.3 17.7 M17.7 6.3 L19.1 4.9',
  moon: 'M20 15 A8 8 0 1 1 9 4 A6.5 6.5 0 0 0 20 15 Z',
  arrow: 'M5 12 H19 M13 6 L19 12 L13 18',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
