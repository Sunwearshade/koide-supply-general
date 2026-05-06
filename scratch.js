const { generateValePDF } = require('./src/services/pdf.service');

const order = {
  id_orden: 6,
  fecha: new Date().toISOString(),
  tipo: 'salida',
  solicitante: 'Test',
  operador: 'Op',
  estado: 'pendiente',
  detalles: [
    { cantidad: 2, descripcion: 'Ref', no_parte: '123' }
  ]
};

generateValePDF(order)
  .then(() => console.log('PDF OK'))
  .catch(err => console.error('PDF ERROR:', err));
