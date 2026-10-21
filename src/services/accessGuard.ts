const ACCESS_CODE_STORAGE_KEY = 'JJK_SERVER_ACCESS_CODE';

/** Código de acesso opcional do servidor (APP_ACCESS_CODE), salvo no navegador. */
export function getAccessCode(): string {
  try {
    return (localStorage.getItem(ACCESS_CODE_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function getAccessHeaders(): Record<string, string> {
  const code = getAccessCode();
  return code ? { 'x-access-code': code } : {};
}
