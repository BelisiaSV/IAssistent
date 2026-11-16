"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { PresentationData } from "@/lib/presentation/types";

import { presentationSlides, SLIDE_H, SLIDE_W } from "./slides";

const m = messages.presentation;

/** A slide at design size, scaled to the width of its box. */
function Scaled({ id, children }: { id: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setScale(el.clientWidth / SLIDE_W),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="relative w-full overflow-hidden rounded-lg shadow-lg ring-1 ring-slate-200 print:rounded-none print:shadow-none print:ring-0"
      style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
    >
      <div
        id={id}
        className="absolute top-0 left-0 origin-top-left print:!scale-100"
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

async function slidePng(id: string) {
  const node = document.getElementById(id);
  if (!node) return null;
  const { toPng } = await import("html-to-image");
  // Render at design size, without the scaling of the viewer.
  return toPng(node, {
    pixelRatio: 1.5,
    cacheBust: true,
    width: SLIDE_W,
    height: SLIDE_H,
    style: { transform: "none" },
  });
}

function save(url: string, name: string) {
  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();
}

/** The slides with download and print. */
export function PresentationViewer({
  data,
  fileName,
}: {
  data: PresentationData;
  fileName: string;
}) {
  const slides = presentationSlides(data);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function download(keys: string[]) {
    setFailed(false);
    for (const key of keys) {
      setBusy(key);
      try {
        const url = await slidePng(`slide-${key}`);
        if (url)
          save(
            url,
            `${fileName}-${slides.findIndex((s) => s.key === key) + 1}.png`,
          );
      } catch (error) {
        console.error("slide export failed", error);
        setFailed(true);
      }
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: ${SLIDE_W}px ${SLIDE_H}px; margin: 0 } .slide-page { break-after: page; width: ${SLIDE_W}px } }`}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          type="button"
          disabled={!!busy}
          onClick={() => download(slides.map((s) => s.key))}
        >
          {busy ? m.downloading : m.downloadAll}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.print()}
        >
          {m.print}
        </Button>
        {failed && <span className="text-sm text-red-700">{m.failed}</span>}
      </div>
      <ol className="grid grid-cols-1 gap-6 2xl:grid-cols-2 print:block">
        {slides.map((slide, i) => (
          <li key={slide.key} className="slide-page space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-500 print:hidden">
              <span>{m.slide(i + 1)}</span>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => download([slide.key])}
                className="font-medium text-brand hover:underline disabled:opacity-50"
              >
                {busy === slide.key ? m.downloading : m.downloadOne}
              </button>
            </div>
            <Scaled id={`slide-${slide.key}`}>{slide.node}</Scaled>
          </li>
        ))}
      </ol>
    </div>
  );
}
