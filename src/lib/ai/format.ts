// Limpia LaTeX suelto que algunos modelos escriben en las cuentas (la pantalla no lo renderiza).
export function plainMath(text: string): string {
  return text
    .replace(/\$\$?([^$\n]+)\$\$?/g, "$1") // $...$ y $$...$$ -> contenido
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\approx/g, "≈")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\([()%])/g, "$1");
}
