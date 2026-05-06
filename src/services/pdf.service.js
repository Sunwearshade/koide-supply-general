const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs/promises');

async function generateValePDF(order) {
  // Lógica para estructurar el material
  const materialList = order.detalles.map(d => `${d.cantidad} x ${d.descripcion} (NP: ${d.no_parte || 'N/A'})`).join(', ');
  const quantitySum = order.detalles.reduce((acc, d) => acc + Number(d.cantidad), 0);
  console

  const templatePath = path.join(__dirname, '../templates/vale.html');
  let html = await fs.readFile(templatePath, 'utf8');

  // Mapear datos
  const date = new Date(order.fecha).toLocaleDateString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  const data = {
    fechaSolicitud: date,
    turno: order.turno || '',
    material: materialList,
    maquina: order.maquina || '',
    numeroParte: order.detalles[0]?.no_parte || 'Varios',
    cantidad: quantitySum,
    motivo: order.motivo || 'N/A',
    operador: order.solicitante || order.operador || '',
    numeroEmpleadoOperador: order.numero_empleado || '',
    solicitante: order.solicitante || '',
    puesto: '',
    quienEntrega: order.operador || '',
    numeroEmpleadoEntrega: ''
  };

  // Reemplazar en HTML
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Generar PDF
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });

  await browser.close();

  return pdfBuffer;
}

module.exports = {
  generateValePDF
};
