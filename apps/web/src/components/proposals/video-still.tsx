"use client";

import { useEffect, useState } from "react";

/**
 * A still image from a video, for print (a video cannot be printed). Takes the
 * frame at `at` seconds (or halfway for short videos); if the browser cannot
 * read the frame, it shows the video itself.
 */
export function VideoStill({ src, at = 1, className = "" }: { src: string; at?: number; className?: string }) {
  const [still, setStill] = useState<{ src: string; image: string } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    const fail = () => setFailedFor(src);
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(at, (video.duration || at * 2) / 2);
    });
    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")!.drawImage(video, 0, 0);
        setStill({ src, image: canvas.toDataURL("image/jpeg", 0.85) });
      } catch {
        fail();
      }
    });
    video.addEventListener("error", fail);
    video.src = src;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [src, at]);

  if (still?.src === src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={still.image} alt="" className={`w-full rounded-xl bg-black ${className}`} />;
  }
  if (failedFor === src) return <video src={src} preload="metadata" className={`w-full rounded-xl bg-black ${className}`} />;
  return <div className={`aspect-video w-full animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}
