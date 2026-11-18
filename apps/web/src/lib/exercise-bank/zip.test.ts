import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { bankMediaFiles, mediaKeyOf, readBankZip } from "./zip";

describe("readBankZip", () => {
  it("finds the backup and the drawings and videos in any folder", async () => {
    const zip = new JSZip();
    zip.file("readme.json", JSON.stringify({ hello: "world" }));
    zip.file("export/oefenstofbank.json", JSON.stringify([{ nummer: "OEF-001", titel: "Rondo", type: "Rondo", diagram: "abc", diagram_type: "image" }]));
    zip.file("media/abc.png", new Uint8Array([1, 2, 3]));
    zip.file("media/def.MP4", new Uint8Array([4]));
    zip.file("__MACOSX/media/._abc.png", new Uint8Array([0]));
    zip.file("notes.txt", "x");
    const result = await readBankZip(await zip.generateAsync({ type: "blob" }));
    expect(result.text).toContain("OEF-001");
    expect(result.media.map((m) => [m.file.name, m.file.type])).toEqual([
      ["abc.png", "image/png"],
      ["def.MP4", "video/mp4"],
    ]);
    expect(mediaKeyOf("media/abc.png")).toBe("abc");
  });
});

describe("bankMediaFiles", () => {
  const file = (name: string, type = "image/png") => new File([new Uint8Array([1])], name, { type });

  it("finds a picture by its path in the backup and names it after the code", () => {
    const media = [
      { path: "export/media/OEF-002.png", file: file("OEF-002.png") },
      { path: "media/OEF-004.mp4", file: file("OEF-004.mp4", "video/mp4") },
      { path: "abc.png", file: file("abc.png") },
      { path: "media/OEF-999.png", file: file("OEF-999.png") },
    ];
    const exercises = [
      { media_key: "a9d8", media_file: "media/OEF-002.png" },
      { media_key: "OEF-004", media_file: "media/OEF-004.mp4" },
      { media_key: "abc", media_file: null },
      { media_key: null, media_file: null },
    ];
    expect(bankMediaFiles(exercises, media).map((f) => [f.name, f.type])).toEqual([
      ["a9d8.png", "image/png"],
      ["OEF-004.mp4", "video/mp4"],
      ["abc.png", "image/png"],
    ]);
  });
});
