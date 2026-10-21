import { useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../lib/api";
import { AuthContext } from "./authContextInstance";
import { jwtDecode } from "jwt-decode";

/** HAL-35: normalización única del rol (el backend acepta "admin" y "administrador"). */
function normalizarRol(nombre) {
  if (nombre === "admin" || nombre === "administrador") return "admin";
  if (nombre === "medico") return "medico";
  if (nombre === "paciente") return "paciente";
  return null;
}

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null
  );
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  // Rol derivado del token decodificado, normalizado
  const role = useMemo(() => {
    if (user?.rolNombre) return normalizarRol(user.rolNombre);
    // Fallback para compatibilidad con roles antiguos
    if (user?.rolId === 1) return "admin";
    if (user?.rolId === 2) return "medico";
    if (user?.rolId === 3) return "paciente";
    return null;
  }, [user]);

  // HAL-38: al iniciar, descartar tokens vencidos / con datos inválidos.
  useEffect(() => {
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      if (decoded?.exp && decoded.exp * 1000 <= Date.now()) {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = async ({ nombre_usuario, password }) => {
    setLoading(true);
    try {
      const { data } = await api.post("/autenticacion/login", {
        nombre_usuario,
        password,
      });
      const newToken = data?.token;
      setToken(newToken);
      localStorage.setItem("token", newToken);
      setAuthToken(newToken);

      // Decodificar el token JWT usando jwt-decode
      let decodedToken = null;
      try {
        decodedToken = jwtDecode(newToken);
      } catch (error) {
        console.error("Error al decodificar JWT:", error);
      }

      // Crear objeto user con nombre_usuario y todo el contenido decodificado del token
      const userData = {
        nombre_usuario,
        ...(decodedToken || {}),
      };

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    } finally {
      setLoading(false);
    }
  };

  /**
   * HAL-09: el logout ahora termina la sesión en el backend (invoca
   * `/autenticacion/logout`, que rota token_version y revoca los JWT
   * emitidos) además de limpiar el estado local.
   */
  const logout = async () => {
    try {
      await api.post("/autenticacion/logout");
    } catch {
      // El logout local sólo continúa aunque el backend falle.
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete api.defaults.headers.common.Authorization;
  };

  const value = useMemo(
    () => ({ token, user, role, loading, login, logout }),
    [token, user, role, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
