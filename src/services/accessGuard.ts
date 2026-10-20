const ACCESS_CODE_STORAGE_KEY = 'JJK_SERVER_ACCESS_CODE';

/** Código de acesso opcional do servidor (APP_ACCESS_CODE), salvo no navegador. */
export function getAccessCode(): string {
  try {
    return (localStorage.getItem(ACCESS_CODE_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setAccessCode(code: string): void {
  try {
    const clean = (code || '').trim();
    if (clean) localStorage.setItem(ACCESS_CODE_STORAGE_KEY, clean);
    else localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
  } catch {
    // localStorage indisponível (modo privado): o código vale só na sessão.
  }
}

export function getAccessHeaders(): Record<string, string> {
  const code = getAccessCode();
  return code ? { 'x-access-code': code } : {};
}
