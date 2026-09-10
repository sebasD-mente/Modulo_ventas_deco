import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('🔬 M5: Saneamiento Forense de Código Muerto, Dependencias y Assets', async (t) => {
  await t.test('1. Purga de los 23 iconos huérfanos de lucide-react en los 7 archivos', async (t) => {
    await t.test('1.1 UnifiedAiChat.jsx no importa los 7 iconos huérfanos', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/UnifiedAiChat.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      const purgedIcons = ['Bot', 'User', 'Sparkles', 'CreditCard', 'Banknote', 'Smartphone', 'ChevronDown'];
      for (const icon of purgedIcons) {
        assert.ok(!importedIcons.includes(icon), `UnifiedAiChat no debe importar ${icon}`);
      }
      assert.strictEqual(importedIcons.length, 13, 'Debe conservar exactamente los 13 iconos utilizados');
    });

    await t.test('1.2 ProductionManagementView.jsx no importa los 6 iconos huérfanos', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/ProductionManagementView.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      const purgedIcons = ['Layers', 'Filter', 'AlertCircle', 'Sparkles', 'ChevronRight', 'Calendar'];
      for (const icon of purgedIcons) {
        assert.ok(!importedIcons.includes(icon), `ProductionManagementView no debe importar ${icon}`);
      }
      assert.strictEqual(importedIcons.length, 8, 'Debe conservar exactamente los 8 iconos utilizados');
    });

    await t.test('1.3 MonitorDashboardView.jsx no importa los 4 iconos huérfanos', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/MonitorDashboardView.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      const purgedIcons = ['CreditCard', 'Smartphone', 'Banknote', 'Receipt'];
      for (const icon of purgedIcons) {
        assert.ok(!importedIcons.includes(icon), `MonitorDashboardView no debe importar ${icon}`);
      }
      assert.strictEqual(importedIcons.length, 6, 'Debe conservar exactamente los 6 iconos utilizados');
    });

    await t.test('1.4 Header.jsx no importa los 2 iconos huérfanos', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Header.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      const purgedIcons = ['Shield', 'User'];
      for (const icon of purgedIcons) {
        assert.ok(!importedIcons.includes(icon), `Header no debe importar ${icon}`);
      }
      assert.strictEqual(importedIcons.length, 1, 'Debe conservar únicamente LogOut');
      assert.ok(importedIcons.includes('LogOut'));
    });

    await t.test('1.5 FastManualSaleForm.jsx no importa los 2 iconos huérfanos', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/FastManualSaleForm.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      const purgedIcons = ['Sparkles', 'Store'];
      for (const icon of purgedIcons) {
        assert.ok(!importedIcons.includes(icon), `FastManualSaleForm no debe importar ${icon}`);
      }
      assert.strictEqual(importedIcons.length, 12, 'Debe conservar exactamente los 12 iconos utilizados');
    });

    await t.test('1.6 RecentSalesList.jsx no importa el icono huérfano FileText', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/RecentSalesList.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      assert.ok(!importedIcons.includes('FileText'), 'RecentSalesList no debe importar FileText');
      assert.strictEqual(importedIcons.length, 8, 'Debe conservar exactamente los 8 iconos utilizados');
      assert.ok(importedIcons.includes('Receipt'), 'Receipt debe conservarse porque sí se usa');
    });

    await t.test('1.7 UserManagementView.jsx no importa el icono huérfano Shield', () => {
      const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/UserManagementView.jsx'), 'utf8');
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/);
      assert.ok(importMatch, 'Debe existir import de lucide-react');
      const importedIcons = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);

      assert.ok(!importedIcons.includes('Shield'), 'UserManagementView no debe importar Shield huérfano');
      assert.ok(importedIcons.includes('ShieldCheck'), 'UserManagementView debe conservar ShieldCheck');
      assert.strictEqual(importedIcons.length, 11, 'Debe conservar exactamente los 11 iconos utilizados');
    });
  });

  await t.test('2. Limpieza de dependencias y scripts en package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.dependencies['clsx'], undefined, 'clsx no debe estar en dependencies');
    assert.strictEqual(pkg.dependencies['tailwind-merge'], undefined, 'tailwind-merge no debe estar en dependencies');
    assert.strictEqual(pkg.scripts['dev:all'], undefined, 'dev:all no debe estar en scripts');
  });

  await t.test('3. Saneamiento de CSS en src/index.css', () => {
    const css = fs.readFileSync(path.join(ROOT_DIR, 'src/index.css'), 'utf8');
    assert.ok(!css.includes('.glass-panel'), 'No debe existir .glass-panel');
    assert.ok(!css.includes('.glass-card'), 'No debe existir .glass-card');
    assert.ok(!css.includes('pulseGreen'), 'No debe existir pulseGreen');
    assert.ok(!css.includes('.live-indicator'), 'No debe existir .live-indicator');
    assert.ok(css.includes('.no-scrollbar'), 'Debe preservarse .no-scrollbar');
  });

  await t.test('4. Saneamiento de assets en public/brand/ y favicon en index.html', () => {
    const brandFiles = fs.readdirSync(path.join(ROOT_DIR, 'public/brand'));
    assert.ok(!brandFiles.includes('icono cabecera del chat.png'));
    assert.ok(!brandFiles.includes('icono de chat.png'));
    assert.ok(!brandFiles.includes('logo encabezado.png'));
    assert.ok(!brandFiles.includes('logo blanco.png'));

    assert.deepStrictEqual(brandFiles.sort(), [
      'icon-chat-avatar.png',
      'icon-chat-header.png',
      'logo-header.png',
    ].sort());

    const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    assert.ok(!html.includes('/vite.svg'), 'index.html no debe referenciar /vite.svg');
    assert.ok(html.includes('/brand/icon-chat-avatar.png'), 'index.html debe tener favicon /brand/icon-chat-avatar.png');
  });

  await t.test('5. Eliminación de scripts que violan aislamiento en scripts/', () => {
    const scriptsDir = path.join(ROOT_DIR, 'scripts');
    assert.ok(!fs.existsSync(path.join(scriptsDir, 'inspect-posters-columns.js')));
    assert.ok(!fs.existsSync(path.join(scriptsDir, 'inspect-sizes.js')));
    assert.ok(!fs.existsSync(path.join(scriptsDir, 'test-posters-db.js')));
    assert.ok(fs.existsSync(path.join(scriptsDir, 'stress-concurrency-sales.js')));
  });
});
