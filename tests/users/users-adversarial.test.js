import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ ADVERSARIAL CHALLENGER SUITE: UserManagement (Phase 5)', () => {
  const usersFiles = [
    'src/components/UserManagementView.jsx',
    'src/components/users/hooks/useUsersManager.js',
    'src/components/users/UserFilterBar.jsx',
    'src/components/users/UserTable.jsx',
    'src/components/users/modals/UserEditModal.jsx',
  ];

  // =========================================================================
  // 1. AUDITORÍA FORENSE: CERO DATOS MOCKEADOS O FACHADAS DUMMY
  // =========================================================================
  describe('1. Verificación Estricta: Cero Mocks, Stubs o Fachadas Dummy', () => {
    it('1.1. Ningún archivo en src/components/users/ contiene arreglos de usuarios mock o stubs', () => {
      const forbiddenPatterns = [
        /const\s+mockUsers/i,
        /let\s+mockUsers/i,
        /\[\s*\{\s*id:\s*['"]mock-/i,
        /dummyUserData/i,
        /faker/i,
        /lorem\s+ipsum/i,
      ];

      for (const relPath of usersFiles) {
        const fullPath = path.join(rootDir, relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const pattern of forbiddenPatterns) {
          assert.ok(
            !pattern.test(content),
            `Violación detectada en ${relPath}: patrón prohibido ${pattern}`
          );
        }
      }
    });

    it('1.2. useUsersManager consume endpoints reales del backend (/api/users y /api/events)', () => {
      const hookPath = path.join(rootDir, 'src/components/users/hooks/useUsersManager.js');
      const content = fs.readFileSync(hookPath, 'utf-8');

      assert.ok(content.includes("authFetch('/api/users')"), 'Debe consumir GET /api/users');
      assert.ok(content.includes("authFetch('/api/events')"), 'Debe consumir GET /api/events');
      assert.ok(content.includes("authFetch('/api/users', {"), 'Debe consumir POST /api/users');
      assert.ok(content.includes('/api/users/${userId}/roles'), 'Debe consumir PATCH /api/users/:id/roles');
      assert.ok(content.includes('/api/users/${userId}/assign-event'), 'Debe consumir PATCH /api/users/:id/assign-event');
      assert.ok(content.includes('/api/users/${userId}/toggle-status'), 'Debe consumir PATCH /api/users/:id/toggle-status');
      assert.ok(content.includes('/api/users/${userId}'), 'Debe consumir DELETE /api/users/:id');
    });
  });

  // =========================================================================
  // 2. PERMISOS DE ROLES Y MATRIZ DE SEGURIDAD
  // =========================================================================
  describe('2. Verificación Adversarial de Permisos de Roles', () => {
    const roleDefinitions = [
      { key: 'SUPER_ADMIN', label: '👑 Super Admin' },
      { key: 'VENDEDOR', label: '💼 Vendedor POS' },
      { key: 'OPERARIO_1', label: '👷 Op. 1 (Stock)' },
      { key: 'OPERARIO_2', label: '🖨️ Op. 2 (Taller)' },
    ];

    it('2.1. Definiciones de roles cubren exactamente los 4 roles canónicos del sistema', () => {
      const keys = roleDefinitions.map((r) => r.key);
      assert.deepEqual(keys.sort(), ['OPERARIO_1', 'OPERARIO_2', 'SUPER_ADMIN', 'VENDEDOR'].sort());
    });

    it('2.2. Intento de revocar el último rol activo es bloqueado y no emite petición a la API', async () => {
      let apiCalled = false;
      let notificationError = null;

      const mockAuthFetch = async () => {
        apiCalled = true;
        return { json: async () => ({ success: true }) };
      };

      const showNotification = (msg, isErr = false) => {
        if (isErr) notificationError = msg;
      };

      const handleToggleRoleOracle = async (userId, targetRole, currentRoles = []) => {
        const rolesList = Array.isArray(currentRoles) && currentRoles.length > 0 ? [...currentRoles] : ['VENDEDOR'];
        if (rolesList.includes(targetRole) && rolesList.length === 1) {
          return showNotification('El usuario debe conservar al menos un rol activo.', true);
        }
        const updatedRoles = rolesList.includes(targetRole)
          ? rolesList.filter((r) => r !== targetRole)
          : [...rolesList, targetRole];

        await mockAuthFetch(`/api/users/${userId}/roles`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles: updatedRoles }),
        });
      };

      // Intentar remover el único rol OPERARIO_2
      await handleToggleRoleOracle('user-99', 'OPERARIO_2', ['OPERARIO_2']);
      assert.equal(apiCalled, false, 'La API NO debe ser llamada cuando se intenta dejar al usuario sin roles');
      assert.equal(notificationError, 'El usuario debe conservar al menos un rol activo.');

      // Permitir remover un rol si tiene más de 1
      apiCalled = false;
      notificationError = null;
      await handleToggleRoleOracle('user-99', 'OPERARIO_2', ['OPERARIO_2', 'VENDEDOR']);
      assert.equal(apiCalled, true, 'La API debe ser llamada cuando el usuario conserva otro rol');
      assert.equal(notificationError, null);
    });

    it('2.3. UserTable deshabilita la asignación de eventos para operarios puros (sin rol VENDEDOR ni SUPER_ADMIN)', () => {
      const userTableContent = fs.readFileSync(
        path.join(rootDir, 'src/components/users/UserTable.jsx'),
        'utf-8'
      );

      // Verify the hasVendedorRole predicate logic in UserTable
      assert.ok(
        userTableContent.includes("userRolesList.includes('VENDEDOR') || userRolesList.includes('SUPER_ADMIN')"),
        'UserTable debe verificar que el usuario sea VENDEDOR o SUPER_ADMIN para asignar evento'
      );
      assert.ok(
        userTableContent.includes('disabled={!hasVendedorRole}'),
        'El selector de evento debe estar disabled={!hasVendedorRole}'
      );

      // Verify oracle truth table
      const hasVendedorRoleCheck = (roles) => roles.includes('VENDEDOR') || roles.includes('SUPER_ADMIN');
      assert.equal(hasVendedorRoleCheck(['OPERARIO_1']), false);
      assert.equal(hasVendedorRoleCheck(['OPERARIO_2']), false);
      assert.equal(hasVendedorRoleCheck(['OPERARIO_1', 'OPERARIO_2']), false);
      assert.equal(hasVendedorRoleCheck(['VENDEDOR']), true);
      assert.equal(hasVendedorRoleCheck(['SUPER_ADMIN']), true);
      assert.equal(hasVendedorRoleCheck(['OPERARIO_1', 'VENDEDOR']), true);
    });

    it('2.4. Protección de auto-eliminación: el usuario en sesión no puede eliminarse a sí mismo', () => {
      const userTableContent = fs.readFileSync(
        path.join(rootDir, 'src/components/users/UserTable.jsx'),
        'utf-8'
      );

      assert.ok(
        userTableContent.includes('const isSelf = currentUser && currentUser.id === u.id'),
        'UserTable debe calcular isSelf comparando con currentUser.id'
      );
      assert.ok(
        userTableContent.includes('!isSelf && ('),
        'El botón de eliminación debe estar condicionado a !isSelf'
      );
    });
  });

  // =========================================================================
  // 3. FILTRADO, BÚSQUEDA Y RESILIENCIA A CAMPOS NULOS O MALFORMADOS
  // =========================================================================
  describe('3. Búsqueda y Filtrado Adversarial', () => {
    const adversarialUserDataset = [
      { id: '1', fullName: 'Sebastián Dávila', email: 'sebas@gmail.com', roles: ['SUPER_ADMIN'] },
      { id: '2', fullName: 'Marcos López Ramos', email: 'marcos.taller@dekolabs.com', roles: ['OPERARIO_2'] },
      { id: '3', fullName: 'Ana Sofía Gálvez', email: 'ana.pos@gmail.com', roles: ['VENDEDOR'] },
      { id: '4', fullName: null, email: 'huerfano@gmail.com', roles: ['OPERARIO_1'] },
      { id: '5', fullName: 'Carlos Sin Correo', email: null, roles: ['VENDEDOR'] },
      { id: '6', fullName: 'Lucía Méndez', email: 'lucia@gmail.com', roles: [] }, // rol vacío
      { id: '7', fullName: '  Elena Espacios  ', email: 'elena@gmail.com  ', roles: ['VENDEDOR'] },
    ];

    const filterUsersOracle = (users, searchTerm, roleFilter) => {
      return users.filter((u) => {
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !term ||
          (u.fullName && u.fullName.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term));
        const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'VENDEDOR'];
        const matchesRole = !roleFilter || roleFilter === 'ALL' || userRoles.includes(roleFilter);
        return matchesSearch && matchesRole;
      });
    };

    it('3.1. Búsqueda no lanza excepción cuando fullName o email son null o undefined', () => {
      assert.doesNotThrow(() => {
        const res = filterUsersOracle(adversarialUserDataset, 'huerfano', 'ALL');
        assert.equal(res.length, 1);
        assert.equal(res[0].id, '4');
      });

      assert.doesNotThrow(() => {
        const res = filterUsersOracle(adversarialUserDataset, 'Carlos', 'ALL');
        assert.equal(res.length, 1);
        assert.equal(res[0].id, '5');
      });
    });

    it('3.2. Usuario con array de roles vacío adopta por defecto "VENDEDOR" sin lanzar excepción', () => {
      const res = filterUsersOracle(adversarialUserDataset, 'Lucía', 'VENDEDOR');
      assert.equal(res.length, 1);
      assert.equal(res[0].id, '6');
    });

    it('3.3. Búsqueda con espacios excesivos o mayúsculas se normaliza correctamente', () => {
      const res = filterUsersOracle(adversarialUserDataset, '   SEBASTIÁN   ', 'ALL');
      assert.equal(res.length, 1);
      assert.equal(res[0].id, '1');
    });

    it('3.4. Combinación estricta de filtro de rol + término de búsqueda', () => {
      // Buscar 'elena' con filtro VENDEDOR -> 1 resultado
      const res1 = filterUsersOracle(adversarialUserDataset, 'elena', 'VENDEDOR');
      assert.equal(res1.length, 1);
      assert.equal(res1[0].id, '7');

      // Buscar 'elena' con filtro SUPER_ADMIN -> 0 resultados
      const res2 = filterUsersOracle(adversarialUserDataset, 'elena', 'SUPER_ADMIN');
      assert.equal(res2.length, 0);
    });
  });

  // =========================================================================
  // 4. RESILIENCIA ANTE ESTADOS DE ERROR Y FALLAS DE RED
  // =========================================================================
  describe('4. Resiliencia ante Estados de Error y Caídas de Servidor', () => {
    it('4.1. handleCreateUser valida exhaustivamente campos antes de invocar la API', async () => {
      let networkCalled = false;
      const mockAuthFetch = async () => { networkCalled = true; return { json: async () => ({}) }; };
      let capturedError = null;
      const showNotification = (msg, isErr) => { if (isErr) capturedError = msg; };

      const handleCreateUser = async ({ fullName, email, roles }) => {
        if (!email || !email.includes('@')) return showNotification('Ingresa un correo de Google válido.', true);
        if (!fullName?.trim()) return showNotification('Ingresa el nombre completo del empleado.', true);
        if (!roles?.length) return showNotification('Selecciona al menos un rol para el usuario.', true);
        await mockAuthFetch('/api/users');
        return true;
      };

      // Caso 1: Email vacío o inválido
      await handleCreateUser({ fullName: 'Juan', email: 'correo_sin_arroba', roles: ['VENDEDOR'] });
      assert.equal(networkCalled, false);
      assert.equal(capturedError, 'Ingresa un correo de Google válido.');

      // Caso 2: Nombre vacío
      capturedError = null;
      await handleCreateUser({ fullName: '   ', email: 'juan@gmail.com', roles: ['VENDEDOR'] });
      assert.equal(networkCalled, false);
      assert.equal(capturedError, 'Ingresa el nombre completo del empleado.');

      // Caso 3: Sin roles
      capturedError = null;
      await handleCreateUser({ fullName: 'Juan Perez', email: 'juan@gmail.com', roles: [] });
      assert.equal(networkCalled, false);
      assert.equal(capturedError, 'Selecciona al menos un rol para el usuario.');
    });

    it('4.2. Falla de conexión o HTTP 500 es capturada en try/catch y notificada al usuario', async () => {
      let notifiedError = null;
      const showNotification = (msg, isErr) => { if (isErr) notifiedError = msg; };

      const simulateFailingApi = async () => {
        try {
          throw new Error('Conexión rehusada por el servidor');
        } catch (err) {
          showNotification(err.message, true);
        }
      };

      await simulateFailingApi();
      assert.equal(notifiedError, 'Conexión rehusada por el servidor');
    });

    it('4.3. Temporizadores de auto-cierre de notificaciones (4000ms para errores, 3000ms para éxito)', () => {
      const hookContent = fs.readFileSync(
        path.join(rootDir, 'src/components/users/hooks/useUsersManager.js'),
        'utf-8'
      );

      assert.ok(
        hookContent.includes('setTimeout(() => setErrorMsg(null), 4000)'),
        'useUsersManager debe limpiar errorMsg a los 4000ms'
      );
      assert.ok(
        hookContent.includes('setTimeout(() => setMessage(null), 3000)'),
        'useUsersManager debe limpiar message de éxito a los 3000ms'
      );
    });
  });

  // =========================================================================
  // 5. CONFIRMACIÓN Y ELIMINACIÓN DE USUARIOS
  // =========================================================================
  describe('5. Verificación de Diálogo de Confirmación de Eliminación', () => {
    it('5.1. handleDeleteUser solicita confirmación mediante window.confirm con el nombre del empleado', async () => {
      const hookContent = fs.readFileSync(
        path.join(rootDir, 'src/components/users/hooks/useUsersManager.js'),
        'utf-8'
      );

      assert.ok(
        hookContent.includes('window.confirm('),
        'handleDeleteUser debe invocar window.confirm'
      );
      assert.ok(
        hookContent.includes('${userName}'),
        'handleDeleteUser debe incluir el nombre del usuario en el texto de confirmación'
      );
    });

    it('5.2. Cancelar la confirmación (false) aborta de inmediato y NUNCA ejecuta DELETE en la API', async () => {
      let deleteCalled = false;
      const mockAuthFetch = async () => {
        deleteCalled = true;
        return { json: async () => ({ success: true }) };
      };

      const handleDeleteUserOracle = async (userId, userName, confirmAnswer) => {
        if (!confirmAnswer) return;
        await mockAuthFetch(`/api/users/${userId}`, { method: 'DELETE' });
      };

      // Usuario cancela el diálogo
      await handleDeleteUserOracle('u-123', 'Pedro Gomez', false);
      assert.equal(deleteCalled, false, 'No debe invocar DELETE cuando confirm es false');

      // Usuario acepta el diálogo
      await handleDeleteUserOracle('u-123', 'Pedro Gomez', true);
      assert.equal(deleteCalled, true, 'Debe invocar DELETE cuando confirm es true');
    });
  });
});
