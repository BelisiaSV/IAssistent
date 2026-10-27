"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { messages } from "@/lib/messages";

const p = messages.poster;

/** Downloads the poster with id `targetId` as a PNG, or prints the page. */
export function PosterExport({ targetId, fileName }: { targetId: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    const node = document.getElementById(targetId);
    if (!node) return;
    setBusy(true);
    setFailed(false);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = fileName;
      link.href = url;
      link.click();
    } catch (error) {
      console.error("poster export failed", error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={download} disabled={busy}>
        {busy ? p.downloading : p.download}
      </Button>
      <Button type="button" variant="secondary" onClick={() => window.print()}>
        {p.print}
      </Button>
      {failed && <p className="text-sm text-red-700">{p.downloadFailed}</p>}
    </div>
  );
}
