"use client";

import { type ReactNode, useRef } from "react";

import { messages } from "@/lib/messages";

import { NavIcon } from "../nav-icons";
import { rowButton } from "./rows";

/**
 * A button that opens a window over the page (native dialog) with a form or
 * details. `plus` shows a round + button (to add something new).
 */
export function Modal({
  label,
  title,
  plus = false,
  primary = false,
  wide = false,
  children,
}: {
  /** Text of the button (also its accessible name with `plus`). */
  label: string;
  title?: string;
  plus?: boolean;
  primary?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        title={plus ? label : undefined}
        aria-label={plus ? label : undefined}
        className={
          plus
            ? "inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-lg leading-none font-bold text-white hover:bg-brand-dark"
            : rowButton(primary)
        }
      >
        {plus ? "+" : label}
      </button>
      <dialog
        ref={ref}
        onClick={(event) => {
          // A click on the backdrop closes the window.
          if (event.target === ref.current) ref.current?.close();
        }}
        className={`m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 text-slate-900 shadow-xl ring-1 ring-slate-200 backdrop:bg-black/70 ${wide ? "max-w-5xl" : "max-w-xl"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold">{title ?? label}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={messages.nav.closeMenu}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <NavIcon name="close" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </dialog>
    </>
  );
}
