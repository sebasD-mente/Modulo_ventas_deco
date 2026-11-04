import {
  listTenantUsers,
  updateTenantUserRoles,
  toggleTenantUserStatus,
  createTenantUser,
  deleteTenantUser,
} from '../services/userService.js';
import { assignUserToEventService } from '../services/userEventAssignmentService.js';
import { invalidateUserAuthCache } from '../middleware/authMiddleware.js';

export async function getUsersList(req, res) {
  try {
    const data = await listTenantUsers(req.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role, roles } = req.body;
    const { updated, targetRoles } = await updateTenantUserRoles({
      where: { id, tenantId: req.tenantId },
      roles,
      role,
    });
    invalidateUserAuthCache(id);
    return res.status(200).json({
      success: true,
      message: `Roles de ${updated.fullName} actualizados a [${targetRoles.join(', ')}]`,
      data: { ...updated, roles: updated.roles || targetRoles },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

export async function assignUserToEvent(req, res) {
  try {
    const { id } = req.params;
    const { eventId } = req.body;
    const updated = await assignUserToEventService({ userId: id, eventId, tenantId: req.tenantId });
    invalidateUserAuthCache(id);
    return res.status(200).json({
      success: true,
      message: `Vendedor asignado al evento ${updated.assignedEvent?.name || 'Ninguno'}`,
      data: updated,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

export async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { updated, newStatus } = await toggleTenantUserStatus({
      where: { id, tenantId: req.tenantId },
    });
    invalidateUserAuthCache(id);
    return res.status(200).json({
      success: true,
      message: `Usuario ${newStatus === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente.`,
      data: updated,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

export async function createUser(req, res) {
  try {
    const { email, fullName, roles, role, assignedEventId } = req.body;
    const { newUser, targetRoles } = await createTenantUser({
      tenantId: req.tenantId,
      email,
      fullName,
      roles,
      role,
      assignedEventId,
    });
    return res.status(201).json({
      success: true,
      message: `Usuario ${newUser.fullName} (${newUser.email}) registrado y autorizado correctamente.`,
      data: { ...newUser, roles: newUser.roles || targetRoles },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    await deleteTenantUser({
      where: { id, tenantId: req.tenantId },
      requestingUserId: req.user?.id || null,
    });
    invalidateUserAuthCache(id);
    return res.status(200).json({ success: true, message: 'Usuario eliminado del sistema correctamente.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}
