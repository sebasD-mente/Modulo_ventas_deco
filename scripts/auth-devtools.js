/**
 * scripts/auth-devtools.js
 * Inyección de Sesión Directa para Chrome DevTools MCP & Aserción DOM
 * Bypass total del escudo antibot de Google OAuth en navegadores remotos.
 */

export const DEVTOOLS_AUTH_SNIPPET = `(() => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjMwYmI0NzEyLWY1NTEtNDE4ZS1iYjAzLTVlZWI2MDAxNWY2OCIsImVtYWlsIjoic2ViYXNqaW1lbmV6MDMzMEBnbWFpbC5jb20iLCJmdWxsTmFtZSI6IlNlYmFzdGlhbiBKaW1lbmV6Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwicm9sZXMiOlsiU1VQRVJfQURNSU4iLCJWRU5ERURPUiJdLCJ0ZW5hbnRJZCI6IjU4YjgyOWE0LTEwMDYtNDFjMi04ZTkwLWIwNjEwMjMwYzI1ZiIsImFzc2lnbmVkRXZlbnRJZCI6bnVsbCwiYXZhdGFyVXJsIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSTdWd21jNTA1SjM4Q3pVelpmTVc4ZExpVk1XLUdLblZFS2xGMFp4ZXpmTkFDb1pmU2J5QT1zOTYtYyIsImlhdCI6MTc4OTg1NTAxOSwiZXhwIjoxNzkwNDU5ODE5fQ.nq092yGPMQ2Bcmer1772Qr_J6VZumGPYCDWJsb5ouco";
  
  const user = {
    id: "30bb4712-f551-418e-bb03-5eeb60015f68",
    email: "sebasjimenez0330@gmail.com",
    fullName: "Sebastian Jimenez",
    role: "SUPER_ADMIN",
    roles: ["SUPER_ADMIN", "VENDEDOR"],
    tenantId: "58b829a4-1006-41c2-8e90-b0610230c25f",
    assignedEventId: null,
    avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocI7Vwmc505J38CzUzZfMW8dLiVMW-GKnVEKlF0ZxezfNACoZfSbyA=s96-c"
  };
  const activeEvent = {
    id: "4426d955-39bc-438e-a5eb-529e4b9277e2",
    tenantId: "58b829a4-1006-41c2-8e90-b0610230c25f",
    name: "Feria de Emprendedores",
    location: "Cayalá Plaza Central",
    status: "ACTIVO"
  };
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('deko_auth_token', token);
  localStorage.setItem('deko_auth_user', JSON.stringify(user));
  localStorage.setItem('deko_active_event', JSON.stringify(activeEvent));
  setTimeout(() => location.reload(), 100);
  return { status: "AUTH_INJECTED", user: user.email, role: user.role, event: activeEvent.name };
})()`;

export const DOM_ASSERTION_SNIPPET = `(() => {
  const errors = [];
  
  // 1. Validar que no haya mensajes duplicados del bot en burbujas de usuario
  const userBubbles = Array.from(document.querySelectorAll('.chat-bubble-user, [data-sender="user"]'));
  const hasBotLeak = userBubbles.some(b => b.textContent.includes('¡Buenísima elección!') || b.textContent.includes('¡Hola!') || b.textContent.includes('[Modo Offline]'));
  if (hasBotLeak) errors.push("CRÍTICO: Fuga de texto de IA dentro de burbuja de usuario (Duplicación detectada)");
  
  // 2. Validar que al pedir catálogo existan tarjetas visuales en pantalla
  const catalogCards = document.querySelectorAll('.catalog-card, [data-testid="poster-card"], .draft-card');
  if (catalogCards.length === 0) errors.push("CRÍTICO: Hay 0 tarjetas interactivas de catálogo/borrador en el DOM");
  
  return { pass: errors.length === 0, errors, userBubblesCount: userBubbles.length, catalogCardsCount: catalogCards.length };
})()`;

console.log('🔑 [DevTools Auth Snippet — Copy & Execute in evaluate_script]:');
console.log(DEVTOOLS_AUTH_SNIPPET);
console.log('\n👁️ [DOM Visual Assertion Snippet]:');
console.log(DOM_ASSERTION_SNIPPET);
