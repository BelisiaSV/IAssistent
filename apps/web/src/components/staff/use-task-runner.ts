"use client";

import { useEffect, useState } from "react";

import { advanceTask } from "@/lib/staff-room/task-actions";
import type { TaskStatus, TaskView } from "@/lib/staff-room/tasks";

/** Wait before asking again when another page is running the current step. */
const WAIT_MS = 2000;

const signature = (task: TaskView) => task.steps.map((s) => s.status).join(",");

/**
 * Keeps a joint task moving while it runs: asks the server for the next step
 * until the task is ready (or failed). Every page that shows the task may do
 * this; the server never runs a step twice.
 */
export function useTaskRunner(initial: { id: string; status: TaskStatus; view?: TaskView } | null) {
  const [task, setTask] = useState<TaskView | null>(initial?.view ?? null);
  const [ref, setRef] = useState(initial ? { id: initial.id, status: initial.status } : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref || ref.status !== "running") return;
    let cancelled = false;
    (async () => {
      let last = "";
      while (!cancelled) {
        const result = await advanceTask(ref.id);
        if (cancelled) return;
        if (!result.task) {
          setError(result.error);
          return;
        }
        setTask(result.task);
        if (result.task.status !== "running") {
          setRef({ id: result.task.id, status: result.task.status });
          return;
        }
        const now = signature(result.task);
        if (now === last) await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
        last = now;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  /** Use a task the server just returned (after confirming, adjusting or retrying). */
  function update(view: TaskView) {
    setTask(view);
    setRef({ id: view.id, status: view.status });
  }

  return { task, status: ref?.status ?? null, id: ref?.id ?? null, error, update };
}
