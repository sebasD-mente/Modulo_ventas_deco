import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('🏛️ Counter Seller Zero-Trust Isolation & Monitor Shielding', () => {
  it('1. FastManualSaleForm.jsx condiciona el alternador de modo estrictamente a canToggleSaleMode', () => {
    const filePath = path.resolve('src/components/FastManualSaleForm.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('const isVendedorMostradorOnly = Boolean(isVendedor && !isVendedorRedes && !isSuperAdmin);'),
      'Debe definir isVendedorMostradorOnly'
    );
    assert.ok(
      content.includes('const canToggleSaleMode = Boolean(isSuperAdmin || (isVendedor && isVendedorRedes));'),
      'canToggleSaleMode solo debe ser true para SuperAdmin o vendedores híbridos'
    );
    assert.ok(
      content.includes('{canToggleSaleMode && ('),
      'El toggle segmentado debe estar condicionado por canToggleSaleMode'
    );
    assert.ok(
      !content.includes('{!isVendedorRedesOnly && ('),
      'No debe existir la condición permisiva previa {!isVendedorRedesOnly && ('
    );
  });

  it('2. saleController.js getMonitorMetrics ancla al vendedor de mostrador a su evento ferial', () => {
    const filePath = path.resolve('server/controllers/saleController.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes("else if (isVendedor && !isSuperAdmin && !isVendedorRedes)"),
      'Debe evaluar el caso exclusivo de vendedor de mostrador'
    );
    assert.ok(
      content.includes("user?.assignedEventId"),
      'Debe verificar user.assignedEventId'
    );
    assert.ok(
      content.includes("assignedSellerEmail: user.email"),
      'Debe verificar asignación por correo activo'
    );
    assert.ok(
      content.includes("NOT: { id: 'evt-ventas-redes-online' }"),
      'Debe excluir terminantemente el canal digital de redes'
    );
    assert.ok(
      content.includes("targetEventId = sellerEvent?.id || 'none';"),
      'Si no hay evento asignado debe devolver targetEventId = none'
    );
  });

  it('3. MonitorDashboardView.jsx condiciona el resumen general para evitar duplicidad visual', () => {
    const filePath = path.resolve('src/components/MonitorDashboardView.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('const { isSuperAdmin } = useAuth();'),
      'Debe extraer isSuperAdmin de useAuth()'
    );
    assert.ok(
      content.includes('{(isSuperAdmin || eventDetails.length > 1) && ('),
      'El resumen general solo debe renderizarse para SuperAdmin o si hay más de 1 evento'
    );
  });
});
