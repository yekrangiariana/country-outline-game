export function countryCodeToFlagEmoji(countryCode) {
  const clean = String(countryCode || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) {
    return "";
  }

  const first = clean.codePointAt(0) + 127397;
  const second = clean.codePointAt(1) + 127397;
  return String.fromCodePoint(first, second);
}

export function formatCountryWithFlag(countryName, countryCode) {
  const name = String(countryName || "").trim();
  const flag = countryCodeToFlagEmoji(countryCode);
  if (!name) {
    return flag;
  }
  return flag ? `${name} ${flag}` : name;
}
