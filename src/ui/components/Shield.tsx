import { useId } from 'react';
import type { ChargeShape, Heraldry, Status } from '../../engine';

const SHIELD = 'M6,6 H94 V54 C94,88 72,106 50,115 C28,106 6,88 6,54 Z';

function Division({ h }: { h: Heraldry }) {
  const f2 = h.field2 ?? h.field;
  switch (h.division) {
    case 'per-pale':
      return <rect x={50} y={0} width={50} height={120} fill={f2} />;
    case 'per-fess':
      return <rect x={0} y={58} width={100} height={62} fill={f2} />;
    case 'per-bend':
      return <polygon points="0,0 100,120 0,120" fill={f2} />;
    case 'quarterly':
      return (
        <>
          <rect x={50} y={0} width={50} height={58} fill={f2} />
          <rect x={0} y={58} width={50} height={62} fill={f2} />
        </>
      );
    case 'chevron':
      return <polygon points="0,96 50,48 100,96 100,116 50,68 0,116" fill={f2} />;
    default:
      return null;
  }
}

function Charge({ shape, fill }: { shape: ChargeShape; fill: string }) {
  switch (shape) {
    case 'crown':
      return (
        <g fill={fill}>
          <path d="M28,64 L28,42 L38,52 L44,36 L50,50 L56,36 L62,52 L72,42 L72,64 Z" />
          <rect x={26} y={64} width={48} height={7} rx={1} />
        </g>
      );
    case 'sword':
      return (
        <g fill={fill}>
          <polygon points="46.5,30 53.5,30 50,20" />
          <rect x={46.5} y={30} width={7} height={40} />
          <rect x={34} y={68} width={32} height={5} rx={1} />
          <rect x={47.5} y={73} width={5} height={11} />
          <circle cx={50} cy={87} r={4.5} />
        </g>
      );
    case 'cross':
      return <path fill={fill} d="M43,28 H57 L55,47 L74,45 V61 L55,59 L57,84 H43 L45,59 L26,61 V45 L45,47 Z" />;
    case 'key':
      return (
        <g fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round">
          <circle cx={50} cy={36} r={9} />
          <path d="M50,45 V82 M50,72 H60 M50,80 H58" />
        </g>
      );
    case 'raven':
      return (
        <path
          fill={fill}
          d="M27,64 C33,49 46,44 56,46 L63,38 L70,41 L64,48 C70,54 70,63 63,69 L74,80 L60,75 L52,80 L49,71 C40,72 32,70 27,64 Z"
        />
      );
    case 'boar':
      return (
        <g fill={fill}>
          <path d="M24,62 C26,50 40,43 56,45 L66,40 L65,47 C74,49 77,57 73,64 L78,67 L69,69 L67,77 L60,77 L60,70 L42,70 L41,77 L34,77 L34,68 C28,68 24,66 24,62 Z" />
          <path d="M72,64 L80,58 L76,66 Z" />
        </g>
      );
    case 'crescent':
      return <path fill={fill} d="M60,32 A23,23 0 1,0 60,80 A18,18 0 1,1 60,32 Z" />;
    case 'chalice':
      return <path fill={fill} d="M34,34 H66 C66,52 59,59 53,61 V71 H62 V78 H38 V71 H47 V61 C41,59 34,52 34,34 Z" />;
    case 'tower':
      return (
        <g fill={fill}>
          <path d="M35,82 V44 H32 V32 H39 V37 H45 V32 H55 V37 H61 V32 H68 V44 H65 V82 Z" />
        </g>
      );
    case 'wheat':
      return (
        <g fill={fill}>
          <rect x={48.8} y={30} width={2.4} height={54} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <ellipse cx={44} cy={36 + i * 8} rx={4} ry={6.5} transform={`rotate(-30 44 ${36 + i * 8})`} />
              <ellipse cx={56} cy={36 + i * 8} rx={4} ry={6.5} transform={`rotate(30 56 ${36 + i * 8})`} />
            </g>
          ))}
          <ellipse cx={50} cy={27} rx={3.5} ry={6} />
        </g>
      );
    case 'fleur':
      return (
        <g fill={fill}>
          <path d="M50,24 C58,36 58,48 50,58 C42,48 42,36 50,24 Z" />
          <path d="M47,56 C35,60 26,51 31,41 C36,48 42,51 47,52 Z" />
          <path d="M53,56 C65,60 74,51 69,41 C64,48 58,51 53,52 Z" />
          <rect x={36} y={58} width={28} height={6} rx={1} />
          <path d="M45,64 L50,80 L55,64 Z" />
        </g>
      );
    case 'star':
    case 'lion':
    default:
      return <polygon fill={fill} points="50,26 57,46 78,46 61,58 67,78 50,66 33,78 39,58 22,46 43,46" />;
  }
}

export function Shield({
  h,
  size = 48,
  status = 'free',
  crowned = false,
  title,
}: {
  h: Heraldry;
  size?: number;
  status?: Status;
  crowned?: boolean;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const dim = status === 'dead' || status === 'fled';
  return (
    <svg
      className={`shield shield--${status}`}
      width={size}
      height={size * (crowned ? 1.36 : 1.2)}
      viewBox={crowned ? '0 -16 100 136' : '0 0 100 120'}
      role="img"
      aria-label={title}
      style={{ filter: dim ? 'grayscale(1)' : undefined, opacity: dim ? 0.55 : 1 }}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`c${id}`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width={100} height={120} fill={h.field} />
        <Division h={h} />
        <Charge shape={h.charge} fill={h.tincture} />
        {status === 'imprisoned' && (
          <g stroke="#0d0d10" strokeWidth={4} opacity={0.85}>
            {[22, 38, 54, 70, 86].map((x) => (
              <line key={x} x1={x} y1={0} x2={x} y2={120} />
            ))}
          </g>
        )}
      </g>
      <path d={SHIELD} fill="none" stroke="var(--gold)" strokeWidth={3} />
      {status === 'dead' && <path d="M22,22 L78,98 M78,22 L22,98" stroke="var(--rubric)" strokeWidth={5} opacity={0.8} />}
      {crowned && (
        <path d="M28,2 L28,-10 L37,-4 L44,-15 L50,-6 L56,-15 L63,-4 L72,-10 L72,2 Z" fill="var(--gold)" />
      )}
    </svg>
  );
}
