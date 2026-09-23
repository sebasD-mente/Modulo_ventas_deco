import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('🏛️ Production Seller Isolation & Reposiciones Concealment', () => {
  it('1. ProductionManagementView.jsx oculta el selector de reposiciones para isVendedorRedesOnly', () => {
    const filePath = path.resolve('src/components/ProductionManagementView.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);'),
      'Debe evaluar isVendedorRedesOnly'
    );
    assert.ok(
      content.includes('{!isVendedorRedesOnly && ('),
      'El selector de reposiciones debe estar condicionado por !isVendedorRedesOnly'
    );
  });

  it('2. productionService.js fuerza origen PEDIDOS para isVendedorRedesOnly en items y metrics', () => {
    const filePath = path.resolve('server/services/productionService.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Comprobar que en ambas apariciones se verifique (isVendedorRedesOnly || source === 'PEDIDOS')
    const matches = content.match(/if\s*\(\s*isVendedorRedesOnly\s*\|\|\s*source\s*===\s*'PEDIDOS'\s*\)/g);
    assert.ok(matches && matches.length >= 2, 'Debe forzar PEDIDOS en getProductionItems y getProductionMetrics');

    assert.ok(
      content.includes("orderType: 'REDES_PERSONALIZADO'"),
      'Debe anclar a ordenes de tipo REDES_PERSONALIZADO'
    );
    assert.ok(
      content.includes("NOT: { paymentStatus: 'PENDIENTE_PAGO' }"),
      'Debe excluir órdenes con anticipo pendiente'
    );
  });
});
