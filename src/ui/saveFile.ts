// Keeping a game in a file, and bringing one back. On the published page the platform hands the file over (the
// viewer confirms it); in the desktop app, or a copy of the page anywhere else, an ordinary download does.

type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> };

export type SaveOutcome = 'saved' | 'declined' | 'unavailable';

export async function saveToFile(raw: string, filename: string): Promise<SaveOutcome> {
  const data = new Blob([raw], { type: 'application/json' });
  const use = window.claude?.use;
  if (use) {
    const downloads = (await use('downloads').catch(() => null)) as Downloads | null;
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        return 'saved';
      } catch (e) {
        return (e as { code?: string }).code === 'declined' ? 'declined' : 'unavailable';
      }
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

/** Ask for a save file and read it. Resolves null if none was chosen. */
export function pickSaveFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/** A file name for the game: whose it is, and when. */
export function saveFileName(player: string, date: string): string {
  const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `crown-of-whispers-${slug(player)}-${slug(date)}.json`;
}
