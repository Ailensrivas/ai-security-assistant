import type { AccessKind, Explanation, ExplanationText, Finding, Lang, RuleId } from "../types";

/**
 * Hand-written text.
 * - TITLES always come from here (never from the AI): they state exactly what
 *   the rule observed, so they can't exaggerate ("more than needed") or name
 *   access that wasn't detected.
 * - WHY and STEPS come from here when there is no AI key, the AI fails or refuses.
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many).replaceAll("{n}", String(n));

const KIND: Record<Lang, Record<AccessKind, string>> = {
  en: { gmail: "Gmail", drive: "Google Drive", admin: "the Admin console" },
  es: { gmail: "Gmail", drive: "Google Drive", admin: "la consola de administración" },
};

function listOf(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join("");
  const and = lang === "es" ? " y " : " and ";
  return items.slice(0, -1).join(", ") + and + items.at(-1);
}

/** Deterministic title built only from what the rule detected. */
export function titleFor(f: Finding, lang: Lang): string {
  const n = f.count;
  const es = lang === "es";
  switch (f.ruleId) {
    case "MFA_MISSING_ADMIN":
      return es
        ? plural(n, "1 cuenta de administrador sin verificación en 2 pasos", "{n} cuentas de administrador sin verificación en 2 pasos")
        : plural(n, "1 admin account without 2-Step Verification", "{n} admin accounts without 2-Step Verification");
    case "MFA_MISSING_USER":
      return es
        ? plural(n, "1 empleado sin verificación en 2 pasos", "{n} empleados sin verificación en 2 pasos")
        : plural(n, "1 user without 2-Step Verification", "{n} users without 2-Step Verification");
    case "EXTERNAL_FORWARDING":
      return es
        ? plural(n, "1 buzón reenvía correos a una dirección externa", "{n} buzones reenvían correos a direcciones externas")
        : plural(n, "1 mailbox forwards email to an outside address", "{n} mailboxes forward email to outside addresses");
    case "TOO_MANY_ADMINS":
      return es
        ? `${n} cuentas tienen permisos de superadministrador`
        : `${n} accounts have super admin permissions`;
    case "PUBLIC_FILES":
      return es
        ? plural(n, "1 archivo abierto a cualquiera con el enlace", "{n} archivos abiertos a cualquiera con el enlace")
        : plural(n, "1 file open to anyone with the link", "{n} files open to anyone with the link");
    case "RISKY_THIRD_PARTY_APPS": {
      const kinds = listOf((f.details.accessKinds ?? []).map((k) => KIND[lang][k]), lang);
      if (n === 1 && f.details.appName) {
        return es ? `${f.details.appName} tiene acceso amplio a ${kinds}` : `${f.details.appName} has broad access to ${kinds}`;
      }
      return es ? `${n} apps externas tienen acceso amplio a ${kinds}` : `${n} outside apps have broad access to ${kinds}`;
    }
    case "INACTIVE_ACCOUNTS": {
      const days = f.details.maxInactiveDays;
      if (n === 1) {
        if (days == null) return es ? "1 cuenta activa que nunca ha iniciado sesión" : "1 active account that has never signed in";
        return es ? `1 cuenta activa sin iniciar sesión en ${days} días` : `1 active account with no sign-in for ${days} days`;
      }
      return es ? `${n} cuentas activas sin iniciar sesión en más de 90 días` : `${n} active accounts with no sign-in for over 90 days`;
    }
  }
}

/** What the "view affected" button says, so people know what they will see. */
export function affectedLabel(ruleId: RuleId, n: number, lang: Lang): string {
  const es = lang === "es";
  switch (ruleId) {
    case "PUBLIC_FILES":
      return es ? `Ver archivos (${n})` : `View files (${n})`;
    case "RISKY_THIRD_PARTY_APPS":
      return es ? `Ver apps (${n})` : `View apps (${n})`;
    case "EXTERNAL_FORWARDING":
      return es ? `Ver reenvíos (${n})` : `View forwarding (${n})`;
    default:
      return es ? `Ver cuentas (${n})` : `View accounts (${n})`;
  }
}

type Body = Omit<ExplanationText, "title">;

