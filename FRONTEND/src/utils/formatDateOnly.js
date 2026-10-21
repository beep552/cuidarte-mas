/**
 * HAL-36: formateo de fechas "DATE" (sin hora) sin interpretación UTC/local,
 * que causaba que la fecha de nacimiento se mostrara un día antes en
 * zonas UTC-3/-4. La API entrega "2000-01-01T00:00:00.000Z"; aquí se toma
 * la parte YYYY-MM-DD y se muestra dd-mm-yyyy (convención es-CL).
 */
export function formatDateOnly(fecha) {
  if (!fecha) return "-";
  const iso = typeof fecha === "string" ? fecha : null;
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "-";
  const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return `${d}-${m}-${y}`;
}
