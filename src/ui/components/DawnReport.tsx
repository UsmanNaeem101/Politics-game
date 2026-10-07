import { dawnEvents } from '../../engine';
import { useGame } from '../context';

export function DawnReport({ onClose }: { onClose: () => void }) {
  const { s } = useGame();
  const evs = dawnEvents(s, s.player);
  const pub = evs.filter((e) => e.visibleTo === 'all');
  const priv = evs.filter((e) => e.visibleTo !== 'all');
  const waiting = s.audiences.length;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal dawn" role="dialog" aria-modal="true" aria-labelledby="dawn-h">
        <header className="modal-head">
          <div>
            <p className="eyebrow">While you slept</p>
            <h2 id="dawn-h" className="display">
              Week {s.turn} dawns
            </h2>
          </div>
        </header>
        <div className="modal-body dawn-body">
          {evs.length === 0 && <p className="muted">A quiet night. Too quiet, perhaps.</p>}
          {priv.length > 0 && (
            <section>
              <h3 className="panel-subtitle">What reached your ears</h3>
              <ul className="events">
                {priv.map((e) => (
                  <li key={e.id} className={`ev ev--${e.tone}`}>
                    {e.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {pub.length > 0 && (
            <section>
              <h3 className="panel-subtitle">What the whole court saw</h3>
              <ul className="events">
                {pub.map((e) => (
                  <li key={e.id} className={`ev ev--${e.tone}`}>
                    {e.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <footer className="modal-foot">
          <span className="muted small">{waiting ? `${waiting} ${waiting === 1 ? 'person waits' : 'people wait'} to see you.` : ''}</span>
          <button className="btn btn--primary" onClick={onClose} autoFocus>
            {waiting ? 'Receive them' : 'Begin the week'}
          </button>
        </footer>
      </div>
    </div>
  );
}
