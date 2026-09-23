import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('🏛️ Header Role Badge Visibility & Visual Identity', () => {
  it('1. Header.jsx implementa getRoleBadgeConfig con etiquetas y paletas distintivas', () => {
    const filePath = path.resolve('src/components/Header.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('const getRoleBadgeConfig = () => {'),
      'Debe definir la función getRoleBadgeConfig'
    );
    assert.ok(
      content.includes("'👑 Super Admin'"),
      'Debe incluir etiqueta para Super Admin'
    );
    assert.ok(
      content.includes("'📱 Ventas Redes'"),
      'Debe incluir etiqueta para Ventas Redes'
    );
    assert.ok(
      content.includes("'💼 Mostrador'"),
      'Debe incluir etiqueta para Mostrador'
    );
    assert.ok(
      content.includes("'👷 Producción Total'"),
      'Debe incluir etiqueta para Producción Total'
    );
    assert.ok(
      content.includes("'📦 Stock Taller'"),
      'Debe incluir etiqueta para Stock Taller'
    );
    assert.ok(
      content.includes("'🖨️ Impresión'"),
      'Debe incluir etiqueta para Impresión'
    );
  });

  it('2. Header.jsx renderiza columna con nombre de usuario y badge de rol', () => {
    const filePath = path.resolve('src/components/Header.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('flex flex-col items-start leading-none'),
      'Debe apilar el nombre y el badge en una columna'
    );
    assert.ok(
      content.includes('{roleBadge.label}'),
      'Debe renderizar roleBadge.label'
    );
    assert.ok(
      content.includes('${roleBadge.className}'),
      'Debe aplicar las clases de color roleBadge.className'
    );
  });

  it('3. Header.jsx conserva área táctil del botón logout >= 44x44px', () => {
    const filePath = path.resolve('src/components/Header.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('min-h-[44px] min-w-[44px]'),
      'El botón de logout debe cumplir con dimensiones mínimas de 44x44px'
    );
  });
});
