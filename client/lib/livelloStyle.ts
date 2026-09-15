export type LivelloColors = {
  background: string;
  color: string;
  border: string;
};

export function getLivelloColors(livello: string): LivelloColors {
  const l = (livello ?? "").toLowerCase().trim();

  if (l === "pro") {
    return { background: "#e3ff00", color: "#1c00ff", border: "#e3ff00" };
  }
  if (l === "advanced") {
    return { background: "#1c00ff", color: "#ffffff", border: "#1c00ff" };
  }
  if (l === "level 2" || l === "level2" || l === "livello 2" || l === "level two") {
    return { background: "#000000", color: "#ffffff", border: "#000000" };
  }
  if (l === "home training beginner") {
    return { background: "#166534", color: "#ffffff", border: "#166534" };
  }
  if (l === "approfondimenti ed extra") {
    return { background: "#374151", color: "#ffffff", border: "#374151" };
  }
  // Entry Level, Level One, Level 1, default
  return { background: "#ffffff", color: "#000000", border: "#d1d5db" };
}