const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/adminAuth");
const { getAllUsers, updateUserRole, getAdminDashboardStats, getRoles, deleteUser, updateUserNotifications } = require("../database/db");

router.use(requireAuth);
router.use(requireAdmin);

// Dashboard stats
router.get("/dashboard", async (req, res) => {
  try {
    const stats = await getAdminDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error obteniendo stats:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// Obtener todos los usuarios
router.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({ error: "Error obteniendo usuarios" });
  }
});

// Cambiar rol de usuario
router.put("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: "role_id es requerido" });
    }

    const updatedUser = await updateUserRole(id, role_id);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error actualizando rol:", error);
    res.status(500).json({ error: "Error actualizando rol de usuario" });
  }
});

// Eliminar usuario
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que no se elimine a sí mismo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    }

    const result = await deleteUser(id);
    res.json({ success: true, message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    res.status(500).json({ error: "Error eliminando usuario" });
  }
});

// Gestionar notificaciones de usuario
router.put("/users/:id/notifications", async (req, res) => {
  try {
    const { id } = req.params;
    const { email_alerts, daily_predictions } = req.body;

    const updatedUser = await updateUserNotifications(id, email_alerts, daily_predictions);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error actualizando notificaciones:", error);
    res.status(500).json({ error: "Error actualizando notificaciones" });
  }
});

// Obtener roles
router.get("/roles", async (req, res) => {
  try {
    const roles = await getRoles();
    res.json({ success: true, roles });
  } catch (error) {
    console.error("Error obteniendo roles:", error);
    res.status(500).json({ error: "Error obteniendo roles" });
  }
});

module.exports = router; 