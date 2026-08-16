/**
 * Romanian Phone Number Normalization Utility
 *
 * Conservative contract: Normalizes Romanian phone numbers to digits-only format (40XXXXXXXXX).
 * Anything that cannot be confidently identified as a Romanian number is returned as digits-only,
 * unchanged, to preserve foreign numbers and malformed entries safely.
 */

/**
 * Normalizes Romanian phone numbers to digits-only format: 40XXXXXXXXX (11 digits).
 *
 * Ordered rules:
 * 0. If input is null/undefined/empty -> return null
 * 1. Strip all non-digit characters -> d
 * 2. While d starts with "0040" -> remove the leading "00" (0040XXXXXXXXX -> 40XXXXXXXXX)
 * 3. While d starts with "4040" AND length > 11 -> remove the leading "40"
 * 4. If d starts with "400" AND length === 12 -> "40" + d.substring(3)
 * 5. If d starts with "0" AND length === 10 -> "40" + d.substring(1)
 * 6. If length === 9 AND first digit is one of 7,2,3,8 -> "40" + d
 * 7. Otherwise return d unchanged
 * 8. If the final result has fewer than 6 digits -> return null (too short to be a phone)
 *
 * @param {string} raw
 * @returns {string|null}
 */
const normalizeRoPhone = (raw) => {
  // 0. If input is null/undefined/empty -> return null
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // 1. Strip all non-digit characters -> d
  let d = str.replace(/\D/g, "");

  // 2. While d starts with "0040" -> remove the leading "00"
  while (d.startsWith("0040")) {
    d = d.substring(2);
  }

  // 3. While d starts with "4040" AND length > 11 -> remove the leading "40"
  while (d.startsWith("4040") && d.length > 11) {
    d = d.substring(2);
  }

  // 4. If d starts with "400" AND length === 12 -> "40" + d.substring(3)
  if (d.startsWith("400") && d.length === 12) {
    d = "40" + d.substring(3);
  }

  // 5. If d starts with "0" AND length === 10 -> "40" + d.substring(1)
  if (d.startsWith("0") && d.length === 10) {
    d = "40" + d.substring(1);
  }

  // 6. If length === 9 AND first digit is one of 7,2,3,8 -> "40" + d
  if (
    d.length === 9 &&
    (d.startsWith("7") || d.startsWith("2") || d.startsWith("3") || d.startsWith("8"))
  ) {
    d = "40" + d;
  }

  // 7. Otherwise return d unchanged (handled implicitly by falling through)

  // 8. If the final result has fewer than 6 digits -> return null
  if (d.length < 6) {
    return null;
  }

  return d;
};

/**
 * Checks whether a normalized phone number is a Romanian mobile number.
 * Returns true only when the value is exactly 11 digits and starts with "407".
 *
 * @param {string} normalized
 * @returns {boolean}
 */
const isRoMobile = (normalized) => {
  if (!normalized || typeof normalized !== "string") return false;
  return normalized.length === 11 && normalized.startsWith("407");
};

module.exports = { normalizeRoPhone, isRoMobile };
