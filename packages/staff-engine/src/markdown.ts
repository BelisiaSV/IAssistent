import { parse as parseYaml } from "yaml";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown> | null;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseMarkdown(source: string): ParsedMarkdown {
  const match = FRONTMATTER.exec(source);
  if (!match) return { frontmatter: null, body: source };

  const data: unknown = parseYaml(match[1] ?? "");
  const frontmatter =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return { frontmatter, body: source.slice(match[0].length) };
}

/** Level-2 headings (`## ...`), in order. */
export function sectionHeadings(body: string): string[] {
  return body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());
}
