import type { Decision, Lang, Severity } from "./types";

export function parseLang(value: string | string[] | undefined): Lang {
  return value === "es" ? "es" : "en";
}

export const UI = {
  en: {
    tagline: "Security check-up for small businesses on Google Workspace",
    runScan: "Run security check",
    rerun: "Check again",
    running: "Checking… (up to 1 minute)",
    resetDemo: "Restart demo",
    noScan: "No check has been run yet. Click the button to analyze your company account.",
    demoNote: "Demo mode: a fictional company with problems planted on purpose.",
    publicDemoNote: "You have your own copy; it is deleted after 7 days.",
    rateLimited: "You reached the demo limit of checks for this hour. You can keep using the last check.",
    // next action
    critical: (n: number) => (n === 1 ? "1 critical risk" : `${n} critical risks`),
    risksOpen: (n: number) => (n === 1 ? "1 risk to fix" : `${n} risks to fix`),
    startWith: "Start with",
    seeHow: "See how to fix it",
    allPending: (n: number) => `You marked ${n} fix${n === 1 ? "" : "es"} as done. Run a new check to confirm ${n === 1 ? "it" : "them"}.`,
    allClear: "No open risks. Run a new check every month.",
    // list
    risks: "Risks",
    viewSteps: "View steps",
    hideSteps: "Hide steps",
    howToFix: "How to fix it",
    openAdmin: "Open in Google Admin",
    markPending: "Mark as pending verification",
    markPendingHelp: "Use this after you make the change in Google Admin. The next check confirms it.",
    acceptRisk: "Accept risk",
    acceptRiskHelp: "Keeps it on the list as an accepted exception. It is not hidden.",
    undo: "Undo",
    stillDetected: "The latest check still detects it. Make the change in Google Admin and check again.",
    // fixed
    fixedTitle: "Fixed",
    fixedConfirmed: (date: string) => `Fixed · confirmed by the check on ${date}`,
    fixedSimulated: "Fixed · simulated verification (demo)",
    // progress
    progress: "Progress",
    score: "Security score",
    lastCheck: "Last check",
    history: "Previous checks",
    aiNote: "Titles and risk levels come from fixed rules. The explanations were written by AI, which cannot change them.",
    templateNote: "Titles and risk levels come from fixed rules. Standard explanations (AI not configured or unavailable).",
    humanNote: "Nothing in your account is changed automatically.",
  },
  es: {
    tagline: "Revisión de seguridad para pequeñas empresas en Google Workspace",
    runScan: "Revisar seguridad",
    rerun: "Volver a revisar",
    running: "Revisando… (puede tardar hasta 1 minuto)",
    resetDemo: "Reiniciar demo",
    noScan: "Todavía no se ha hecho ninguna revisión. Haz clic en el botón para analizar la cuenta de tu empresa.",
    demoNote: "Modo demo: una empresa ficticia con problemas puestos a propósito.",
    publicDemoNote: "Tienes tu propia copia; se borra a los 7 días.",
    rateLimited: "Llegaste al límite de revisiones del demo en esta hora. Puedes seguir usando la última revisión.",
    critical: (n: number) => (n === 1 ? "1 riesgo crítico" : `${n} riesgos críticos`),
    risksOpen: (n: number) => (n === 1 ? "1 riesgo por corregir" : `${n} riesgos por corregir`),
    startWith: "Empieza por",
    seeHow: "Ver cómo corregirlo",
    allPending: (n: number) =>
      n === 1
        ? "Marcaste 1 corrección como hecha. Haz una revisión nueva para confirmarla."
        : `Marcaste ${n} correcciones como hechas. Haz una revisión nueva para confirmarlas.`,
    allClear: "No hay riesgos abiertos. Haz una revisión nueva cada mes.",
    risks: "Riesgos",
    viewSteps: "Ver pasos",
    hideSteps: "Ocultar pasos",
    howToFix: "Cómo corregirlo",
    openAdmin: "Abrir en Google Admin",
    markPending: "Marcar como pendiente de verificar",
    markPendingHelp: "Úsalo después de hacer el cambio en Google Admin. La próxima revisión lo confirma.",
    acceptRisk: "Aceptar el riesgo",
    acceptRiskHelp: "Queda en la lista como excepción aceptada. No se oculta.",
    undo: "Deshacer",
    stillDetected: "La última revisión todavía lo detecta. Haz el cambio en Google Admin y vuelve a revisar.",
    fixedTitle: "Corregido",
    fixedConfirmed: (date: string) => `Corregido · confirmado en la revisión del ${date}`,
    fixedSimulated: "Corregido · verificación simulada (demo)",
    progress: "Progreso",
    score: "Nota de seguridad",
    lastCheck: "Última revisión",
    history: "Revisiones anteriores",
    aiNote: "Los títulos y niveles de riesgo salen de reglas fijas. Las explicaciones las escribió una IA, que no puede cambiarlos.",
    templateNote: "Los títulos y niveles de riesgo salen de reglas fijas. Explicaciones estándar (IA no configurada o no disponible).",
    humanNote: "Nada en tu cuenta se cambia automáticamente.",
  },
} as const;

export const SEVERITY_LABEL: Record<Lang, Record<Severity, string>> = {
  en: { critical: "Critical", high: "High", medium: "Medium", low: "Low" },
  es: { critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo" },
};

export const DECISION_LABEL: Record<Lang, Record<Decision, string>> = {
  en: { open: "Open", pending: "Pending verification", accepted: "Accepted risk (exception)" },
  es: { open: "Abierto", pending: "Pendiente de verificar", accepted: "Riesgo aceptado (excepción)" },
};

export function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
