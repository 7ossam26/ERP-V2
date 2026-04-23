const CARD_COLORWAYS = [
  {
    name: "ember",
    accent: "233 113 50",
    bgLight: "255 245 235",
    bgDark: "68 38 23",
    borderLight: "248 199 164",
    borderDark: "150 95 58",
    ink: "181 83 9",
    shadow: "217 119 6",
  },
  {
    name: "lagoon",
    accent: "52 137 122",
    bgLight: "237 250 247",
    bgDark: "19 58 54",
    borderLight: "168 226 214",
    borderDark: "78 140 130",
    ink: "17 94 89",
    shadow: "15 118 110",
  },
  {
    name: "azure",
    accent: "79 123 201",
    bgLight: "240 245 255",
    bgDark: "25 36 68",
    borderLight: "183 200 245",
    borderDark: "92 111 167",
    ink: "59 91 178",
    shadow: "59 130 246",
  },
  {
    name: "plum",
    accent: "154 101 196",
    bgLight: "247 241 255",
    bgDark: "50 30 69",
    borderLight: "214 191 245",
    borderDark: "128 94 157",
    ink: "126 58 175",
    shadow: "147 51 234",
  },
  {
    name: "rose",
    accent: "220 94 122",
    bgLight: "255 241 244",
    bgDark: "72 31 43",
    borderLight: "248 189 205",
    borderDark: "170 93 114",
    ink: "190 24 93",
    shadow: "225 29 72",
  },
  {
    name: "citrus",
    accent: "158 162 49",
    bgLight: "250 252 235",
    bgDark: "56 58 24",
    borderLight: "220 229 158",
    borderDark: "135 141 73",
    ink: "101 111 24",
    shadow: "132 204 22",
  },
  {
    name: "sky",
    accent: "63 159 211",
    bgLight: "238 249 255",
    bgDark: "19 55 74",
    borderLight: "181 225 245",
    borderDark: "76 125 153",
    ink: "3 105 161",
    shadow: "14 165 233",
  },
  {
    name: "sand",
    accent: "190 127 68",
    bgLight: "255 247 238",
    bgDark: "74 48 27",
    borderLight: "239 206 170",
    borderDark: "157 109 68",
    ink: "146 64 14",
    shadow: "194 120 3",
  },
];

function hashSeed(seed) {
  return Array.from(String(seed || "brand-card")).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
}

export function getCardColorway(seed) {
  return CARD_COLORWAYS[hashSeed(seed) % CARD_COLORWAYS.length];
}

export function getCardColorVars(seed) {
  const colorway = getCardColorway(seed);

  return {
    "--brand-card-accent": colorway.accent,
    "--brand-card-bg-light": colorway.bgLight,
    "--brand-card-bg-dark": colorway.bgDark,
    "--brand-card-border-light": colorway.borderLight,
    "--brand-card-border-dark": colorway.borderDark,
    "--brand-card-ink": colorway.ink,
    "--brand-card-shadow": colorway.shadow,
  };
}

export { CARD_COLORWAYS };
