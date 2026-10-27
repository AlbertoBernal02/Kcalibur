import { buildEquivalenceHints } from "../equivalences.ts";
import { MEALS } from "../meals.ts";
import { ACTIVITY, GOAL, type Activity, type Goal, type Goals, type Sex } from "../nutrition.ts";
import type { DayTotals } from "../stats.ts";

// Datos del usuario que se resumen para el asistente (sin email ni identificadores).
export type AiData = {
  date: string; // hoy, "YYYY-MM-DD" (fecha local del usuario)
  profile: { sex: Sex | null; age: number | null; height_cm: number | null; weight_kg: number | null; activity: Activity | null; goal: Goal | null } | null;
  goals: Goals | null;
  today: { meal: string; name: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number; external?: boolean }[];
  days: DayTotals[]; // últimos días con registro
  weights: { date: string; value: number }[];
  diets: { name: string; notes: string | null; options: { meal: string; name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; items: string[] }[] }[];
  reference?: RefFood[]; // valores por 100 g de los alimentos mencionados en la conversación
};

// Alimento de la base de datos de la app (valores por 100 g) para usar como referencia en las cuentas.
export type RefFood = { name: string; state: "raw" | "cooked" | null; kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number; serving_g?: number | null };

const STOPWORDS = new Set(["para", "cuantas", "cuantos", "cuanto", "cuanta", "como", "esta", "este", "esto", "esos", "esas", "cambia", "cambiar", "cambio", "opcion", "desayuno", "almuerzo", "merienda", "cena", "comida", "dieta", "kcal", "gramos", "proteina", "hidratos", "grasa", "tiene", "tengo", "puedo", "quiero", "mejor", "entre", "donde", "sobre", "luego", "hacer", "hago", "sino", "pero", "porque", "tambien"]);
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Alimentos de la base cuyo nombre contiene alguna palabra de los textos dados (pregunta actual y anterior).
// Así el asistente calcula sustituciones con los mismos valores que la app sin enviar todo el catálogo.
export function pickReferenceFoods(texts: string[], foods: RefFood[], limit = 10): RefFood[] {
  const words = [...new Set(texts.flatMap((t) => norm(t).split(/[^a-z0-9]+/)).filter((w) => w.length >= 4 && !STOPWORDS.has(w)))];
  if (!words.length) return [];
  return foods
    .map((f) => ({ f, score: words.filter((w) => norm(f.name).includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map((x) => x.f);
}

const MAX_CHARS = 6000; // tope del contexto (~1.700 tokens): cabe en los límites por minuto de los planes gratuitos
const r = (n: number) => Math.round(n);
const clean = (s: string) => s.replace(/[\r\n<>]+/g, " ").slice(0, 120); // un nombre no puede cerrar la etiqueta ni romper líneas

function sections(d: AiData, withItems: boolean): string[] {
  const out: string[] = [`Fecha de hoy: ${d.date}`];

  const p = d.profile;
  const facts = p
    ? [
        p.sex && (p.sex === "male" ? "hombre" : "mujer"),
        p.age !== null && `${p.age} años`,
        p.height_cm && `${p.height_cm} cm`,
        p.weight_kg && `${p.weight_kg} kg`,
        p.activity && `actividad ${ACTIVITY[p.activity].label.toLowerCase()}`,
        p.goal && `objetivo: ${GOAL[p.goal].label.toLowerCase()}`,
      ].filter(Boolean)
    : [];
  out.push(facts.length ? `Perfil: ${facts.join(", ")}` : "Perfil: sin datos.");

  const t = d.today.reduce((a, e) => ({ k: a.k + e.kcal, p: a.p + e.protein_g, c: a.c + e.carbs_g, f: a.f + e.fat_g }), { k: 0, p: 0, c: 0, f: 0 });
  if (d.goals) {
    const g = d.goals;
    out.push(`Objetivos diarios: ${g.kcal} kcal, ${g.protein_g} g proteína, ${g.carbs_g} g hidratos, ${g.fat_g} g grasa.`);
    out.push(
      `Hoy lleva ${r(t.k)} kcal (P ${r(t.p)} g, H ${r(t.c)} g, G ${r(t.f)} g). Le faltan ${r(g.kcal - t.k)} kcal, ${r(g.protein_g - t.p)} g proteína, ${r(g.carbs_g - t.c)} g hidratos y ${r(g.fat_g - t.f)} g grasa (negativo = se ha pasado).`,
    );
  } else {
    out.push("Objetivos diarios: sin definir.");
    out.push(`Hoy lleva ${r(t.k)} kcal (P ${r(t.p)} g, H ${r(t.c)} g, G ${r(t.f)} g).`);
  }

  if (d.today.length) {
    out.push("Comidas de hoy:");
    for (const m of MEALS) {
      const es = d.today.filter((e) => e.meal === m.id);
      if (es.length) out.push(`- ${m.label}: ${es.map((e) => (e.external ? `${clean(e.name)} (${r(e.kcal)} kcal, comida de fuera estimada)` : `${clean(e.name)} ${r(e.grams)} g (${r(e.kcal)} kcal)`)).join("; ")}`);
    }
  } else out.push("Comidas de hoy: nada registrado todavía.");

  if (d.days.length) {
    const avg = d.days.reduce((a, x) => a + x.kcal, 0) / d.days.length;
    out.push(`Últimos días con registro (media ${r(avg)} kcal/día): ` + d.days.map((x) => `${x.date.slice(5)}: ${r(x.kcal)} kcal`).join(", "));
  }
  if (d.weights.length) out.push("Peso registrado: " + d.weights.map((w) => `${w.date.slice(5)}: ${w.value} kg`).join(", "));

  if (d.reference?.length) {
    const st = { raw: " crudo", cooked: " cocinado" } as const;
    out.push(
      "Valores de referencia por 100 g de la base de alimentos de la app (úsalos para las cuentas en vez de tus estimaciones): " +
        d.reference.map((f) => `${clean(f.name)}${f.state ? st[f.state] : ""} ${r(f.kcal_100g)} kcal (P ${f.protein_100g}, H ${f.carbs_100g}, G ${f.fat_100g})${f.serving_g ? `; 1 unidad/ración = ${f.serving_g} g = ${r((f.kcal_100g * f.serving_g) / 100)} kcal` : ""}`).join("; "),
    );
  }

  // Conversiones crudo<->cocinado y equivalencias entre alimentos mencionados, calculadas aquí (no por el modelo).
  const hints = d.reference?.length ? buildEquivalenceHints(d.reference) : [];
  if (hints.length) out.push("Equivalencias ya calculadas con esos valores (úsalas tal cual y escala linealmente):", ...hints.map((h) => `- ${h}`));

  if (d.diets.length) {
    out.push("Dietas guardadas (opciones por comida; las kcal y macros de cada opción son los de la PRIMERA alternativa de cada alimento, y lo que va entre paréntesis son alternativas que pueden cambiar las kcal):");
    for (const diet of d.diets) {
      out.push(`- Dieta «${clean(diet.name)}»${diet.notes ? ` (notas: ${clean(diet.notes)})` : ""}`);
      for (const m of MEALS) {
        const os = diet.options.filter((o) => o.meal === m.id);
        if (os.length)
          out.push(`  ${m.label}: ` + os.map((o) => `${clean(o.name)} ${r(o.kcal)} kcal (P ${r(o.protein_g)}, H ${r(o.carbs_g)}, G ${r(o.fat_g)})${withItems ? ` [${o.items.map(clean).join(", ")}]` : ""}`).join(" | "));
      }
    }
  }
  return out;
}

// Texto de contexto para el asistente. Si se pasa del tope, se omite primero el detalle de alimentos de las dietas.
export function buildContext(d: AiData): string {
  let text = sections(d, true).join("\n");
  if (text.length > MAX_CHARS) text = sections(d, false).join("\n");
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n[…contexto recortado]" : text;
}
