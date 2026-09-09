// scripts/stress-concurrency-sales.js
// Adversarial Concurrency Stress Test: 15 simultaneous sales to test atomic sequence generation

async function runStressTest() {
  const eventId = '85fadb20-955b-448c-84ca-320d7f5885a0';
  const url = 'http://localhost:3001/api/sales';
  const CONCURRENCY_COUNT = 15;

  console.log(`🚀 Iniciando prueba de estrés adversarial: ${CONCURRENCY_COUNT} ventas concurrentes...`);
  const startTime = Date.now();

  const requests = Array.from({ length: CONCURRENCY_COUNT }, (_, i) => {
    const payload = {
      eventId,
      items: [
        {
          description: `Póster Concurrente Burst #${i + 1}`,
          quantity: 1,
          unitPrice: 30.0,
        },
      ],
      payments: [
        {
          method: 'EFECTIVO',
          amount: 30.0,
        },
      ],
      discount: 0,
      notes: `Burst test adversarial #${i + 1}`,
      inputChannel: 'MANUAL_POS',
    };

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        return {
          index: i + 1,
          status: res.status,
          success: data.success,
          saleNumber: data.data?.saleNumber,
          error: data.error || null,
        };
      })
      .catch((err) => ({
        index: i + 1,
        status: 500,
        success: false,
        saleNumber: null,
        error: err.message,
      }));
  });

  const results = await Promise.all(requests);
  const elapsedMs = Date.now() - startTime;

  console.log(`\n⏱️ Tiempo total de ráfaga: ${elapsedMs}ms`);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const saleNumbers = successful.map((r) => r.saleNumber);
  const uniqueSaleNumbers = new Set(saleNumbers);

  const p2002Errors = results.filter((r) =>
    r.error && (r.error.includes('P2002') || r.error.toLowerCase().includes('unique constraint') || r.error.toLowerCase().includes('duplicado'))
  );

  console.log('--- RESULTADOS DE CONCURRENCIA ---');
  console.log(`Total enviadas: ${CONCURRENCY_COUNT}`);
  console.log(`Exitosas: ${successful.length}`);
  console.log(`Fallidas: ${failed.length}`);
  console.log(`Números de venta únicos: ${uniqueSaleNumbers.size} de ${successful.length}`);
  console.log(`Colisiones P2002 detectadas: ${p2002Errors.length}`);
  console.log('\nLista de números de venta generados:');
  console.log(saleNumbers.sort());

  if (failed.length > 0) {
    console.error('\n❌ Errores encontrados:');
    failed.forEach((f) => console.error(`  Req #${f.index} [${f.status}]: ${f.error}`));
  }

  if (uniqueSaleNumbers.size === CONCURRENCY_COUNT && p2002Errors.length === 0) {
    console.log('\n✅ VEREDICTO DE PRUEBA: PASSED (Cero colisiones, secuencia atómica verificada)');
    process.exit(0);
  } else {
    console.error('\n❌ VEREDICTO DE PRUEBA: FAILED (Colisión o fallo en concurrencia)');
    process.exit(1);
  }
}

runStressTest();
