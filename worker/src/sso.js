// Sesión única SABI: token firmado (HMAC-SHA256) en la cookie sabi_sso del dominio .sabicentec.com.
// Lo emite sabicentec.com/ingresar y lo verifica cualquier app SABI que tenga el mismo secreto SSO_SECRET.
const te = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function llave(secreto) { return crypto.subtle.importKey('raw', te.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function firmar(payload, secreto) {
  const p = b64u(te.encode(JSON.stringify(payload)));
  const s = b64u(await crypto.subtle.sign('HMAC', await llave(secreto), te.encode(p)));
  return `${p}.${s}`;
}
export async function verificar(token, secreto) {
  if (!token || !secreto) return null;
  const [p, s] = token.split('.');
  if (!p || !s) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await llave(secreto), deB64u(s), te.encode(p));
    if (!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(deB64u(p)));
    return d.exp * 1000 > Date.now() ? d : null;
  } catch (e) { return null; }
}
export function leerCookie(req, nombre) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}
export const HORAS = 10;
// dominio = 'sabicentec.com' en producción (la cookie llega a todos los subdominios); vacío solo en pruebas locales
const dom = d => d === '' ? '' : `Domain=${d || 'sabicentec.com'}; `;
export const cookieSSO = (t, horas = HORAS, d) => `sabi_sso=${t}; ${dom(d)}Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.round(horas * 3600)}`;
export const cookieSSOBorrar = d => `sabi_sso=; ${dom(d)}Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
// Normaliza nombres y cargos: sin tildes, minúsculas, espacios simples
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-zñ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
