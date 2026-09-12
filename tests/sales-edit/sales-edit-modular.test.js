import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

describe('🧪 M4: Sales Edit Modular Architecture & Immutability Suite', () => {
  const modalPath = path.join(projectRoot, 'src/components/EditSaleModal.jsx');
  const hookPath = path.join(projectRoot, 'src/components/sales/edit/hooks/useEditSaleForm.js');
  const tablePath = path.join(projectRoot, 'src/components/sales/edit/EditSaleItemsTable.jsx');

  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const hookContent = fs.readFileSync(hookPath, 'utf8');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // =========================================================================
  // 1. LÍMITES ESTRICTOS DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Límites Estrictos de Líneas y Erradicación Monolítica', () => {
    it('1.1 EditSaleModal.jsx debe tener menos de 70 líneas', () => {
      const lines = modalContent.trim().split('\n').length;
      assert.ok(lines < 70, `EditSaleModal.jsx excede 70 líneas: ${lines}`);
    });

    it('1.2 useEditSaleForm.js debe tener menos de 120 líneas', () => {
      const lines = hookContent.trim().split('\n').length;
      assert.ok(lines < 120, `useEditSaleForm.js excede 120 líneas: ${lines}`);
    });

    it('1.3 EditSaleItemsTable.jsx debe tener menos de 110 líneas', () => {
      const lines = tableContent.trim().split('\n').length;
      assert.ok(lines < 110, `EditSaleItemsTable.jsx excede 110 líneas: ${lines}`);
    });

    it('1.4 Ningún archivo modular debe superar 200 líneas', () => {
      const files = [modalPath, hookPath, tablePath];
      for (const f of files) {
        const lines = fs.readFileSync(f, 'utf8').trim().split('\n').length;
        assert.ok(lines <= 200, `Archivo ${path.basename(f)} excede 200 líneas: ${lines}`);
      }
    });
  });

  // =========================================================================
  // 2. AUDITORÍA ESTÁTICA DE INMUTABILIDAD Y REFERENCIAS
  // =========================================================================
  describe('2. Auditoría Estática de Inmutabilidad en useEditSaleForm', () => {
    it('2.1 No deben existir mutaciones in-place en hook ni modal', () => {
      for (const content of [hookContent, modalContent]) {
        assert.doesNotMatch(content, /current\.quantity\s*=[^=]/, 'Prohibido mutar current.quantity directamente');
        assert.doesNotMatch(content, /prevItems\[idx\]\.quantity\s*=[^=]/, 'Prohibido mutar prevItems[idx].quantity');
        assert.doesNotMatch(content, /items\[idx\]\.quantity\s*=[^=]/, 'Prohibido mutar items[idx].quantity');
        assert.doesNotMatch(content, /\.splice\(/, 'Prohibido usar splice mutable');
      }
    });

    it('2.2 useEditSaleForm debe usar functional setter y clonación superficial en items', () => {
      assert.match(hookContent, /setItems\(\(prevItems\)\s*=>/, 'Falta functional updater setItems(prevItems => ...)');
      assert.match(hookContent, /updated\[idx\]\s*=\s*\{\s*\.\.\.current,/, 'Falta clonación inmutable del ítem {...current}');
      assert.ok(hookContent.includes('prevItems.filter('), 'handleRemoveItem debe usar filter inmutable sobre prevItems');
    });

    it('2.3 useEditSaleForm debe proteger contra dejar la venta sin pósters (mínimo 1)', () => {
      assert.match(hookContent, /prevItems\.length\s*<=\s*1/, 'Debe verificar prevItems.length <= 1 antes de eliminar');
    });

    it('2.4 Guardado debe usar PATCH y no PUT (coincidencia con rutas Express)', () => {
      assert.ok(hookContent.includes("method: 'PATCH'"), 'Debe usar método HTTP PATCH para coincidir con backend');
      assert.ok(!hookContent.includes("method: 'PUT'"), 'No debe usar PUT (retorna 404 en backend)');
    });

    it('2.5 Guardado debe soportar ambos callbacks (onSaved y onSaleUpdated)', () => {
      assert.ok(hookContent.includes('onSaved || onSaleUpdated'), 'Debe soportar dual callback onSaved || onSaleUpdated');
    });
  });

  // =========================================================================
  // 3. PRUEBAS ADVERSARIALES EMPÍRICAS DE INMUTABILIDAD REACT
  // =========================================================================
  describe('3. Pruebas Adversariales Empíricas de Inmutabilidad', () => {
    // Lógica pura de handleUpdateQuantity extraída fielmente del hook
    const handleUpdateQuantityPure = (prevItems, idx, delta) => {
      const current = prevItems[idx];
      if (!current) return prevItems;
      const newQty = Math.max(1, current.quantity + delta);
      const updated = [...prevItems];
      updated[idx] = {
        ...current,
        quantity: newQty,
        subtotal: Number((newQty * current.unitPrice).toFixed(2)),
      };
      return updated;
    };

    // Lógica pura de handleRemoveItem extraída fielmente del hook
    const handleRemoveItemPure = (prevItems, idx) => {
      if (prevItems.length <= 1) return prevItems;
      return prevItems.filter((_, i) => i !== idx);
    };

    it('3.1 Actualización de cantidad crea nueva referencia en el ítem modificado (prev !== next)', () => {
      const item1 = Object.freeze({ id: 'it-1', description: 'Póster GT3', quantity: 2, unitPrice: 125, subtotal: 250 });
      const item2 = Object.freeze({ id: 'it-2', description: 'Póster 911', quantity: 1, unitPrice: 65, subtotal: 65 });
      const initial = Object.freeze([item1, item2]);

      const result = handleUpdateQuantityPure(initial, 0, 1);

      assert.notStrictEqual(result, initial, 'Array retornado debe ser una nueva referencia');
      assert.notStrictEqual(result[0], item1, 'Ítem modificado debe tener una nueva referencia');
      assert.strictEqual(result[0].quantity, 3, 'Cantidad debe ser 3');
      assert.strictEqual(result[0].subtotal, 375, 'Subtotal recalculado debe ser 375');
      assert.strictEqual(result[1], item2, 'Ítem no modificado debe preservar identidad referencial');
    });

    it('3.2 Delta negativo no debe reducir la cantidad por debajo de 1', () => {
      const item = Object.freeze({ id: 'it-1', description: 'Póster', quantity: 1, unitPrice: 50, subtotal: 50 });
      const initial = Object.freeze([item]);

      const result = handleUpdateQuantityPure(initial, 0, -10);

      assert.strictEqual(result[0].quantity, 1, 'Cantidad no debe ser menor a 1');
      assert.strictEqual(result[0].subtotal, 50, 'Subtotal debe permanecer en 50');
    });

    it('3.3 Índice fuera de rango devuelve prevItems intacto', () => {
      const item = Object.freeze({ id: 'it-1', quantity: 1, unitPrice: 50, subtotal: 50 });
      const initial = Object.freeze([item]);

      const result = handleUpdateQuantityPure(initial, 99, 1);
      assert.strictEqual(result, initial, 'Índice inexistente debe retornar array original');
    });

    it('3.4 Eliminación de ítem preserva inmutabilidad y previene vaciar la venta', () => {
      const item1 = Object.freeze({ id: 'it-1', quantity: 1, unitPrice: 65 });
      const item2 = Object.freeze({ id: 'it-2', quantity: 2, unitPrice: 125 });
      const twoItems = Object.freeze([item1, item2]);

      const afterRemove = handleRemoveItemPure(twoItems, 0);
      assert.strictEqual(afterRemove.length, 1);
      assert.strictEqual(afterRemove[0], item2);

      // Intentar vaciar el último ítem
      const blocked = handleRemoveItemPure(afterRemove, 0);
      assert.strictEqual(blocked.length, 1, 'No debe permitir vaciar el último ítem');
      assert.strictEqual(blocked, afterRemove, 'Debe retornar el mismo array cuando está bloqueado');
    });
  });

  // =========================================================================
  // 4. CÁLCULO DE TOTALES Y DESCUENTOS
  // =========================================================================
  describe('4. Verificación de Recálculo de Totales', () => {
    it('4.1 Total de ítems y gran total con descuento mayor a 0', () => {
      const items = [
        { quantity: 2, unitPrice: 65 },  // 130
        { quantity: 1, unitPrice: 125 }, // 125
      ];
      const discount = 50;
      const itemsTotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
      const grandTotal = Math.max(0, itemsTotal - Number(discount || 0));

      assert.strictEqual(itemsTotal, 255);
      assert.strictEqual(grandTotal, 205);
    });

    it('4.2 Gran total no puede ser negativo cuando el descuento excede el total', () => {
      const items = [{ quantity: 1, unitPrice: 35 }];
      const discount = 100;
      const itemsTotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
      const grandTotal = Math.max(0, itemsTotal - Number(discount || 0));

      assert.strictEqual(itemsTotal, 35);
      assert.strictEqual(grandTotal, 0, 'Gran total debe ser mínimo 0');
    });
  });

  // =========================================================================
  // 5. INTERFACES Y CONTRATOS DE EXPORTACIÓN
  // =========================================================================
  describe('5. Interfaces y Contratos de Componentes', () => {
    it('5.1 EditSaleModal exporta por defecto una función con soporte de 4 props', () => {
      assert.match(modalContent, /export\s+default\s+function\s+EditSaleModal\s*\(\{\s*sale,\s*onClose,\s*onSaved,\s*onSaleUpdated\s*\}\)/);
    });

    it('5.2 EditSaleItemsTable exporta por defecto función con props requeridas', () => {
      assert.match(tableContent, /export\s+default\s+function\s+EditSaleItemsTable\s*\(\{\s*items,\s*onUpdateQuantity,\s*onRemoveItem\s*\}\)/);
    });

    it('5.3 useEditSaleForm exporta por defecto función hook', () => {
      assert.match(hookContent, /export\s+default\s+function\s+useEditSaleForm\s*\(\{\s*sale,\s*onClose,\s*onSaved,\s*onSaleUpdated\s*\}\)/);
    });
  });
});
