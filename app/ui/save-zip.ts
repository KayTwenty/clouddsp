// Builds a zip in the browser straight from storage URLs, so large downloads
// never pass through the web server. Files are fetched one at a time and
// streamed into the zip; where the browser supports it (Chrome, Edge) the zip
// streams straight to disk, otherwise it's assembled in memory first.

export type ZipFile = { path: string; size: number; url: string };

type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;

// Tracks with the same name get numbered folders; identical USB cache entries
// (the same file processed twice) are only included once.
export function mergeZipFiles(groups: ZipFile[][]) {
  const used = new Set<string>();
  const out: ZipFile[] = [];
  for (const files of groups) {
    const rename = new Map<string, string>();
    for (const f of files) {
      let path = f.path;
      if (used.has(path)) {
        if (path.startsWith("mods/")) continue;
        const [folder, ...rest] = path.split("/");
        let target = rename.get(folder);
        if (!target) {
          let n = 2;
          while ([...used].some((p) => p.startsWith(`${folder} (${n})/`))) n++;
          target = `${folder} (${n})`;
          rename.set(folder, target);
        }
        path = [target, ...rest].join("/");
      }
      used.add(path);
      out.push({ ...f, path });
    }
  }
  return out;
}

export async function saveZip(files: ZipFile[], filename: string) {
  const { downloadZip } = await import("client-zip");

  async function* entries() {
    for (const f of files) {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`Couldn't fetch ${f.path} (${res.status})`);
      yield { name: f.path, input: res, size: f.size };
    }
  }
  const zip = downloadZip(entries(), {
    metadata: files.map((f) => ({ name: f.path, size: f.size })),
  });

  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker && zip.body) {
    let handle;
    try {
      handle = await picker({
        suggestedName: filename,
        types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }],
      });
    } catch {
      return; // the user closed the save dialog
    }
    await zip.body.pipeTo(await handle.createWritable());
    return;
  }

  const blob = await zip.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
