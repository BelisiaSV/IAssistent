import JSZip from "jszip";

import { BANK_TEXT_MAX, parseBankText } from "./import";

/** Media types of the bank by extension (the bucket accepts these). */
export const BANK_MEDIA_EXTENSIONS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const baseName = (path: string) => path.split("/").pop() ?? path;

/** The code of a drawing or video is its file name without extension (as in the backup). */
export const mediaKeyOf = (name: string) => baseName(name).replace(/\.[^.]+$/, "");

/**
 * Reads an export of the exercise database as a zip: the backup (the first
 * JSON file that is a valid backup) and every drawing or video in it, in any
 * folder. Hidden files (e.g. __MACOSX) are skipped.
 */
export async function readBankZip(file: Blob): Promise<{ text: string | null; media: { path: string; file: File }[] }> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((e) => !e.dir && !baseName(e.name).startsWith(".") && !e.name.includes("__MACOSX/"));
  let text: string | null = null;
  for (const entry of entries.filter((e) => extension(e.name) === "json")) {
    const content = await entry.async("string");
    if (content.length <= BANK_TEXT_MAX && parseBankText(content)) {
      text = content;
      break;
    }
  }
  const media: { path: string; file: File }[] = [];
  for (const entry of entries) {
    const type = BANK_MEDIA_EXTENSIONS[extension(entry.name)];
    if (!type) continue;
    media.push({ path: entry.name, file: new File([await entry.async("blob")], baseName(entry.name), { type }) });
  }
  return { text, media };
}

/**
 * The files to upload for the exercises of a backup, named after the code of
 * their picture (`<media_key>.<ext>`): found by the path in the backup
 * (`media_bestand`, e.g. media/OEF-007.mp4), else by a file named after the code.
 */
export function bankMediaFiles(
  exercises: readonly { media_key: string | null; media_file?: string | null }[],
  media: readonly { path: string; file: File }[],
): File[] {
  const clean = (p: string) => p.replace(/^\.?\//, "").toLowerCase();
  const byPath = new Map(media.map((m) => [clean(m.path), m.file]));
  const byName = new Map(media.map((m) => [mediaKeyOf(m.file.name), m.file]));
  const out = new Map<string, File>();
  for (const x of exercises) {
    if (!x.media_key || out.has(x.media_key)) continue;
    const wanted = x.media_file ? clean(x.media_file) : null;
    const found =
      (wanted && (byPath.get(wanted) ?? [...byPath.entries()].find(([p]) => p.endsWith(`/${wanted}`))?.[1])) || byName.get(x.media_key);
    if (!found) continue;
    out.set(x.media_key, new File([found], `${x.media_key}.${extension(found.name)}`, { type: found.type }));
  }
  return [...out.values()];
}
