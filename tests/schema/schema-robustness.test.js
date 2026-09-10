import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');

describe('🧪 Desafío Empírico de Robustez del Esquema Prisma (Milestone 1)', () => {

  // --------------------------------------------------------------------------
  // SUITE 1: Validaciones Sintácticas y Configuración del Datasource / Generator
  // --------------------------------------------------------------------------
  describe('1. Validación Sintáctica y Configuración del Esquema', () => {
    it('prisma/schema.prisma debe existir y tener contenido no vacío', () => {
      assert.ok(fs.existsSync(schemaPath), 'El archivo schema.prisma no existe');
      const content = fs.readFileSync(schemaPath, 'utf-8');
      assert.ok(content.length > 500, 'El esquema parece truncado o vacío');
    });

    it('npx prisma validate debe retornar código 0 sin advertencias ni errores', () => {
      const output = execSync('npx prisma validate', {
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.match(
        output,
        /The schema at .* is valid/,
        'prisma validate falló o retornó una salida inesperada'
      );
    });

    it('El datasource debe ser PostgreSQL y el generador debe soportar native y debian-openssl-3.0.x', () => {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      assert.match(
        content,
        /provider\s*=\s*"postgresql"/,
        'El provider del datasource debe ser postgresql'
      );
      assert.match(
        content,
        /binaryTargets\s*=\s*\[.*"native".*"debian-openssl-3\.0\.x".*\]/,
        'binaryTargets debe incluir "native" y "debian-openssl-3.0.x" para Dokploy'
      );
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Generación e Integridad del Prisma Client y Sistema de Tipos
  // --------------------------------------------------------------------------
  describe('2. Generación e Integridad de Tipos de Prisma Client', () => {
    it('npx prisma generate debe compilar en menos de 2500ms sin degradación', () => {
      const start = Date.now();
      const output = execSync('npx prisma generate', {
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const durationMs = Date.now() - start;
      assert.match(output, /Generated Prisma Client/, 'Fallo en la salida de prisma generate');
      assert.ok(
        durationMs < 2500,
        `prisma generate tardó ${durationMs}ms, excediendo el límite de rendimiento`
      );
    });

    it('Prisma.dmmf debe contener los 11 modelos definidos', () => {
      const expectedModels = [
        'Tenant',
        'User',
        'Event',
        'Product',
        'Sale',
        'SaleItem',
        'ProductionLog',
        'SalePayment',
        'SaleAttachment',
        'CashClosing',
        'AuditLog',
      ];
      const actualModels = Prisma.dmmf.datamodel.models.map((m) => m.name);

      for (const model of expectedModels) {
        assert.ok(
          actualModels.includes(model),
          `El modelo ${model} falta en el DMMF generado`
        );
      }
    });

    it('Las definiciones TypeScript generadas en .prisma/client deben contener tipos exportados para Sale y CashClosing', () => {
      const dtsPath = path.join(rootDir, 'node_modules', '.prisma', 'client', 'index.d.ts');
      assert.ok(fs.existsSync(dtsPath), 'No se encontró index.d.ts generado en .prisma/client');
      const dtsContent = fs.readFileSync(dtsPath, 'utf-8');

      // Exportación de tipos de Sale
      assert.ok(
        dtsContent.includes('export type Sale ='),
        'Falta export type Sale en definiciones de Prisma'
      );
      assert.ok(
        dtsContent.includes('$SalePayload'),
        'Falta $SalePayload en definiciones de Prisma'
      );

      // Exportación de tipos de CashClosing
      assert.ok(
        dtsContent.includes('export type CashClosing ='),
        'Falta export type CashClosing en definiciones de Prisma'
      );
      assert.ok(
        dtsContent.includes('$CashClosingPayload'),
        'Falta $CashClosingPayload en definiciones de Prisma'
      );
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Verificación de los 7 Índices de PostgreSQL y Ausencia de Colisiones (A-11)
  // --------------------------------------------------------------------------
  describe('3. Verificación de Índices y Ausencia de Colisiones (A-11)', () => {
    let ddlOutput = '';

    before(() => {
      ddlOutput = execSync(
        'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
        {
          cwd: rootDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
    });

    it('Los 7 índices requeridos por A-11 deben existir en prisma/schema.prisma', () => {
      const content = fs.readFileSync(schemaPath, 'utf-8');

      const requiredIndexPatterns = [
        { name: 'User.assignedEventId', pattern: /@@index\(\[assignedEventId\]\)/ },
        { name: 'Product(tenantId, isActive)', pattern: /@@index\(\[tenantId,\s*isActive\]\)/ },
        { name: 'Sale.sellerId', pattern: /@@index\(\[sellerId\]\)/ },
        { name: 'SaleItem.productId', pattern: /@@index\(\[productId\]\)/ },
        { name: 'ProductionLog.userId', pattern: /@@index\(\[userId\]\)/ },
        { name: 'CashClosing.closedById', pattern: /@@index\(\[closedById\]\)/ },
        { name: 'AuditLog.userId', pattern: /@@index\(\[userId\]\)/ },
      ];

      for (const idx of requiredIndexPatterns) {
        assert.ok(
          idx.pattern.test(content),
          `Falta el índice requerido ${idx.name} en prisma/schema.prisma`
        );
      }
    });

    it('El DDL de PostgreSQL generado debe contener sentencias CREATE INDEX válidas para los 7 índices', () => {
      const expectedDdlIndexes = [
        'CREATE INDEX "users_assignedEventId_idx" ON "users"("assignedEventId");',
        'CREATE INDEX "products_tenantId_isActive_idx" ON "products"("tenantId", "isActive");',
        'CREATE INDEX "sales_sellerId_idx" ON "sales"("sellerId");',
        'CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");',
        'CREATE INDEX "production_logs_userId_idx" ON "production_logs"("userId");',
        'CREATE INDEX "cash_closings_closedById_idx" ON "cash_closings"("closedById");',
        'CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");',
      ];

      for (const ddlIndex of expectedDdlIndexes) {
        assert.ok(
          ddlOutput.includes(ddlIndex),
          `Sentencia DDL faltante en PostgreSQL:\n${ddlIndex}`
        );
      }
    });

    it('Ningún nombre de índice debe colisionar o estar duplicado en el DDL', () => {
      const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"([^"]+)"/g;
      const indexNames = [];
      let match;

      while ((match = indexRegex.exec(ddlOutput)) !== null) {
        indexNames.push(match[1]);
      }

      assert.ok(indexNames.length >= 20, `Se esperaban al menos 20 índices, se encontraron ${indexNames.length}`);

      const duplicates = indexNames.filter((name, index) => indexNames.indexOf(name) !== index);
      assert.deepEqual(
        duplicates,
        [],
        `Colisión de nombres de índices detectada en PostgreSQL: ${duplicates.join(', ')}`
      );
    });

    it('No deben existir índices redundantes con las mismas columnas exactas en la misma tabla', () => {
      const indexDefRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"[^"]+"\s+ON\s+"([^"]+)"\(([^)]+)\);/g;
      const tableColumnPairs = new Set();
      const collisions = [];
      let match;

      while ((match = indexDefRegex.exec(ddlOutput)) !== null) {
        const table = match[1];
        const columns = match[2].replace(/\s+/g, '');
        const key = `${table}:${columns}`;
        if (tableColumnPairs.has(key)) {
          collisions.push(key);
        }
        tableColumnPairs.add(key);
      }

      assert.deepEqual(
        collisions,
        [],
        `Índices redundantes duplicando columnas en la misma tabla: ${collisions.join(', ')}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: DMMF AST y Verificación Estructural de onDelete: Restrict (A-13)
  // --------------------------------------------------------------------------
  describe('4. Verificación Estructural en DMMF y DDL de onDelete: Restrict (A-13)', () => {
    it('Sale.event en DMMF debe especificar relationOnDelete === "Restrict"', () => {
      const saleModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Sale');
      assert.ok(saleModel, 'Modelo Sale no encontrado en DMMF');
      const eventField = saleModel.fields.find((f) => f.name === 'event');
      assert.ok(eventField, 'Campo event no encontrado en Sale');
      assert.equal(
        eventField.relationOnDelete,
        'Restrict',
        'Sale.event debe tener relationOnDelete === "Restrict"'
      );
    });

    it('CashClosing.event en DMMF debe especificar relationOnDelete === "Restrict"', () => {
      const ccModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'CashClosing');
      assert.ok(ccModel, 'Modelo CashClosing no encontrado en DMMF');
      const eventField = ccModel.fields.find((f) => f.name === 'event');
      assert.ok(eventField, 'Campo event no encontrado en CashClosing');
      assert.equal(
        eventField.relationOnDelete,
        'Restrict',
        'CashClosing.event debe tener relationOnDelete === "Restrict"'
      );
    });

    it('Sale.seller y CashClosing.closedBy deben tener relationOnDelete === "Restrict"', () => {
      const saleModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Sale');
      const sellerField = saleModel.fields.find((f) => f.name === 'seller');
      assert.equal(sellerField.relationOnDelete, 'Restrict');

      const ccModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'CashClosing');
      const closedByField = ccModel.fields.find((f) => f.name === 'closedBy');
      assert.equal(closedByField.relationOnDelete, 'Restrict');
    });

    it('User.assignedEvent debe tener relationOnDelete === "SetNull"', () => {
      const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'User');
      const assignedEventField = userModel.fields.find((f) => f.name === 'assignedEvent');
      assert.equal(assignedEventField.relationOnDelete, 'SetNull');
    });

    it('DDL de PostgreSQL debe declarar ON DELETE RESTRICT en Foreign Keys hacia events', () => {
      const ddlOutput = execSync(
        'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
        {
          cwd: rootDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      const expectedSaleFk =
        'ALTER TABLE "sales" ADD CONSTRAINT "sales_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;';
      const expectedCashClosingFk =
        'ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;';

      assert.ok(
        ddlOutput.includes(expectedSaleFk),
        `Falta constraint ON DELETE RESTRICT en sales.eventId:\n${expectedSaleFk}`
      );
      assert.ok(
        ddlOutput.includes(expectedCashClosingFk),
        `Falta constraint ON DELETE RESTRICT en cash_closings.eventId:\n${expectedCashClosingFk}`
      );

      // Verificación negativa: Ningún FK hacia events(id) debe tener ON DELETE CASCADE
      const lines = ddlOutput.split('\n');
      const invalidEventCascadeFks = lines.filter(
        (l) => l.includes('REFERENCES "events"("id")') && l.includes('ON DELETE CASCADE')
      );
      assert.deepEqual(
        invalidEventCascadeFks,
        [],
        `Se encontró un FK hacia events con ON DELETE CASCADE no permitido: ${invalidEventCascadeFks.join(', ')}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: Oráculo de Integridad Referencial Empírica en Vivo (Motor SQL In-Memory)
  // --------------------------------------------------------------------------
  describe('5. Oráculo Empírico de Integridad Referencial en Vivo (node:sqlite)', () => {

    function setupDatabase(saleOnDelete = 'RESTRICT', cashClosingOnDelete = 'RESTRICT') {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      db.exec(`
        CREATE TABLE tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );

        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          fullName TEXT NOT NULL,
          assignedEventId TEXT,
          FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
          FOREIGN KEY (assignedEventId) REFERENCES events(id) ON DELETE SET NULL
        );

        CREATE TABLE events (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          name TEXT NOT NULL,
          FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
        );

        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          name TEXT NOT NULL,
          FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
        );

        CREATE TABLE sales (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          eventId TEXT NOT NULL,
          sellerId TEXT NOT NULL,
          saleNumber TEXT NOT NULL,
          totalAmount REAL NOT NULL,
          FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
          FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE ${saleOnDelete},
          FOREIGN KEY (sellerId) REFERENCES users(id) ON DELETE RESTRICT
        );

        CREATE TABLE sale_items (
          id TEXT PRIMARY KEY,
          saleId TEXT NOT NULL,
          productId TEXT,
          description TEXT NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
        );

        CREATE TABLE production_logs (
          id TEXT PRIMARY KEY,
          saleItemId TEXT NOT NULL,
          userId TEXT,
          notes TEXT,
          FOREIGN KEY (saleItemId) REFERENCES sale_items(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE sale_payments (
          id TEXT PRIMARY KEY,
          saleId TEXT NOT NULL,
          amount REAL NOT NULL,
          FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
        );

        CREATE TABLE cash_closings (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          eventId TEXT NOT NULL,
          closedById TEXT NOT NULL,
          totalCashCalculated REAL NOT NULL,
          FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
          FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE ${cashClosingOnDelete},
          FOREIGN KEY (closedById) REFERENCES users(id) ON DELETE RESTRICT
        );
      `);

      return db;
    }

    it('CASO 1: Un intento de borrar un Evento con Ventas asociadas DEBE FALLAR y preservar la venta intacta', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      // Poblar entidades
      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u1', 't1', 'Vendedor Demo');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Feria del Libro 2026');
        INSERT INTO sales (id, tenantId, eventId, sellerId, saleNumber, totalAmount) 
          VALUES ('s1', 't1', 'e1', 'u1', 'VEN-001', 150.00);
      `);

      // Intentar borrar el evento
      assert.throws(
        () => {
          db.exec("DELETE FROM events WHERE id = 'e1';");
        },
        /FOREIGN KEY constraint failed/i,
        'El borrado del evento debió fallar por restricción de integridad referencial'
      );

      // Comprobar que el evento sigue existiendo
      const eventRows = db.prepare("SELECT * FROM events WHERE id = 'e1';").all();
      assert.equal(eventRows.length, 1, 'El evento no debió ser borrado');

      // Comprobar que la venta sigue intacta con todos sus datos
      const saleRows = db.prepare("SELECT * FROM sales WHERE id = 's1';").all();
      assert.equal(saleRows.length, 1, 'La venta debió conservarse intacta');
      assert.equal(saleRows[0].totalAmount, 150.00);
      assert.equal(saleRows[0].saleNumber, 'VEN-001');

      db.close();
    });

    it('CASO 2: Un intento de borrar un Evento con Cierres de Caja asociados DEBE FALLAR y preservar el arqueo', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u1', 't1', 'Cajero Demo');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Bazar Navideño 2026');
        INSERT INTO cash_closings (id, tenantId, eventId, closedById, totalCashCalculated)
          VALUES ('cc1', 't1', 'e1', 'u1', 4500.00);
      `);

      assert.throws(
        () => {
          db.exec("DELETE FROM events WHERE id = 'e1';");
        },
        /FOREIGN KEY constraint failed/i,
        'El borrado del evento debió fallar por restricción de integridad del arqueo'
      );

      const eventRows = db.prepare("SELECT * FROM events WHERE id = 'e1';").all();
      assert.equal(eventRows.length, 1);

      const ccRows = db.prepare("SELECT * FROM cash_closings WHERE id = 'cc1';").all();
      assert.equal(ccRows.length, 1);
      assert.equal(ccRows[0].totalCashCalculated, 4500.00);

      db.close();
    });

    it('CASO 3 (CONTRAFACTUAL ADVERSARIAL): Probar que bajo ON DELETE CASCADE las ventas y arqueos se destruían silenciosamente', () => {
      // Simulación del estado vulnerable anterior
      const dbVulnerable = setupDatabase('CASCADE', 'CASCADE');

      dbVulnerable.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u1', 't1', 'Vendedor Demo');
        INSERT INTO events (id, tenantId, name) VALUES ('e_vulnerable', 't1', 'Evento Pasado');
        INSERT INTO sales (id, tenantId, eventId, sellerId, saleNumber, totalAmount) 
          VALUES ('s_destruida', 't1', 'e_vulnerable', 'u1', 'VEN-999', 999.00);
        INSERT INTO cash_closings (id, tenantId, eventId, closedById, totalCashCalculated)
          VALUES ('cc_destruido', 't1', 'e_vulnerable', 'u1', 999.00);
      `);

      // Bajo CASCADE, el borrado no falla y elimina todo
      dbVulnerable.exec("DELETE FROM events WHERE id = 'e_vulnerable';");

      const saleRows = dbVulnerable.prepare("SELECT * FROM sales WHERE id = 's_destruida';").all();
      const ccRows = dbVulnerable.prepare("SELECT * FROM cash_closings WHERE id = 'cc_destruido';").all();

      assert.equal(
        saleRows.length,
        0,
        'En el esquema anterior con CASCADE, las ventas eran destruidas sin aviso'
      );
      assert.equal(
        ccRows.length,
        0,
        'En el esquema anterior con CASCADE, los cierres de caja eran destruidos sin aviso'
      );

      dbVulnerable.close();
    });

    it('CASO 4: Un Evento SIN ventas ni arqueos puede eliminarse limpiamente, dejando al vendedor asignado con null', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO events (id, tenantId, name) VALUES ('e_vacio', 't1', 'Evento Cancelado');
        INSERT INTO users (id, tenantId, fullName, assignedEventId) 
          VALUES ('u_asignado', 't1', 'Vendedor Reubicable', 'e_vacio');
      `);

      // Como no hay ventas ni arqueos, el borrado de evento debe proceder
      db.exec("DELETE FROM events WHERE id = 'e_vacio';");

      const eventRows = db.prepare("SELECT * FROM events WHERE id = 'e_vacio';").all();
      assert.equal(eventRows.length, 0, 'El evento vacío debió ser eliminado');

      // El usuario debe sobrevivir y su assignedEventId debe ser NULL (SetNull)
      const userRows = db.prepare("SELECT * FROM users WHERE id = 'u_asignado';").all();
      assert.equal(userRows.length, 1, 'El usuario vendedor no debió ser borrado');
      assert.equal(userRows[0].assignedEventId, null, 'assignedEventId debió cambiar a null');

      db.close();
    });

    it('CASO 5: Intentar borrar el Vendedor de una Venta existente debe ser bloqueado por onDelete: Restrict', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u_vendedor', 't1', 'Vendedor Estrella');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Feria Activa');
        INSERT INTO sales (id, tenantId, eventId, sellerId, saleNumber, totalAmount)
          VALUES ('s2', 't1', 'e1', 'u_vendedor', 'VEN-002', 200.00);
      `);

      assert.throws(
        () => {
          db.exec("DELETE FROM users WHERE id = 'u_vendedor';");
        },
        /FOREIGN KEY constraint failed/i,
        'No se debe permitir eliminar un usuario que tiene ventas registradas'
      );

      const userRows = db.prepare("SELECT * FROM users WHERE id = 'u_vendedor';").all();
      assert.equal(userRows.length, 1);

      db.close();
    });

    it('CASO 6: Intentar borrar el Responsable de un Cierre de Caja debe ser bloqueado por onDelete: Restrict', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u_cajero', 't1', 'Cajero Encargado');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Feria Activa');
        INSERT INTO cash_closings (id, tenantId, eventId, closedById, totalCashCalculated)
          VALUES ('cc2', 't1', 'e1', 'u_cajero', 3000.00);
      `);

      assert.throws(
        () => {
          db.exec("DELETE FROM users WHERE id = 'u_cajero';");
        },
        /FOREIGN KEY constraint failed/i,
        'No se debe permitir eliminar un usuario que tiene cierres de caja registrados'
      );

      const userRows = db.prepare("SELECT * FROM users WHERE id = 'u_cajero';").all();
      assert.equal(userRows.length, 1);

      db.close();
    });

    it('CASO 7: Borrar un Producto deja los ítems históricos de venta intactos con productId null (onDelete: SetNull)', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u1', 't1', 'Vendedor');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Feria Activa');
        INSERT INTO products (id, tenantId, name) VALUES ('p1', 't1', 'Póster Vintage 001');
        INSERT INTO sales (id, tenantId, eventId, sellerId, saleNumber, totalAmount)
          VALUES ('s1', 't1', 'e1', 'u1', 'VEN-100', 45.00);
        INSERT INTO sale_items (id, saleId, productId, description, subtotal)
          VALUES ('si1', 's1', 'p1', 'Póster Vintage 001 Mediano', 45.00);
      `);

      // Borrar el producto
      db.exec("DELETE FROM products WHERE id = 'p1';");

      const itemRows = db.prepare("SELECT * FROM sale_items WHERE id = 'si1';").all();
      assert.equal(itemRows.length, 1, 'El ítem de venta histórico no debe ser eliminado');
      assert.equal(itemRows[0].productId, null, 'productId debe ser seteado a null');
      assert.equal(itemRows[0].description, 'Póster Vintage 001 Mediano', 'La descripción histórica persiste');

      db.close();
    });

    it('CASO 8: La cascada interna de Venta -> SaleItem -> ProductionLog y SalePayment opera sin tocar Evento ni Usuario', () => {
      const db = setupDatabase('RESTRICT', 'RESTRICT');

      db.exec(`
        INSERT INTO tenants (id, name) VALUES ('t1', 'Deco Vintage');
        INSERT INTO users (id, tenantId, fullName) VALUES ('u1', 't1', 'Vendedor');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Feria Activa');
        INSERT INTO sales (id, tenantId, eventId, sellerId, saleNumber, totalAmount)
          VALUES ('s_cascade', 't1', 'e1', 'u1', 'VEN-CASCADE', 100.00);
        INSERT INTO sale_items (id, saleId, description, subtotal)
          VALUES ('si_cascade', 's_cascade', 'Ítem a borrar', 100.00);
        INSERT INTO production_logs (id, saleItemId, userId, notes)
          VALUES ('pl_cascade', 'si_cascade', 'u1', 'Log de producción');
        INSERT INTO sale_payments (id, saleId, amount)
          VALUES ('sp_cascade', 's_cascade', 100.00);
      `);

      // Borrar la venta directamente (por ejemplo en anulación formal)
      db.exec("DELETE FROM sales WHERE id = 's_cascade';");

      // Verificar que los sub-registros se eliminan en cascada
      assert.equal(db.prepare("SELECT * FROM sale_items WHERE id = 'si_cascade';").all().length, 0);
      assert.equal(db.prepare("SELECT * FROM production_logs WHERE id = 'pl_cascade';").all().length, 0);
      assert.equal(db.prepare("SELECT * FROM sale_payments WHERE id = 'sp_cascade';").all().length, 0);

      // Verificar que el Evento y el Usuario persisten intactos
      assert.equal(db.prepare("SELECT * FROM events WHERE id = 'e1';").all().length, 1);
      assert.equal(db.prepare("SELECT * FROM users WHERE id = 'u1';").all().length, 1);

      db.close();
    });
  });
});
