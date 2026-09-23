import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('🏛️ Operator 1 (Stock) and Operator 2 (Impresión) Strict Decoupling', () => {
  it('1. ProductionOrderCard.jsx elimina el select y renderiza botones táctiles contextuales', () => {
    const filePath = path.resolve('src/components/production/ProductionOrderCard.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      !content.includes('<select'),
      'ProductionOrderCard.jsx no debe contener el elemento <select>'
    );
    assert.ok(
      content.includes('(isOp2Only || isSuperAdmin)'),
      'Debe condicionar botón de IMPRESO a isOp2Only o isSuperAdmin'
    );
    assert.ok(
      content.includes('Marcar como IMPRESO'),
      'Debe contener botón Marcar como IMPRESO'
    );
    assert.ok(
      content.includes('(!isOp2Only || isSuperAdmin)'),
      'Debe condicionar acciones de Operario 1 a !isOp2Only o isSuperAdmin'
    );
    assert.ok(
      content.includes('Separar Stock'),
      'Debe contener botón Separar Stock'
    );
    assert.ok(
      content.includes('A Imprimir'),
      'Debe contener botón A Imprimir'
    );
  });

  it('2. useProductionQueue.js inicializa defaults y badges contextuales', () => {
    const filePath = path.resolve('src/components/production/hooks/useProductionQueue.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('const isOp1Only = Boolean(isOperario1 && !isOperario2 && !isSuperAdmin);'),
      'Debe definir isOp1Only'
    );
    assert.ok(
      content.includes('const isOp2Only = Boolean(isOperario2 && !isOperario1 && !isSuperAdmin);'),
      'Debe definir isOp2Only'
    );
    assert.ok(
      content.includes("const [statusFilter, setStatusFilter] = useState(() => (isOp2Only ? 'A_PRODUCCION' : 'ALL'));"),
      'statusFilter debe iniciar en A_PRODUCCION para Operario 2'
    );
    assert.ok(
      content.includes("'TALLER DE IMPRESIÓN'"),
      'sectionBadge debe asignar TALLER DE IMPRESIÓN para Operario 2'
    );
    assert.ok(
      content.includes("'STOCK & ALISTAMIENTO'"),
      'sectionBadge debe asignar STOCK & ALISTAMIENTO para Operario 1'
    );
  });

  it('3. productionService.js filtra A_PRODUCCION para Operario 2 y valida transiciones estrictas', () => {
    const filePath = path.resolve('server/services/productionService.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Comprobar que en getProductionItems la condición de Operario 2 sea la primera
    const getItemsSection = content.slice(content.indexOf('export async function getProductionItems'), content.indexOf('export async function updateItemProductionStatus'));
    assert.ok(
      getItemsSection.includes("if (isOperario2 && !isOperario1 && !isSuperAdmin) {\n    // Operario 2 solo ve en su cola lo que requiere impresión\n    statusFilter = { productionStatus: 'A_PRODUCCION' };"),
      'Operario 2 debe tener prioridad forzada en statusFilter de getProductionItems'
    );

    // Comprobar validaciones de transición
    assert.ok(
      content.includes("if (item.productionStatus !== 'A_PRODUCCION' && !isSuperAdmin)"),
      'IMPRESO exige que el item esté en A_PRODUCCION salvo SuperAdmin'
    );
    assert.ok(
      content.includes("if (!isOperario1) {\n      const error = new Error('No tienes permiso de Operario 1 para mover obras a A PRODUCCION.');"),
      'A_PRODUCCION exige permisos de Operario 1'
    );
    assert.ok(
      content.includes("if (!isOperario2) {\n      const error = new Error('No tienes permiso de taller para marcar obras como IMPRESO.');"),
      'IMPRESO exige permisos de Operario 2'
    );
  });
});
