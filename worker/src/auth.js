// Inicio de sesión propio del Sistema de Planeación CENTEC (sin costo por usuario, sin límite de cuentas).
// - Claves guardadas como hash PBKDF2-SHA256 (100.000 iteraciones) con sal aleatoria; nunca en texto.
// - Sesión: token aleatorio en cookie HttpOnly + Secure + SameSite=Strict; en la base solo se guarda su hash.
// - Bloqueo de 15 minutos tras 5 intentos fallidos por correo.
// - Primer ingreso de un administrador: correos en el secreto ADMINS entran una sola vez con el secreto
//   CLAVE_INICIAL y el sistema les obliga a crear su clave personal.
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
export const ITER = 100000;
export const SESION_HORAS = 12;
export const MAX_FALLOS = 5;
export const BLOQUEO_MIN = 15;

export async function sha256hex(t) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(t))); }
export function aleatorio(bytes = 32) { return hex(crypto.getRandomValues(new Uint8Array(bytes))); }

export async function hashClave(clave, salHex = aleatorio(16)) {
  const k = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salHex), iterations: ITER }, k, 256);
  return { hash: hex(bits), sal: salHex };
}
export function igualSeguro(a, b) { // comparación en tiempo constante
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export async function verificarClave(clave, hashHex, salHex) {
  if (!hashHex || !salHex) return false;
  return igualSeguro((await hashClave(clave, salHex)).hash, hashHex);
}
export function claveValida(c) {
  return typeof c === 'string' && c.length >= 10 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(c) && /\d/.test(c);
}
// Clave temporal legible para entregar en persona (sin caracteres confusos)
export function claveTemporal() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  let s = ''; for (const x of r) s += A[x % A.length];
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8) + '7';
}
export function leerCookie(req, nombre) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}
export function cookieSesion(token, horas = SESION_HORAS) {
  return `sid=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.round(horas * 3600)}`;
}
export const cookieBorrar = 'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
