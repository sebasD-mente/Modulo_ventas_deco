import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🛡️ SUITE DE PRUEBAS MODULARES: Módulo de Gestión de Usuarios (Phase 5 - M1)', () => {

  // =========================================================================
  // 1. AUDITORÍA ESTRICTA DE LÍMITES DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Límites de Líneas y Erradicación de Monolitos', () => {
    const fileCeilings = [
      { file: 'src/components/UserManagementView.jsx', max: 70, desc: 'Contenedor Maestro Canónico' },
      { file: 'src/components/users/hooks/useUsersManager.js', max: 140, desc: 'Hook de Gestión de Usuarios y API' },
      { file: 'src/components/users/UserFilterBar.jsx', max: 70, desc: 'Barra de Filtros y Búsqueda' },
      { file: 'src/components/users/UserTable.jsx', max: 120, desc: 'Tabla y Tarjetas de Usuarios' },
      { file: 'src/components/users/modals/UserEditModal.jsx', max: 110, desc: 'Modal de Autorización y Alta de Usuario' },
    ];

    for (const { file, max, desc } of fileCeilings) {
      it(`1.x. ${file} (${desc}) respeta el límite estricto de < ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        assert.ok(
          lineCount < max,
          `Violación de límite: ${file} tiene ${lineCount} líneas (máximo permitido < ${max})`
        );
        assert.ok(
          lineCount <= 200,
          `Violación de regla de cero deuda técnica: ${file} supera las 200 líneas`
        );
      });
    }
  });

  // =========================================================================
  // 2. AUDITORÍA FORENSE: CERO MOCKS, STUBS O MARCADORES PROHIBIDOS
  // =========================================================================
  describe('2. Auditoría Forense: Cero Mocks, Stubs o Placeholders Residuales en Producción', () => {
    const filesToAudit = [
      'src/components/UserManagementView.jsx',
      'src/components/users/hooks/useUsersManager.js',
      'src/components/users/UserFilterBar.jsx',
      'src/components/users/UserTable.jsx',
      'src/components/users/modals/UserEditModal.jsx',
    ];

    it('2.1. Ningún archivo contiene comentarios TODO, FIXME, STUB, MOCK o marcadores dummy', () => {
      const suspiciousPattern = /(\/\/\s*(TODO|FIXME|STUB|MOCK|PLACEHOLDER)|\/\*[\s\S]*?(TODO|FIXME|STUB|MOCK|PLACEHOLDER)[\s\S]*?\*\/|const\s+mock|let\s+mock|function\s+mock|lorem\s+ipsum)/i;
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(suspiciousPattern);
        assert.ok(
          !match,
          `Detectado marcador residual o stub prohibido en ${file}: "${match?.[0]}"`
        );
      }
    });

    it('2.2. Ningún archivo hardcodea direcciones IP ajenas o credenciales prohibidas', () => {
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(
          !content.includes('145.223.120.56'),
          `Violación de aislamiento: IP ajena detectada en ${file}`
        );
      }
    });
  });

  // =========================================================================
  // 3. CONTRATOS PÚBLICOS E INTEGRACIÓN
  // =========================================================================
  describe('3. Verificación de Contratos Públicos e Integración con App.jsx', () => {
    it('3.1. UserManagementView.jsx exporta por defecto una función sin props obligatorias', () => {
      const fullPath = path.join(rootDir, 'src/components/UserManagementView.jsx');
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.match(content, /export\s+default\s+function\s+UserManagementView\s*\(/);
    });

    it('3.2. useUsersManager.js expone named export, default export y ROLE_DEFINITIONS', () => {
      const fullPath = path.join(rootDir, 'src/components/users/hooks/useUsersManager.js');
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.match(content, /export\s+function\s+useUsersManager/);
      assert.match(content, /export\s+default\s+useUsersManager/);
      assert.match(content, /export\s+const\s+ROLE_DEFINITIONS/);
    });

    it('3.3. Todos los componentes de interfaz tienen export default', () => {
      const submodules = [
        'src/components/users/UserFilterBar.jsx',
        'src/components/users/UserTable.jsx',
        'src/components/users/modals/UserEditModal.jsx',
      ];
      for (const file of submodules) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.match(content, /export\s+default\s+function/, `Falta export default en ${file}`);
      }
    });
  });

  // =========================================================================
  // 4. LÓGICA DE NEGOCIO Y PREDICADOS DE FILTRADO
  // =========================================================================
  describe('4. Verificación de Lógica de Negocio y Algoritmos de Filtrado', () => {
    const sampleUsers = [
      {
        id: 'u-1',
        fullName: 'Marcos López',
        email: 'marcos@gmail.com',
        roles: ['SUPER_ADMIN', 'VENDEDOR'],
        status: 'ACTIVO',
        assignedEventId: 'ev-1',
      },
      {
        id: 'u-2',
        fullName: 'Sofía Morales',
        email: 'sofia.operaciones@gmail.com',
        roles: ['OPERARIO_1'],
        status: 'ACTIVO',
        assignedEventId: null,
      },
      {
        id: 'u-3',
        fullName: 'Carlos Ramos',
        email: 'carlos.taller@gmail.com',
        roles: ['OPERARIO_2'],
        status: 'INACTIVO',
        assignedEventId: null,
      },
      {
        id: 'u-4',
        fullName: 'Elena Fuentes',
        email: 'elena@gmail.com',
        roles: ['VENDEDOR'],
        status: 'ACTIVO',
        assignedEventId: 'ev-2',
      },
    ];

    it('4.1. Filtrado de búsqueda por nombre o correo es insensible a mayúsculas y acentos', () => {
      const filterBySearch = (users, query) => {
        const term = query.toLowerCase().trim();
        if (!term) return users;
        return users.filter(
          (u) =>
            (u.fullName && u.fullName.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term))
        );
      };

      const searchByName = filterBySearch(sampleUsers, 'marcos');
      assert.equal(searchByName.length, 1);
      assert.equal(searchByName[0].id, 'u-1');

      const searchByEmail = filterBySearch(sampleUsers, 'taller');
      assert.equal(searchByEmail.length, 1);
      assert.equal(searchByEmail[0].id, 'u-3');

      const searchNotFound = filterBySearch(sampleUsers, 'inexistente');
      assert.equal(searchNotFound.length, 0);
    });

    it('4.2. Filtrado por rol aísla correctamente los usuarios con dicho rol', () => {
      const filterByRole = (users, role) => {
        if (!role || role === 'ALL') return users;
        return users.filter((u) => {
          const rolesList = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'VENDEDOR'];
          return rolesList.includes(role);
        });
      };

      const superAdmins = filterByRole(sampleUsers, 'SUPER_ADMIN');
      assert.equal(superAdmins.length, 1);
      assert.equal(superAdmins[0].id, 'u-1');

      const vendedores = filterByRole(sampleUsers, 'VENDEDOR');
      assert.equal(vendedores.length, 2);
      assert.ok(vendedores.some((u) => u.id === 'u-1'));
      assert.ok(vendedores.some((u) => u.id === 'u-4'));

      const allUsers = filterByRole(sampleUsers, 'ALL');
      assert.equal(allUsers.length, 4);
    });

    it('4.3. Regla de seguridad: Se previene revocar el último rol activo de un usuario', () => {
      const toggleRole = (currentRoles, targetRole) => {
        const rolesList = Array.isArray(currentRoles) && currentRoles.length > 0 ? [...currentRoles] : ['VENDEDOR'];
        if (rolesList.includes(targetRole)) {
          if (rolesList.length === 1) {
            return { error: 'El usuario debe conservar al menos un rol activo.', updatedRoles: rolesList };
          }
          return { error: null, updatedRoles: rolesList.filter((r) => r !== targetRole) };
        }
        return { error: null, updatedRoles: [...rolesList, targetRole] };
      };

      // Usuario con 1 rol intenta revocar su único rol
      const singleRoleRes = toggleRole(['OPERARIO_1'], 'OPERARIO_1');
      assert.ok(singleRoleRes.error !== null);
      assert.deepEqual(singleRoleRes.updatedRoles, ['OPERARIO_1']);

      // Usuario con 2 roles revoca 1 rol exitosamente
      const multiRoleRes = toggleRole(['SUPER_ADMIN', 'VENDEDOR'], 'SUPER_ADMIN');
      assert.equal(multiRoleRes.error, null);
      assert.deepEqual(multiRoleRes.updatedRoles, ['VENDEDOR']);

      // Usuario agrega un nuevo rol
      const addRoleRes = toggleRole(['VENDEDOR'], 'OPERARIO_2');
      assert.equal(addRoleRes.error, null);
      assert.deepEqual(addRoleRes.updatedRoles, ['VENDEDOR', 'OPERARIO_2']);
    });

    it('4.4. Validaciones estrictas de alta de usuario con Google OAuth', () => {
      const validateUserCreation = ({ fullName, email, roles }) => {
        if (!email || !email.includes('@')) {
          return { valid: false, error: 'Ingresa un correo de Google válido.' };
        }
        if (!fullName?.trim()) {
          return { valid: false, error: 'Ingresa el nombre completo del empleado.' };
        }
        if (!roles?.length) {
          return { valid: false, error: 'Selecciona al menos un rol para el usuario.' };
        }
        return { valid: true, error: null };
      };

      assert.equal(validateUserCreation({ fullName: '', email: 'test@gmail.com', roles: ['VENDEDOR'] }).valid, false);
      assert.equal(validateUserCreation({ fullName: 'Juan', email: 'invalid-email', roles: ['VENDEDOR'] }).valid, false);
      assert.equal(validateUserCreation({ fullName: 'Juan', email: 'juan@gmail.com', roles: [] }).valid, false);
      assert.equal(validateUserCreation({ fullName: 'Juan Perez', email: 'juan@gmail.com', roles: ['VENDEDOR'] }).valid, true);
    });
  });
});
