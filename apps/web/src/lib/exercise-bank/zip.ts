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
export async function readBankZip(file: Blob): Promise<{ text: string | null; media: File[] }> {
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
  const media: File[] = [];
  for (const entry of entries) {
    const type = BANK_MEDIA_EXTENSIONS[extension(entry.name)];
    if (!type) continue;
    media.push(new File([await entry.async("blob")], baseName(entry.name), { type }));
  }
  return { text, media };
}
