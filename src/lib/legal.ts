export const CONSENT_VERSION = "2026-08-24";

export const legalDetails = {
  operator: "Танчук Алёна Васильевна",
  inn: "343508662268",
  ogrnip: process.env.NEXT_PUBLIC_OPERATOR_OGRNIP || "",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || "",
  email: "at@body-state.ru",
  phone: "+7 (926) 426-91-46",
  site: "https://body-state.ru",
};

export function hasPersonalDataConsent(value: unknown): boolean {
  return value === true;
}
