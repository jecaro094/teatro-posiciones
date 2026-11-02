// Modo admin: solo él puede editar elenco, escenas y posiciones.
let admin = false;
export const isAdmin = () => admin;
export function toggleAdmin() {
  // TODO: pedir autenticación según el backend elegido (nunca confiar solo en el cliente)
  admin = !admin;
}
