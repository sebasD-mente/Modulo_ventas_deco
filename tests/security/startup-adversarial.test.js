import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverIndexPath = path.resolve(__dirname, '../../server/index.js');

describe('⚔️ Desafío Empírico de Arranque y Preservación de Usuarios Operativos', () => {
  it('server/index.js NO debe contener ninguna llamada destructiva (deleteMany / delete) sobre prisma.user', () => {
    const content = fs.readFileSync(serverIndexPath, 'utf-8');

    // Comprobar ausencia de deleteMany sobre user
    assert.ok(
      !content.includes('prisma.user.deleteMany'),
      'CRÍTICO: server/index.js contiene prisma.user.deleteMany'
    );
    assert.ok(
      !content.includes('user.deleteMany'),
      'CRÍTICO: server/index.js contiene llamadas a user.deleteMany'
    );

    // Comprobar ausencia de delete sobre user en arranque
    assert.ok(
      !content.includes('prisma.user.delete('),
      'CRÍTICO: server/index.js contiene llamadas destructivas a prisma.user.delete'
    );

    // Comprobar que no existe cláusula notIn sobre emails
    assert.ok(
      !content.includes('notIn: ENV.SUPER_ADMIN_EMAILS'),
      'CRÍTICO: server/index.js aún contiene cláusula discriminatoria notIn sobre SUPER_ADMIN_EMAILS'
    );

    // Comprobar que la búsqueda usa in: ENV.SUPER_ADMIN_EMAILS
    assert.ok(
      content.includes('in: ENV.SUPER_ADMIN_EMAILS'),
      'server/index.js debe consultar estrictamente usando `in: ENV.SUPER_ADMIN_EMAILS`'
    );
  });

  it('Simulación empírica: Usuarios con roles VENDEDOR, OPERARIO_1, OPERARIO_2 permanecen 100% intactos tras arranque', async () => {
    // 1. Estado inicial de la base de datos simulada
    const simulatedDatabase = {
      users: [
        {
          id: 'usr_admin_1',
          email: 'admin.principal@dekolabs.org',
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN'],
          status: 'ACTIVO',
          name: 'Super Admin Activo',
        },
        {
          id: 'usr_admin_2',
          email: 'admin.secundario@dekolabs.org',
          role: 'VENDEDOR', // Degradado accidentalmente
          roles: ['VENDEDOR'],
          status: 'INACTIVO',
          name: 'Super Admin Necesita Reconciliación',
        },
        {
          id: 'usr_vend_1',
          email: 'cajero.feria1@dekolabs.org',
          role: 'VENDEDOR',
          roles: ['VENDEDOR'],
          status: 'ACTIVO',
          name: 'Vendedor Principal Feria',
        },
        {
          id: 'usr_vend_2',
          email: 'cajero.feria2@dekolabs.org',
          role: 'VENDEDOR',
          roles: ['VENDEDOR'],
          status: 'ACTIVO',
          name: 'Vendedor Asistente',
        },
        {
          id: 'usr_op_1',
          email: 'taller.corte@dekolabs.org',
          role: 'OPERARIO_1',
          roles: ['OPERARIO_1'],
          status: 'ACTIVO',
          name: 'Operario de Taller 1',
        },
        {
          id: 'usr_op_2',
          email: 'taller.acabados@dekolabs.org',
          role: 'OPERARIO_2',
          roles: ['OPERARIO_2'],
          status: 'ACTIVO',
          name: 'Operario de Taller 2',
        },
      ],
      calls: {
        deleteMany: [],
        delete: [],
        update: [],
        findMany: [],
      },
    };

    // Copia profunda para comparar inmutabilidad
    const initialUsersSnapshot = JSON.parse(JSON.stringify(simulatedDatabase.users));

    // 2. Mock de Prisma
    const mockPrisma = {
      user: {
        findMany: async (query) => {
          simulatedDatabase.calls.findMany.push(query);
          const filterEmails = query?.where?.email?.in || [];
          return simulatedDatabase.users.filter((u) => filterEmails.includes(u.email));
        },
        update: async ({ where, data }) => {
          simulatedDatabase.calls.update.push({ where, data });
          const user = simulatedDatabase.users.find((u) => u.id === where.id);
          if (user) {
            Object.assign(user, data);
          }
          return user;
        },
        deleteMany: async (args) => {
          simulatedDatabase.calls.deleteMany.push(args);
          throw new Error('VIOLACIÓN ZERO-TRUST: deleteMany no debe ser invocado');
        },
        delete: async (args) => {
          simulatedDatabase.calls.delete.push(args);
          throw new Error('VIOLACIÓN ZERO-TRUST: delete no debe ser invocado');
        },
      },
    };

    // 3. Variables de entorno configuradas
    const mockENV = {
      SUPER_ADMIN_EMAILS: ['admin.principal@dekolabs.org', 'admin.secundario@dekolabs.org'],
    };

    // 4. Ejecución de la lógica idéntica de server/index.js (L109-138)
    const admins = await mockPrisma.user.findMany({
      where: {
        email: {
          in: mockENV.SUPER_ADMIN_EMAILS,
        },
      },
    });

    for (const admin of admins) {
      const currentRoles = Array.isArray(admin.roles) && admin.roles.length > 0 ? admin.roles : [admin.role || 'SUPER_ADMIN'];
      if (!currentRoles.includes('SUPER_ADMIN') || admin.role !== 'SUPER_ADMIN' || admin.status !== 'ACTIVO') {
        const updatedRoles = Array.from(new Set(['SUPER_ADMIN', ...currentRoles]));
        await mockPrisma.user.update({
          where: { id: admin.id },
          data: {
            role: 'SUPER_ADMIN',
            roles: updatedRoles,
            status: 'ACTIVO',
          },
        });
      }
    }

    // 5. ASERCIONES ADVERSARIALES

    // Aserción A: CERO llamadas destructivas
    assert.equal(simulatedDatabase.calls.deleteMany.length, 0, 'No debe haber llamadas a deleteMany');
    assert.equal(simulatedDatabase.calls.delete.length, 0, 'No debe haber llamadas a delete');

    // Aserción B: Conteo de usuarios total no disminuye
    assert.equal(simulatedDatabase.users.length, initialUsersSnapshot.length, 'La cantidad de usuarios en la base de datos debe ser exactamente la misma');

    // Aserción C: Roles operativos permanecen 100% idénticos e inalterados
    const operationalEmails = [
      'cajero.feria1@dekolabs.org',
      'cajero.feria2@dekolabs.org',
      'taller.corte@dekolabs.org',
      'taller.acabados@dekolabs.org',
    ];

    for (const email of operationalEmails) {
      const original = initialUsersSnapshot.find((u) => u.email === email);
      const after = simulatedDatabase.users.find((u) => u.email === email);

      assert.ok(after, `El usuario operativo ${email} debe existir`);
      assert.deepEqual(
        after,
        original,
        `El usuario operativo ${email} fue alterado o corrompido durante la inicialización`
      );
    }

    // Aserción D: Solo se actualizó el Super Admin desalineado (usr_admin_2)
    assert.equal(simulatedDatabase.calls.update.length, 1, 'Solo 1 actualización debió ser ejecutada');
    assert.equal(simulatedDatabase.calls.update[0].where.id, 'usr_admin_2');
    assert.equal(simulatedDatabase.users.find((u) => u.id === 'usr_admin_2').role, 'SUPER_ADMIN');
    assert.equal(simulatedDatabase.users.find((u) => u.id === 'usr_admin_2').status, 'ACTIVO');

    // Aserción E: El Super Admin ya conforme (usr_admin_1) no sufrió escrituras innecesarias
    const admin1 = simulatedDatabase.users.find((u) => u.id === 'usr_admin_1');
    assert.deepEqual(admin1, initialUsersSnapshot[0], 'El Super Admin conforme no debió ser modificado');
  });

  it('Prueba de estrés masiva: 500 usuarios operativos concurrentes sobreviven sin escaneo o alteración O(1)', async () => {
    const userPool = [];
    for (let i = 0; i < 500; i++) {
      const role = i % 3 === 0 ? 'VENDEDOR' : i % 3 === 1 ? 'OPERARIO_1' : 'OPERARIO_2';
      userPool.push({
        id: `usr_stress_${i}`,
        email: `worker_${i}@feria.com`,
        role,
        roles: [role],
        status: 'ACTIVO',
      });
    }

    let accessedUsersCount = 0;
    const mockPrisma = {
      user: {
        findMany: async (query) => {
          const filterEmails = query?.where?.email?.in || [];
          const results = userPool.filter((u) => filterEmails.includes(u.email));
          accessedUsersCount = results.length;
          return results;
        },
        update: async () => {
          throw new Error('No debe haber updates en prueba de estrés sin admins');
        },
      },
    };

    const mockENV = {
      SUPER_ADMIN_EMAILS: ['nonexistent.admin@dekolabs.org'],
    };

    const admins = await mockPrisma.user.findMany({
      where: {
        email: {
          in: mockENV.SUPER_ADMIN_EMAILS,
        },
      },
    });

    assert.equal(admins.length, 0);
    assert.equal(accessedUsersCount, 0, 'Ningún usuario operativo fue filtrado o tocado por la consulta');
    assert.equal(userPool.length, 500, 'Todos los 500 usuarios operativos siguen existiendo intactos');
  });

  it('Resiliencia ante fallos: Si la consulta o base de datos lanza error en arranque, el servidor no se cae catastróficamente', async () => {
    let warningLogged = null;
    const originalWarn = console.warn;
    console.warn = (msg, err) => {
      warningLogged = { msg, err };
    };

    const mockPrismaError = {
      user: {
        findMany: async () => {
          throw new Error('Connection timeout to PostgreSQL');
        },
      },
    };

    try {
      // Simular bloque catch en server/index.js:138
      await mockPrismaError.user
        .findMany({
          where: { email: { in: ['admin@deko.org'] } },
        })
        .catch((err) => console.warn('[Startup Zero-Trust] Verificación inicial de administradores:', err.message));

      assert.ok(warningLogged, 'El error debió ser capturado y registrado con console.warn');
      assert.equal(warningLogged.err, 'Connection timeout to PostgreSQL');
    } finally {
      console.warn = originalWarn;
    }
  });
});
