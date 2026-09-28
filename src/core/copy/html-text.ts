// What a reader sees of an HTML fragment: no svg, no screen-reader-only annotations, entities decoded.
// Shared by the homepage copy tests so docs/spec.html and the rendered page are read the same way.
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", middot: "·", minus: "−" };

const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) =>
    code[0] === "#" ? String.fromCodePoint(parseInt(code.slice(code[1].toLowerCase() === "x" ? 2 : 1), code[1].toLowerCase() === "x" ? 16 : 10)) : (ENTITIES[code] ?? whole),
  );

const strip = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/g, " ")
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, " ");

// Every tag boundary is a break, so "<b>Talk</b><span>Record" reads "Talk Record".
export function textBlocks(html: string): string[] {
  return strip(html)
    .split(/<[^>]+>/)
    .map((s) => decode(s).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export const htmlText = (html: string) => textBlocks(html).join(" ");
