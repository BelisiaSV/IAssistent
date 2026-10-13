import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

/** Ajv instance used for role output schemas (draft 2020-12 + formats like "date"). */
export function createAjv() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  // ajv-formats is CommonJS; its default export may be wrapped.
  const add = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  add(ajv);
  return ajv;
}

export type OutputValidation = { ok: true } | { ok: false; errors: string[] };

const validators = new WeakMap<object, ReturnType<ReturnType<typeof createAjv>["compile"]>>();

/** Validates a role's output against its output-schema.json. */
export function validateOutput(schema: Record<string, unknown>, output: unknown): OutputValidation {
  let validate = validators.get(schema);
  if (!validate) {
    validate = createAjv().compile(schema);
    validators.set(schema, validate);
  }
  if (validate(output)) return { ok: true };
  return {
    ok: false,
    errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "ongeldig"}`),
  };
}
