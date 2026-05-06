const express = require('express');
const { generateValePDF } = require('./src/services/pdf.service');

const app = express();
app.get('/pdf', async (req, res) => {
  const order = {
    id_orden: 7,
    fecha: new Date().toISOString(),
    tipo: 'salida',
    solicitante: 'Test',
    operador: 'Op',
    estado: 'pendiente',
    detalles: [
      { cantidad: 2, descripcion: 'Ref', no_parte: '123' }
    ]
  };
  const pdfBuffer = await generateValePDF(order);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': pdfBuffer.length
  });
  res.send(pdfBuffer);
});

const server = app.listen(3001, async () => {
  const fetch = require('node-fetch'); // or dynamic import
  try {
    const resp = await import('node-fetch').then(m => m.default('http://localhost:3001/pdf'));
    const buffer = await resp.buffer();
    console.log('HTTP SIZE:', buffer.length);
    console.log('HTTP HEADER:', buffer.toString('utf8', 0, 5));
  } catch (err) {
    console.log(err);
  }
  server.close();
});
