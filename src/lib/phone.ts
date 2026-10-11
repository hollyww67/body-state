export function formatRussianPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length <= 10 && !digits.startsWith("7") && !digits.startsWith("8")) {
    digits = `7${digits}`;
  } else if (digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (!digits.startsWith("7")) {
    digits = `7${digits}`;
  }

  digits = digits.slice(0, 11);
  const national = digits.slice(1);
  let result = "+7";
  if (national.length) result += ` (${national.slice(0, 3)}`;
  if (national.length >= 3) result += ")";
  if (national.length > 3) result += ` ${national.slice(3, 6)}`;
  if (national.length > 6) result += `-${national.slice(6, 8)}`;
  if (national.length > 8) result += `-${national.slice(8, 10)}`;
  return result;
}

export function russianPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits;
}