const BODIES: Record<RuleId, Record<Lang, Body>> = {
  MFA_MISSING_ADMIN: {
    en: {
      why: "Admins can change everything in your company account. If one admin password leaks, an attacker can take over all email and files. 2-Step Verification blocks most of these attacks.",
      steps: ["Ask each admin to turn on 2-Step Verification today.", "Then enforce it for admins in Security > 2-Step Verification."],
    },
    es: {
      why: "Un administrador puede cambiar todo en la cuenta de la empresa. Si se filtra su contraseña, un atacante puede tomar todos los correos y archivos. La verificación en 2 pasos bloquea la mayoría de estos ataques.",
      steps: ["Pide a cada administrador que active la verificación en 2 pasos hoy.", "Después hazla obligatoria para administradores en Seguridad > Verificación en 2 pasos."],
    },
  },
  MFA_MISSING_USER: {
    en: {
      why: "Reused or phished passwords are the most common way into small-business email. A second step (phone prompt or code) stops an attacker who only has the password.",
      steps: ["Send the affected users a short guide to turn on 2-Step Verification.", "Give them 1–2 weeks, then enforce it for everyone."],
    },
    es: {
      why: "Las contraseñas repetidas o robadas con correos falsos son la forma más común de entrar al correo de una pyme. Un segundo paso (aviso en el celular o un código) detiene al atacante que solo tiene la contraseña.",
      steps: ["Envía a esos usuarios una guía corta para activar la verificación en 2 pasos.", "Dales 1 o 2 semanas y luego hazla obligatoria para todos."],
    },
  },
  EXTERNAL_FORWARDING: {
    en: {
      why: "Forwarding can be legitimate, but attackers who break into a mailbox often add a hidden forwarding rule to keep reading every email. Either way, client data is leaving the company.",
      steps: ["Ask the mailbox owner whether they set up the forwarding and why.", "If nobody authorized it, turn it off and change that user's password.", "Consider blocking automatic forwarding to outside addresses."],
    },
    es: {
      why: "El reenvío puede ser legítimo, pero quien entra a un buzón suele crear una regla oculta para seguir leyendo todos los correos. En cualquier caso, datos de clientes están saliendo de la empresa.",
      steps: ["Pregunta a la persona dueña del buzón si configuró el reenvío y por qué.", "Si nadie lo autorizó, desactívalo y cambia la contraseña de ese usuario.", "Considera bloquear el reenvío automático a direcciones externas."],
    },
  },
  TOO_MANY_ADMINS: {
    en: {
      why: "Every super admin account is a master key to the company. Check whether each of these accounts really needs that level of access; most small businesses need one or two.",
      steps: ["Review who has the Super Admin role in Account > Admin roles.", "For anyone who doesn't need it, switch to a regular account or a limited admin role.", "Make sure the remaining admins use 2-Step Verification."],
    },
    es: {
      why: "Cada cuenta de superadministrador es una llave maestra de la empresa. Revisa si cada una de estas cuentas realmente necesita ese nivel de acceso; la mayoría de las pymes necesitan una o dos.",
      steps: ["Revisa quién tiene el rol de superadministrador en Cuenta > Funciones de administrador.", "A quien no lo necesite, déjale una cuenta normal o un rol de administrador limitado.", "Asegúrate de que los administradores que queden usen verificación en 2 pasos."],
    },
  },
  PUBLIC_FILES: {
    en: {
      why: "Anyone who gets the link can open these files without signing in. Links get forwarded and pasted in chats, and these files may contain client data.",
      steps: ["Ask each owner to open the file, click Share and change General access to Restricted.", "Share it only with the people who need it.", "Consider limiting outside sharing in the Drive sharing settings."],
    },
    es: {
      why: "Cualquiera que consiga el enlace puede abrir estos archivos sin iniciar sesión. Los enlaces se reenvían y se pegan en chats, y estos archivos pueden tener datos de clientes.",
      steps: ["Pide a cada dueño que abra el archivo, haga clic en Compartir y cambie el acceso general a Restringido.", "Compártelo solo con las personas que lo necesitan.", "Considera limitar el uso compartido externo en la configuración de Drive."],
    },
  },
  INACTIVE_ACCOUNTS: {
    en: {
      why: "Accounts nobody uses, often former employees, still have access to company data, and nobody would notice if someone else started using them.",
      steps: ["Check whether this person still works with you.", "If not, transfer their files and suspend the account (the data is kept)."],
    },
    es: {
      why: "Las cuentas que nadie usa, muchas veces de exempleados, siguen teniendo acceso a los datos de la empresa y nadie notaría si otra persona empezara a usarlas.",
      steps: ["Revisa si esa persona todavía trabaja contigo.", "Si ya no, transfiere sus archivos y suspende la cuenta (los datos se conservan)."],
    },
  },
  RISKY_THIRD_PARTY_APPS: {
    en: {
      why: "This access lets the app read or change everything of that type for the user. If the app is malicious or gets hacked, that data is exposed.",
      steps: ["Ask the user if they still need the app.", "If not, or if you don't trust it, block it in Security > API controls > Manage third-party app access."],
    },
    es: {
      why: "Ese acceso permite que la app lea o cambie todo ese contenido del usuario. Si la app es maliciosa o la hackean, esos datos quedan expuestos.",
      steps: ["Pregunta al usuario si todavía necesita la app.", "Si no, o si no confías en ella, bloquéala en Seguridad > Controles de API > Administrar acceso de apps de terceros."],
    },
  },
};

export function templateBody(ruleId: RuleId, lang: Lang): Body {
  const b = BODIES[ruleId][lang];
  return { why: b.why, steps: [...b.steps] };
}

/** Reference meaning of each rule in English, given to the AI so it stays consistent. */
export function referenceWhy(ruleId: RuleId): string {
  return BODIES[ruleId].en.why;
}

export function templateExplanation(f: Finding): Explanation {
  return {
    en: { title: titleFor(f, "en"), ...templateBody(f.ruleId, "en") },
    es: { title: titleFor(f, "es"), ...templateBody(f.ruleId, "es") },
  };
}

export function templateSummary(findings: Finding[], score: number): { en: string; es: string } {
  if (findings.length === 0) {
    return {
      en: `Score ${score}/100. No common risks found. Run a new check every month.`,
      es: `Nota ${score}/100. No se encontraron riesgos comunes. Haz una revisión nueva cada mes.`,
    };
  }
  const first = findings[0];
  return {
    en: `Start with: ${titleFor(first, "en")}. Then follow the list in order.`,
    es: `Empieza por: ${titleFor(first, "es")}. Luego sigue la lista en orden.`,
  };
}
