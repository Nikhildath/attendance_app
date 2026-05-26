/**
 * Holidays are managed by admins in the `company_holidays` table (Supabase).
 * They are NOT fetched from any external calendar service.
 * Holiday determination is purely shift-based:
 *   - A day is a holiday if it appears in company_holidays AND the user's shift
 *     does NOT have work_on_holidays = true.
 */

export type CompanyHoliday = {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
  kind: "public" | "restricted" | "optional";
  branch_id: string | null;
  region: string;
};

/**
 * Returns the holiday record for a given date (y, m is 0-indexed, d is 1-indexed),
 * or undefined if there is no holiday on that date.
 */
export function holidayOnDate(
  holidays: CompanyHoliday[],
  y: number,
  m: number,
  d: number
): CompanyHoliday | undefined {
  const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return holidays.find((h) => h.date === iso);
}

/**
 * Given a list of company holidays and a shift's work_on_holidays flag,
 * determines if a given date is effectively a holiday for that shift.
 *
 * Returns false (not a holiday) when the shift requires working on holidays.
 */
export function isEffectiveHoliday(
  holidays: CompanyHoliday[],
  date: Date,
  shiftWorksOnHolidays: boolean
): boolean {
  if (shiftWorksOnHolidays) return false;
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return !!holidayOnDate(holidays, y, m, d);
}
