import sanitizeHtmlLibrary from "sanitize-html";

export function sanitizeRichHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizeHtmlLibrary(value, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
      "h2", "h3", "h4", "h5", "ul", "ol", "li", "a", "img", "hr", "table", "thead",
      "tbody", "tr", "th", "td", "figure", "figcaption", "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, rel: "noopener noreferrer" },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: { ...attribs, loading: "lazy" },
      }),
    },
  });
}
