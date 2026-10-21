// src/lib/alertText.js
// ---------------------------------------------------------------------------
// The Spring Boot service composes alert messages in French, and a few rows
// were persisted with a UTF-8 → Latin-1 artefact ("TempǸrature ... 80.0��C").
// The product UI is English, so we normalise the known templates on the client
// instead of touching the backend. Unrecognised messages are returned as-is —
// this is a presentation helper, never a source of truth.
// ---------------------------------------------------------------------------

// Fix the mojibake that leaked into older rows before matching anything.
function repairEncoding(value) {
  return value
    .replace(/Ǹ/g, "é")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã /g, "à")
    .replace(/Ã§/g, "ç")
    // "80.0��C" → "80.0°C"
    .replace(/(\d(?:[.,]\d+)?)\s*\uFFFD+\s*(C|F)\b/g, "$1°$2")
    .replace(/\uFFFD+/g, "");
}

// "TEMPERATURE" → "Temperature"; short codes such as "RPM" stay untouched.
function sensorLabel(raw) {
  const type = String(raw || "").trim();
  if (!type) return "Sensor";
  if (/^[A-Z0-9 _-]+$/.test(type) && type.length > 4) {
    return type
      .toLowerCase()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return type;
}

const TYPE_WORDS = {
  "température": "temperature",
  "temperature": "temperature",
  "vibration": "vibration",
};

export function formatAlertMessage(raw) {
  if (!raw) return "";
  const s = repairEncoding(String(raw)).replace(/\s+/g, " ").trim();

  // "Capteur CURRENT hors ligne sur la machine BLB-008 (inactif depuis > 30s)"
  let m = s.match(
    /^Capteur\s+(.+?)\s+hors ligne sur la machine\s+(.+?)(?:\s*\(inactif depuis\s*>\s*(\d+)\s*s\))?\.?$/i
  );
  if (m) {
    const sensor = sensorLabel(m[1]);
    const code = m[2].trim();
    const secs = m[3];
    return `${sensor} sensor offline on machine ${code}${secs ? ` (inactive for over ${secs}s)` : ""}`;
  }

  // "Température critique détectée: 80.0°C (seuil: 80.0°C)"
  // "Vibration élevée détectée: 5.0 mm/s (seuil: 4.5 mm/s)"
  m = s.match(
    /^(Température|Temperature|Vibration)\s+(critique|élevée|elevee|haute)\s+détectée\s*:\s*(.+?)\s*\(seuil\s*:\s*(.+?)\)\.?$/i
  );
  if (m) {
    const kind = TYPE_WORDS[m[1].toLowerCase()] || m[1].toLowerCase();
    const severity = /^critique$/i.test(m[2]) ? "Critical" : "High";
    return `${severity} ${kind} detected: ${m[3].trim()} (threshold: ${m[4].trim()})`;
  }

  return s;
}

// ---------------------------------------------------------------------------
// Notifications — same problem: French copy, plus the emoji was written as
// "??" when the row was persisted. Titles follow two templates in
// NotificationService: an alert and a maintenance assignment.
// ---------------------------------------------------------------------------

const SEVERITY_WORDS = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  WARNING: "Warning",
  LOW: "Low",
  INFO: "Info",
};

export function formatNotificationTitle(raw) {
  const s = repairEncoding(String(raw || ""))
    .replace(/^[?\uFFFD]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  // "🚨 ALERTE CRITICAL - Machine GEN-001"
  let m = s.match(/^ALERTE\s+([A-Za-z]+)\s*[-·]\s*Machine\s+(.+)$/i);
  if (m) {
    const severity = SEVERITY_WORDS[m[1].toUpperCase()] || m[1];
    return `Alert ${severity} · Machine ${m[2].trim()}`;
  }

  if (/^Nouvelle intervention de maintenance assignée$/i.test(s)) {
    return "New maintenance intervention assigned";
  }

  return s;
}

export function formatNotificationMessage(raw) {
  const repaired = repairEncoding(String(raw || "")).replace(/\s+/g, " ").trim();
  if (!repaired) return "";

  let s = repaired.replace(
    /^Vous avez été assigné\s*.*?(?:l'intervention|intervention)\s*:\s*/i,
    "You have been assigned to intervention: "
  );
  if (s !== repaired) return s;

  s = repaired.replace(
    /^Dépassement de seuil détecté\s*:\s*valeur\s*/i,
    "Threshold exceeded: value "
  );
  if (s !== repaired) return s;

  // Alert bodies reuse the alert translator ("Capteur … hors ligne", etc.).
  return formatAlertMessage(repaired);
}

export default formatAlertMessage;
