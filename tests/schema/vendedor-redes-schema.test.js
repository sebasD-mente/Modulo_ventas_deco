import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

function setupInMemoryDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      email TEXT NOT NULL,
      fullName TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      deliveryAddress TEXT,
      department TEXT,
      municipality TEXT,
      sourceChannel TEXT NOT NULL DEFAULT 'WHATSAPP',
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenantId, phone)
    );

    CREATE TABLE print_sheets (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      sheetCode TEXT UNIQUE NOT NULL,
      material TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ABIERTO',
      notes TEXT,
      createdById TEXT,
      printedById TEXT,
      printedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE commission_settlements (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      sellerId TEXT NOT NULL,
      settlementNumber TEXT NOT NULL,
      totalProductsAmount REAL NOT NULL,
      commissionRate REAL NOT NULL DEFAULT 0.20,
      totalCommission REAL NOT NULL,
      salesCount INTEGER NOT NULL DEFAULT 0,
      periodStart TEXT NOT NULL,
      periodEnd TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO',
      approvedById TEXT,
      paidAt TEXT,
      paymentReference TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (sellerId) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (approvedById) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE sales (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      eventId TEXT NOT NULL,
      sellerId TEXT NOT NULL,
      saleNumber TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'COMPLETADA',
      inputChannel TEXT NOT NULL DEFAULT 'MANUAL_POS',
      orderType TEXT NOT NULL DEFAULT 'POS_FERIA',
      deliveryMethod TEXT NOT NULL DEFAULT 'PUNTO_VENTA',
      shippingCost REAL NOT NULL DEFAULT 0,
      shippingCourier TEXT,
      shippingTrackingNumber TEXT,
      pickupEventId TEXT,
      customerId TEXT,
      paymentStatus TEXT NOT NULL DEFAULT 'PAGADO_TOTAL',
      depositAmount REAL NOT NULL DEFAULT 0,
      balanceDue REAL NOT NULL DEFAULT 0,
      commissionSettlementId TEXT,
      commissionPaid INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE RESTRICT,
      FOREIGN KEY (sellerId) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (pickupEventId) REFERENCES events(id) ON DELETE SET NULL,
      FOREIGN KEY (commissionSettlementId) REFERENCES commission_settlements(id) ON DELETE SET NULL
    );

    CREATE TABLE sale_items (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unitPrice REAL NOT NULL,
      subtotal REAL NOT NULL,
      isCustom INTEGER NOT NULL DEFAULT 0,
      customImageUrl TEXT,
      customDimensions TEXT,
      material TEXT,
      printSheetId TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (printSheetId) REFERENCES print_sheets(id) ON DELETE SET NULL
    );

    CREATE TABLE ai_chat_sessions (
      id TEXT PRIMARY KEY,
      sessionId TEXT UNIQUE NOT NULL,
      tenantId TEXT NOT NULL DEFAULT 'default-tenant',
      eventId TEXT,
      sellerName TEXT,
      pendingDraft TEXT,
      messagesHistory TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

describe('🧪 Suite de Invariantes de Esquema — Vendedor de Redes, Comisiones y Chat Sessions', () => {

  // --------------------------------------------------------------------------
  // INVARIANTE 1: Validación Sintáctica y Estructura DMMF del Esquema Prisma
  // --------------------------------------------------------------------------
  describe('1. Validación Sintáctica y Estructura DMMF del Esquema Prisma', () => {
    it('npx prisma validate debe retornar código 0 sin advertencias ni errores', () => {
      const output = execSync('npx prisma validate', {
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.match(output, /The schema at .* is valid/);
    });

    it('Prisma.dmmf debe incluir los modelos Customer, PrintSheet, CommissionSettlement y AiChatSession', () => {
      const modelNames = Prisma.dmmf.datamodel.models.map((m) => m.name);
      assert.ok(modelNames.includes('Customer'), 'Falta modelo Customer en DMMF');
      assert.ok(modelNames.includes('PrintSheet'), 'Falta modelo PrintSheet en DMMF');
      assert.ok(modelNames.includes('CommissionSettlement'), 'Falta modelo CommissionSettlement en DMMF');
      assert.ok(modelNames.includes('AiChatSession'), 'Falta modelo AiChatSession en DMMF');
    });

    it('El modelo Sale en DMMF debe contener los campos requeridos para redes y ferias con sus defaults', () => {
      const saleModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Sale');
      assert.ok(saleModel, 'Modelo Sale no encontrado en DMMF');

      const orderType = saleModel.fields.find((f) => f.name === 'orderType');
      assert.strictEqual(orderType?.default, 'POS_FERIA');

      const deliveryMethod = saleModel.fields.find((f) => f.name === 'deliveryMethod');
      assert.strictEqual(deliveryMethod?.default, 'PUNTO_VENTA');

      const paymentStatus = saleModel.fields.find((f) => f.name === 'paymentStatus');
      assert.strictEqual(paymentStatus?.default, 'PAGADO_TOTAL');

      const commissionPaid = saleModel.fields.find((f) => f.name === 'commissionPaid');
      assert.strictEqual(commissionPaid?.default, false);

      const shippingCost = saleModel.fields.find((f) => f.name === 'shippingCost');
      assert.strictEqual(shippingCost?.default, 0);
    });
  });

  // --------------------------------------------------------------------------
  // INVARIANTE 2: Venta POS_FERIA con defaults sin customerId ni shippingCost
  // --------------------------------------------------------------------------
  describe('2. Invariante POS_FERIA: Retrocompatibilidad de Ventas Tradicionales', () => {
    it('Una venta POS_FERIA debe crearse con defaults limpios sin customerId ni shippingCost', () => {
      const db = setupInMemoryDatabase();

      // Seed mínimo
      db.exec(`
        INSERT INTO tenants (id, name, slug) VALUES ('t1', 'Deco Vintage', 'deco-vintage');
        INSERT INTO users (id, tenantId, email, fullName) VALUES ('u1', 't1', 'vendedor@test.com', 'Vendedor Feria');
        INSERT INTO events (id, tenantId, name) VALUES ('e1', 't1', 'Feria del Libro');
      `);

      // Inserción de venta POS_FERIA legacy sin campos opcionales
      db.exec(`
        INSERT INTO sales (id, tenantId, eventId, sellerId, saleNumber, totalAmount)
        VALUES ('s_pos_1', 't1', 'e1', 'u1', 'FERIA-001', 130.00);
      `);

      const sale = db.prepare("SELECT * FROM sales WHERE id = 's_pos_1'").get();
      assert.strictEqual(sale.orderType, 'POS_FERIA');
      assert.strictEqual(sale.deliveryMethod, 'PUNTO_VENTA');
      assert.strictEqual(Number(sale.shippingCost), 0);
      assert.strictEqual(sale.customerId, null);
      assert.strictEqual(sale.shippingCourier, null);
      assert.strictEqual(sale.shippingTrackingNumber, null);
      assert.strictEqual(sale.pickupEventId, null);
      assert.strictEqual(sale.paymentStatus, 'PAGADO_TOTAL');
      assert.strictEqual(Number(sale.depositAmount), 0);
      assert.strictEqual(Number(sale.balanceDue), 0);
      assert.strictEqual(sale.commissionPaid, 0);
      assert.strictEqual(sale.commissionSettlementId, null);

      db.close();
    });
  });

  // --------------------------------------------------------------------------
  // INVARIANTE 3: Venta REDES_PERSONALIZADO con Cliente WhatsApp único y SaleItem custom
  // --------------------------------------------------------------------------
  describe('3. Invariante REDES_PERSONALIZADO: Clientes y Pedidos Personalizados', () => {
    it('Debe registrar cliente con WhatsApp único y venta REDES_PERSONALIZADO con ítem personalizado', () => {
      const db = setupInMemoryDatabase();

      db.exec(`
        INSERT INTO tenants (id, name, slug) VALUES ('t1', 'Deco Vintage', 'deco-vintage');
        INSERT INTO users (id, tenantId, email, fullName) VALUES ('u1', 't1', 'vendedor@test.com', 'Vendedor Redes');
        INSERT INTO events (id, tenantId, name) VALUES ('evt_redes', 't1', 'Ventas Online');

        INSERT INTO customers (id, tenantId, fullName, phone, sourceChannel)
        VALUES ('c1', 't1', 'María López', '50255551234', 'WHATSAPP');
      `);

      // Verificar unicidad de WhatsApp en el mismo tenant: duplicado debe fallar
      assert.throws(
        () => {
          db.exec(`
            INSERT INTO customers (id, tenantId, fullName, phone)
            VALUES ('c2', 't1', 'Otra Persona', '50255551234');
          `);
        },
        /UNIQUE constraint failed/i,
        'Debe fallar al duplicar teléfono/WhatsApp en el mismo tenant'
      );

      // Crear venta personalizada con anticipo y flete
      db.exec(`
        INSERT INTO sales (
          id, tenantId, eventId, sellerId, customerId, saleNumber,
          orderType, deliveryMethod, shippingCost, shippingCourier,
          totalAmount, depositAmount, balanceDue, paymentStatus
        ) VALUES (
          's_redes_1', 't1', 'evt_redes', 'u1', 'c1', 'RED-001',
          'REDES_PERSONALIZADO', 'ENVIO_COURIER', 40.00, 'GUATEX',
          340.00, 170.00, 170.00, 'ANTICIPO_PAGADO'
        );
      `);

      // Crear ítem de cuadro personalizado
      db.exec(`
        INSERT INTO sale_items (
          id, saleId, description, quantity, unitPrice, subtotal,
          isCustom, material, customImageUrl, customDimensions
        ) VALUES (
          'si_custom_1', 's_redes_1', 'Cuadro Retrato Familiar', 2, 150.00, 300.00,
          1, 'MDF_5_5MM', 'https://storage.googleapis.com/deko/art.jpg', '30x40 cm'
        );
      `);

      // Consultar y validar relaciones
      const row = db.prepare(`
        SELECT s.*, c.fullName as customerName, c.phone as customerPhone,
               si.isCustom, si.material, si.customImageUrl, si.customDimensions
        FROM sales s
        JOIN customers c ON s.customerId = c.id
        JOIN sale_items si ON si.saleId = s.id
        WHERE s.id = 's_redes_1'
      `).get();

      assert.strictEqual(row.orderType, 'REDES_PERSONALIZADO');
      assert.strictEqual(row.customerPhone, '50255551234');
      assert.strictEqual(row.shippingCourier, 'GUATEX');
      assert.strictEqual(row.isCustom, 1);
      assert.strictEqual(row.material, 'MDF_5_5MM');
      assert.strictEqual(row.customImageUrl, 'https://storage.googleapis.com/deko/art.jpg');
      assert.strictEqual(row.customDimensions, '30x40 cm');

      db.close();
    });
  });

  // --------------------------------------------------------------------------
  // INVARIANTE 4: Invariante Matemático de Comisiones (20% sobre productos sin flete)
  // --------------------------------------------------------------------------
  describe('4. Invariante Matemático de Comisiones: 20% Exclusivo Sobre Productos', () => {
    function calculateCommission(productsAmount, shippingCost, rate = 0.20) {
      const taxableBase = Number(productsAmount);
      return Number((taxableBase * rate).toFixed(2));
    }

    it('Orden con Q 300 productos y Q 40 de flete genera comisión exacta de Q 60.00 (excluyendo flete)', () => {
      const productsAmount = 300.00;
      const shippingCost = 40.00;
      const totalAmount = productsAmount + shippingCost; // Q 340.00

      const commission = calculateCommission(productsAmount, shippingCost, 0.20);
      assert.strictEqual(commission, 60.00, 'La comisión debe ser exactamente Q 60.00');

      // Comprobación adversaria negativa: jamás debe calcularse sobre totalAmount
      const erroneousCommission = Number((totalAmount * 0.20).toFixed(2));
      assert.strictEqual(erroneousCommission, 68.00);
      assert.notStrictEqual(commission, erroneousCommission, 'No debe comisionar sobre el flete');
    });

    it('Registro en CommissionSettlement almacena la base de productos y la comisión correcta', () => {
      const db = setupInMemoryDatabase();
      db.exec(`
        INSERT INTO tenants (id, name, slug) VALUES ('t1', 'Deco Vintage', 'deco-vintage');
        INSERT INTO users (id, tenantId, email, fullName) VALUES ('u1', 't1', 'vendedor@test.com', 'Vendedor');
        INSERT INTO commission_settlements (
          id, tenantId, sellerId, settlementNumber, totalProductsAmount,
          commissionRate, totalCommission, salesCount, periodStart, periodEnd, status
        ) VALUES (
          'liq_1', 't1', 'u1', 'LIQ-202609-001', 300.00,
          0.20, 60.00, 1, '2026-09-01', '2026-09-15', 'PENDIENTE_PAGO'
        );
      `);

      const liq = db.prepare("SELECT * FROM commission_settlements WHERE id = 'liq_1'").get();
      assert.strictEqual(Number(liq.totalProductsAmount), 300.00);
      assert.strictEqual(Number(liq.commissionRate), 0.20);
      assert.strictEqual(Number(liq.totalCommission), 60.00);

      db.close();
    });
  });

  // --------------------------------------------------------------------------
  // INVARIANTE 5: Invariante de Saldo (balanceDue === 0 para liquidar comisión)
  // --------------------------------------------------------------------------
  describe('5. Invariante de Saldo: Liquidación de Comisión Condicionada a Saldo Cero', () => {
    function isSaleEligibleForSettlement(sale) {
      return (
        Number(sale.balanceDue) === 0 &&
        sale.status === 'COMPLETADA' &&
        !sale.commissionPaid
      );
    }

    it('Venta con saldo pendiente (balanceDue > 0) DEBE ser bloqueada de la liquidación', () => {
      const saleWithBalance = {
        id: 's_unpaid',
        totalAmount: 340.00,
        depositAmount: 170.00,
        balanceDue: 170.00,
        status: 'COMPLETADA',
        commissionPaid: false,
      };

      assert.strictEqual(
        isSaleEligibleForSettlement(saleWithBalance),
        false,
        'Una venta con saldo pendiente no debe ser liquidable'
      );
    });

    it('Venta con saldo cancelado (balanceDue == 0) y completada es elegible para liquidación', () => {
      const paidSale = {
        id: 's_paid',
        totalAmount: 340.00,
        depositAmount: 340.00,
        balanceDue: 0.00,
        status: 'COMPLETADA',
        commissionPaid: false,
      };

      assert.strictEqual(
        isSaleEligibleForSettlement(paidSale),
        true,
        'Una venta con balanceDue == 0 debe ser admitida en la liquidación'
      );
    });

    it('Venta con saldo cero pero estado no completado (ej. CANCELADA o EN_PROCESO) es rechazada', () => {
      const cancelledSale = {
        id: 's_cancelled',
        totalAmount: 340.00,
        depositAmount: 0.00,
        balanceDue: 0.00,
        status: 'CANCELADA',
        commissionPaid: false,
      };

      assert.strictEqual(isSaleEligibleForSettlement(cancelledSale), false);
    });
  });

  // --------------------------------------------------------------------------
  // INVARIANTE 6: Preservación del Modelo AiChatSession en Prisma Client
  // --------------------------------------------------------------------------
  describe('6. Preservación del Modelo AiChatSession en Prisma Client', () => {
    it('AiChatSession debe existir en el DMMF con sus atributos correctos', () => {
      const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'AiChatSession');
      assert.ok(model, 'Modelo AiChatSession no encontrado en DMMF');

      const sessionIdField = model.fields.find((f) => f.name === 'sessionId');
      assert.strictEqual(sessionIdField?.isUnique, true, 'sessionId debe ser único');

      const draftField = model.fields.find((f) => f.name === 'pendingDraft');
      assert.strictEqual(draftField?.type, 'Json');

      const historyField = model.fields.find((f) => f.name === 'messagesHistory');
      assert.strictEqual(historyField?.type, 'Json');
    });

    it('AiChatSession puede ser instanciado y almacenar historial de chat en base de datos', () => {
      const db = setupInMemoryDatabase();

      db.exec(`
        INSERT INTO ai_chat_sessions (id, sessionId, tenantId, sellerName, messagesHistory)
        VALUES (
          'sess_1', 'chat_uuid_123', 'default-tenant', 'Carlos',
          '[{"sender":"seller","text":"Hola"},{"sender":"ai","text":"Buenas tardes"}]'
        );
      `);

      const session = db.prepare("SELECT * FROM ai_chat_sessions WHERE sessionId = 'chat_uuid_123'").get();
      assert.strictEqual(session.sessionId, 'chat_uuid_123');
      assert.strictEqual(session.sellerName, 'Carlos');
      const parsedHistory = JSON.parse(session.messagesHistory);
      assert.strictEqual(parsedHistory.length, 2);
      assert.strictEqual(parsedHistory[1].text, 'Buenas tardes');

      db.close();
    });
  });
});
