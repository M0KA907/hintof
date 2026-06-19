export type ThemePref =
  | "system"
  | "light"
  | "dark"
  | "gruvbox-light"
  | "gruvbox-dark"
  | "crocus-light"
  | "crocus-dark"
  | "paprika-light"
  | "sage-light"
  | "cinnamon-dark"
  | "peppercorn-dark";

export const THEME_PREFS: ThemePref[] = [
  "system",
  "light",
  "dark",
  "gruvbox-light",
  "gruvbox-dark",
  "crocus-light",
  "crocus-dark",
  "paprika-light",
  "sage-light",
  "cinnamon-dark",
  "peppercorn-dark"
];

export const THEME_LABELS: Record<ThemePref, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  "gruvbox-light": "Saffron light",
  "gruvbox-dark": "Saffron dark",
  "crocus-light": "Crocus light",
  "crocus-dark": "Crocus dark",
  "paprika-light": "Paprika",
  "sage-light": "Sage",
  "cinnamon-dark": "Cinnamon",
  "peppercorn-dark": "Peppercorn"
};

const THEME_KEY = "hintof:theme";

export function loadTheme(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw && THEME_PREFS.includes(raw as ThemePref)) return raw as ThemePref;
  } catch {
    // ignore
  }
  return "system";
}

export function saveTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // ignore
  }
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}
