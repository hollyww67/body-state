const USERNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "api",
  "body-state",
  "bodystate",
]);

export function normalizeUsername(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("ru-RU");
}

export function validateUsername(value: unknown) {
  const username = normalizeUsername(value);

  if (username.length < 3 || username.length > 32) {
    return { username, error: "Логин должен содержать от 3 до 32 символов" };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return { username, error: "Используйте буквы, цифры, точку, дефис или нижнее подчёркивание" };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return { username, error: "Этот логин недоступен" };
  }

  return { username, error: null };
}

export function validatePassword(value: unknown) {
  const password = String(value ?? "");

  if (password.length < 10) {
    return { password, error: "Пароль должен содержать не менее 10 символов" };
  }

  if (password.length > 256) {
    return { password, error: "Пароль слишком длинный" };
  }

  if (!/[\p{L}]/u.test(password) || !/\d/u.test(password)) {
    return { password, error: "Добавьте хотя бы одну букву и одну цифру" };
  }

  return { password, error: null };
}
