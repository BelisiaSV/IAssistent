import { z } from "zod";

import { messages } from "@/lib/messages";

import { isIsoDate, weekDates } from "./dates";

const e = messages.weeks.errors;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, e.time);
const duration = z.coerce.number().int(e.duration).min(30, e.duration).max(240, e.duration);
const isoDate = z.string().refine(isIsoDate, e.date);

export const trainingSlotSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  start: time,
  duration_min: duration,
});
export const trainingScheduleSchema = z
  .array(trainingSlotSchema)
  .max(7)
  .refine((slots) => new Set(slots.map((s) => s.weekday)).size === slots.length, e.duplicateDay);
export type TrainingSlot = z.infer<typeof trainingSlotSchema>;

export const weekTrainingSchema = z.object({ date: isoDate, start: time, duration_min: duration });
export const weekMatchSchema = z.object({
  date: isoDate,
  start: z.union([z.literal("").transform(() => null), time, z.null()]),
  opponent: z.string().trim().min(1, e.opponent).max(120),
  home: z.boolean(),
});
export type WeekTraining = z.infer<typeof weekTrainingSchema>;
export type WeekMatch = z.infer<typeof weekMatchSchema>;

/** Week input of the head coach for the week starting on `weekStart` (a Monday). */
export function weekPlanSchema(weekStart: string) {
  const dates = new Set(weekDates(weekStart));
  return z
    .object({
      trainings: z.array(weekTrainingSchema).max(7),
      matches: z.array(weekMatchSchema).max(3),
      previousMatchDate: z.union([z.literal("").transform(() => null), isoDate, z.null()]),
      notes: z
        .string()
        .trim()
        .max(1000, e.notes)
        .transform((v) => (v === "" ? null : v)),
    })
    .superRefine((week, ctx) => {
      const days = [...week.trainings.map((t) => t.date), ...week.matches.map((m) => m.date)];
      if (days.some((d) => !dates.has(d))) ctx.addIssue({ code: "custom", message: e.outsideWeek });
      if (new Set(days).size !== days.length) ctx.addIssue({ code: "custom", message: e.oneActivityPerDay });
      if (week.previousMatchDate && week.previousMatchDate >= weekStart) {
        ctx.addIssue({ code: "custom", message: e.previousMatch, path: ["previousMatchDate"] });
      }
    })
    .transform((week) => ({
      ...week,
      trainings: [...week.trainings].sort((a, b) => a.date.localeCompare(b.date)),
      matches: [...week.matches].sort((a, b) => a.date.localeCompare(b.date)),
    }));
}
export type WeekPlanInput = z.output<ReturnType<typeof weekPlanSchema>>;
