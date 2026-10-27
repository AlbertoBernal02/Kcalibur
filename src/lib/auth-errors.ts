// Traduce los errores habituales de Supabase Auth a mensajes claros en español.
export function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email o contraseña incorrectos.";
  if (/signups? (not allowed|(are )?disabled)|signup.*disabled/i.test(message)) return "El registro está cerrado: esta app es privada.";
  if (/already registered/i.test(message)) return "Ese email ya tiene cuenta. Inicia sesión.";
  if (/password should be at least/i.test(message)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/different from the old password/i.test(message)) return "La nueva contraseña debe ser distinta de la actual.";
  if (/email not confirmed/i.test(message)) return "Confirma tu email antes de entrar.";
  if (/rate limit|too many/i.test(message)) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  if (/code verifier|invalid.*(code|grant)|expired|invalid.*token/i.test(message)) return "El enlace no es válido o ha caducado. Pide uno nuevo.";
  if (/fetch|network|load failed/i.test(message)) return "No hay conexión con el servidor.";
  return message;
}
