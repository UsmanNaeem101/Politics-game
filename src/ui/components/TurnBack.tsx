import { dateLabel } from '../../engine';
import { GIcon } from '../icons/GIcon';
import type { BackPoint } from '../store';

/** Buttons to go back to how a lost game stood: before its last month ended, or as that month began. */
export function TurnBackButtons({
  points,
  onTurnBack,
  primary = true,
}: {
  points: { point: BackPoint; turn: number }[];
  onTurnBack: (point: BackPoint) => void;
  primary?: boolean;
}) {
  return (
    <>
      {points.map(({ point, turn }) => (
        <button
          key={point}
          className={`btn ${primary ? 'btn--primary' : ''}`}
          onClick={() => onTurnBack(point)}
          title={point === 'end' ? 'Back to just before the month ended (or the deed that ended your game)' : 'Back to the start of the month: everything you did in it is undone'}
        >
          <GIcon name="time" size={16} /> {point === 'end' ? `Back to the end of ${dateLabel(turn)}` : `Back to the start of ${dateLabel(turn)}`}
        </button>
      ))}
    </>
  );
}
