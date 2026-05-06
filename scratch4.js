const express = require('express');
const { generateValePDF } = require('./src/services/pdf.service');

const app = express();
app.get('/pdf', async (req, res) => {
  try {
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
    res.end(pdfBuffer);
  } catch(e) {
    console.error(e);
    res.status(500).send('error');
  }
});

const server = app.listen(3002, async () => {
  try {
    const resp = await fetch('http://localhost:3002/pdf');
    const buffer = await resp.arrayBuffer();
    const nodeBuffer = Buffer.from(buffer);
    console.log('HTTP SIZE:', nodeBuffer.length);
    console.log('HTTP HEADER:', nodeBuffer.toString('utf8', 0, 5));
  } catch (err) {
    console.log(err);
  }
  server.close();
});
