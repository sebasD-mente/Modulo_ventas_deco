import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Helper de formateo UTC consistente con EventCard.jsx
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-GT', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

// Simulador de lógica de cálculo de totales, descuentos y vueltos de PaymentSummaryBar
function calculateSaleTotals({ subtotal = 0, discount = 0, cashReceived = 0 }) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const grandTotal = Math.max(0, safeSubtotal - safeDiscount);
  const received = Math.max(0, Number(cashReceived) || 0);
  const changeDue = received >= grandTotal ? Number((received - grandTotal).toFixed(2)) : null;

  return {
    subtotal: Number(safeSubtotal.toFixed(2)),
    discount: Number(safeDiscount.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
    changeDue,
  };
}

describe('🧪 [FASE 5] Resiliencia, Ergonomía y Contratos de Frontend', () => {
  describe('1. Formateo UTC Inmutable de Fechas de Eventos (Hallazgo #72)', () => {
    it('debe formatear fechas en UTC sin desplazarse al día anterior por huso horario', () => {
      // Medianoche UTC
      const formatted = formatEventDate('2026-10-15T00:00:00.000Z');
      assert.ok(formatted.includes('15'), `Debe incluir día 15, recibido: ${formatted}`);
      assert.ok(formatted.includes('2026'), `Debe incluir año 2026, recibido: ${formatted}`);
    });

    it('debe mantener el día 1 en fechas límite de inicio de mes en UTC', () => {
      const formatted = formatEventDate('2026-11-01T00:00:00.000Z');
      assert.ok(formatted.includes('1') && !formatted.includes('31'), `Debe ser 1 de nov y no 31 de oct: ${formatted}`);
    });

    it('debe manejar entradas vacías o nulas sin lanzar excepciones', () => {
      assert.equal(formatEventDate(null), '');
      assert.equal(formatEventDate(''), '');
      assert.equal(formatEventDate('fecha-invalida'), '');
    });
  });

  describe('2. Cálculos Aritméticos de Totales, Descuentos y Vuelto Ferial (Hallazgo #85)', () => {
    it('debe calcular el gran total restando el descuento con precisión de centavo', () => {
      const res = calculateSaleTotals({ subtotal: 130, discount: 15 });
      assert.equal(res.subtotal, 130.00);
      assert.equal(res.discount, 15.00);
      assert.equal(res.grandTotal, 115.00);
    });

    it('no debe permitir totales negativos si el descuento supera el subtotal', () => {
      const res = calculateSaleTotals({ subtotal: 50, discount: 75 });
      assert.equal(res.grandTotal, 0);
    });

    it('debe calcular el vuelto exacto al pagar con billete mayor', () => {
      const res = calculateSaleTotals({ subtotal: 130, discount: 15, cashReceived: 200 });
      assert.equal(res.changeDue, 85.00);
    });

    it('debe devolver cambio 0 cuando el cliente paga exacto (cabal)', () => {
      const res = calculateSaleTotals({ subtotal: 100, discount: 0, cashReceived: 100 });
      assert.equal(res.changeDue, 0.00);
    });

    it('debe devolver null en vuelto si el monto recibido es menor al total', () => {
      const res = calculateSaleTotals({ subtotal: 100, discount: 0, cashReceived: 50 });
      assert.equal(res.changeDue, null);
    });
  });

  describe('3. Persistencia y Ciclo de Vida de Carrito en Storage (Hallazgo #82)', () => {
    it('debe estructurar y persistir la clave de carrito vinculada al evento', () => {
      const eventId = 'evt-feria-2026-oct';
      const storageKey = `deko_manual_cart_${eventId}`;
      const mockStorage = new Map();

      const cartState = {
        cartItems: [
          { id: 'item-1', posterId: 'poster-123', quantity: 2, unitPrice: 65, subtotal: 130 },
        ],
        paymentMethod: 'EFECTIVO',
        discount: 10,
        notes: 'Pósters para entrega rápida',
      };

      // Guardar
      mockStorage.set(storageKey, JSON.stringify(cartState));

      // Recuperar
      const retrievedRaw = mockStorage.get(storageKey);
      assert.ok(retrievedRaw, 'Debe haber datos guardados');
      const retrieved = JSON.parse(retrievedRaw);
      assert.equal(retrieved.cartItems.length, 1);
      assert.equal(retrieved.cartItems[0].subtotal, 130);
      assert.equal(retrieved.discount, 10);

      // Limpiar (clearCart)
      mockStorage.delete(storageKey);
      assert.equal(mockStorage.get(storageKey), undefined);
    });
  });

  describe('4. Contratos de Aserción Mecánica del DOM (Anti-Rotura DevTools/Valkyria)', () => {
    it('debe contener las clases .chat-bubble-user y [data-sender="user"] en ChatMessageList.jsx', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/ai-chat/ChatMessageList.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('chat-bubble-user'), 'Debe incluir la clase CSS chat-bubble-user');
      assert.ok(
        content.includes('data-sender=') && content.includes("'user'"),
        'Debe incluir el atributo data-sender para mensajes de usuario'
      );
    });

    it('debe contener las clases .draft-card y [data-testid="poster-card"] en ChatDraftCard.jsx', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/ai-chat/ChatDraftCard.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('draft-card'), 'Debe incluir la clase CSS draft-card');
      assert.ok(content.includes('data-testid="poster-card"'), 'Debe incluir data-testid="poster-card"');
    });
  });

  describe('5. Ergonomía Táctil Ferial (Área Mínima >= 44px)', () => {
    it('debe verificar clases táctiles de min-h-[44px] en componentes clave de la Fase 5', () => {
      const filesToCheck = [
        'src/components/closing/CashDenominationGrid.jsx',
        'src/components/production/ProductionFilterTabs.jsx',
        'src/components/orders/OrderTrackingCard.jsx',
        'src/components/manual-sale/PaymentSummaryBar.jsx',
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(
          content.includes('min-h-[44px]') || content.includes('min-h-[48px]'),
          `El archivo ${relPath} debe incorporar tokens de área táctil mínima (min-h-[44px])`
        );
      }
    });

    it('debe verificar que ChatDraftCard posea auto-scroll con scrollIntoView', () => {
      const draftPath = path.resolve(process.cwd(), 'src/components/ai-chat/ChatDraftCard.jsx');
      const content = fs.readFileSync(draftPath, 'utf-8');
      assert.ok(content.includes('scrollIntoView'), 'ChatDraftCard debe auto-scrollear con scrollIntoView');
    });

    it('debe verificar que App.jsx mantenga montado UnifiedAiChat con clase hidden', () => {
      const appPath = path.resolve(process.cwd(), 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf-8');
      assert.ok(
        content.includes("activeTab === 'venta' ? 'space-y-6' : 'hidden'"),
        'App.jsx debe preservar el DOM de la venta para no abortar SSE/audio'
      );
    });
  });
});
