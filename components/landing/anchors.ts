/** Landing section ids. The marketing header and footer link to these, so they change together. */
export const LANDING_ANCHORS = {
  problem: "problem",
  how: "how-it-works",
  product: "product",
  mezo: "built-on-mezo",
  built: "how-it-was-built",
  faq: "questions",
} as const;

export const LANDING_NAV = [
  { href: `/#${LANDING_ANCHORS.problem}`, label: "Problem" },
  { href: `/#${LANDING_ANCHORS.how}`, label: "How it works" },
  { href: `/#${LANDING_ANCHORS.product}`, label: "Product" },
  { href: `/#${LANDING_ANCHORS.mezo}`, label: "Mezo" },
  { href: `/#${LANDING_ANCHORS.faq}`, label: "Questions" },
] as const;
