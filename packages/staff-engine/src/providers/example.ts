import { roleExample } from "../prompt";
import { StaffGenerationError, type StaffModelProvider } from "./types";

type Day = Record<string, unknown> & { soort: string; md: string | null };
type WeekOutput = Record<string, unknown> & {
  dagen: Day[];
  individueel: { rugnummer: number; advies: string }[];
};

/**
 * Test mode without AI: builds a week planning from the role's example output
 * in /staff (voorbeelden/). Each day of the week input gets the example day
 * with the same match-day label, or else the next example of the same kind.
 * Content comes entirely from /staff; this only fills in dates and times.
 */
export const exampleProvider: StaffModelProvider = {
  id: "example",
  async generate({ role, context }) {
    const example = roleExample(role) as WeekOutput | null;
    if (!example || !Array.isArray(example.dagen)) {
      throw new StaffGenerationError("provider_error", `role ${role.id} has no example week planning`);
    }
    const byKind = (kind: string) => example.dagen.filter((d) => d.soort === kind);
    const trainings = byKind("training");
    const matches = byKind("wedstrijd");
    const rests = byKind("rust");
    if (!trainings.length || !matches.length || !rests.length) {
      throw new StaffGenerationError("provider_error", "example needs a training, a match and a rest day");
    }

    let next = 0;
    const dagen = context.weekinput.dagen.map((day) => {
      if (day.wedstrijd) {
        return { ...matches[0]!, datum: day.datum, md: day.md, tijdstip: day.wedstrijd.aanvang };
      }
      if (day.training) {
        const template =
          trainings.find((t) => t.md === day.md) ?? trainings[next++ % trainings.length]!;
        return {
          ...template,
          datum: day.datum,
          md: day.md,
          tijdstip: day.training.aanvang,
          totale_duur_min: day.training.duur_min,
        };
      }
      const rest = rests.find((r) => r.md === day.md) ?? rests[0]!;
      return { ...rest, datum: day.datum, md: day.md };
    });

    const advice = example.individueel;
    const individueel = context.kern
      .filter((p) => !p.beschikbaar && p.rugnummer !== null)
      .map((p, i) => ({
        rugnummer: p.rugnummer!,
        advies: advice.length ? advice[i % advice.length]!.advies : "",
      }));

    // Keep the week type of this week when the role reports one (Physical Coach).
    const weektype = context.weekinput.periodisering.weektype?.code;
    const extra = "weektype" in example && weektype ? { weektype } : {};

    return {
      output: { ...example, ...extra, dagen, individueel },
      provider: "example",
      model: null,
      usage: null,
    };
  },
};
