/**
 * File and folder names of the /staff layout. These are structural names,
 * not football content; the content itself lives in the files.
 */
export const SHARED_DIR = "_gedeeld";
export const ROLE_TEMPLATE_FILE = "rol-sjabloon.md";

export const ROLE_FILES = {
  description: "rol.md",
  instructions: "instructies.md",
  outputSchema: "output-schema.json",
} as const;

export const ROLE_DIRS = {
  references: "referentie",
  examples: "voorbeelden",
  tests: "tests",
} as const;

/** Role ids are English kebab-case and equal to the folder name. */
export const ROLE_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Structured shared content in _gedeeld (JSON), loaded and validated by the engine. */
export const SHARED_FILES = {
  positions: "posities.json",
  formations: "formaties.json",
  vision: "visieprofiel.json",
  matchDays: "wedstrijddagen.json",
  periodization: "periodisering.json",
  tests: "testen.json",
} as const;

/** Markdown files in _gedeeld that the prompt builder uses. */
export const SHARED_TEXT_FILES = {
  agreements: "afspraken.md",
  visionAgreements: "visie-hoofdcoach.md",
  systemTemplate: "opdracht-systeem.md",
  userTemplate: "opdracht-gebruiker.md",
} as const;
