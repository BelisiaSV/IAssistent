import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { mediaKeyOf, readBankZip } from "./zip";

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
    expect(result.media.map((f) => [f.name, f.type])).toEqual([
      ["abc.png", "image/png"],
      ["def.MP4", "video/mp4"],
    ]);
    expect(mediaKeyOf("media/abc.png")).toBe("abc");
  });
});
