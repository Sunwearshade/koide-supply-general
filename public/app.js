const state = {
  inventory: [],
  pendingInventory: [],
  inventoryPage: 1,
  inventoryPagination: null,
  // Modo dual de ordenes: recientes (72h) + historico paginado
  ordersRecent: [],          // ultimas 72 horas
  ordersHistory: [],         // historico (pagina actual)
  ordersHistoryPage: 1,
  ordersHistoryPagination: null,
  // Modo plano (filtro de fecha activo)
  orders: [],
  movements: [],
  messages: [],
  messagesPage: 1,
  messagesPagination: null,
  users: [],
  report: null,
  missingPage: 1,
  onlyCriticalMissing: false,
  selectedMissing: new Set(),
  stats: null,
  user: null,
  adjustmentMode: { activo: false, updated_at: null, updated_by: null },
  adjustmentItems: [],
  adjustmentNewItems: [],
  adjustmentLogs: [],
  adjustmentLogsPage: 1,
  adjustmentLogsPagination: null
};

const els = {
  loginScreen: document.querySelector('#loginScreen'),
  dashboard: document.querySelector('#dashboard'),
  alert: document.querySelector('#alert'),
  loginAlert: document.querySelector('#loginAlert'),
  loginForm: document.querySelector('#loginForm'),
  firstAdminForm: document.querySelector('#firstAdminForm'),
  sessionBox: document.querySelector('#sessionBox'),
  sessionName: document.querySelector('#sessionName'),
  logoutButton: document.querySelector('#logoutButton'),
  userForm: document.querySelector('#userForm'),
  userRows: document.querySelector('#userRows'),
  inventoryForm: document.querySelector('#inventoryForm'),
  inventorySearch: document.querySelector('#inventorySearch'),
  inventoryPrev: document.querySelector('#inventoryPrev'),
  inventoryNext: document.querySelector('#inventoryNext'),
  inventoryPageInfo: document.querySelector('#inventoryPageInfo'),
  showInventoryForm: document.querySelector('#showInventoryForm'),
  orderForm: document.querySelector('#orderForm'),
  detailRows: document.querySelector('#detailRows'),
  detailTemplate: document.querySelector('#detailTemplate'),
  machineField: document.querySelector('#machineField'),
  inventoryRows: document.querySelector('#inventoryRows'),
  pendingInventoryRows: document.querySelector('#pendingInventoryRows'),
  refreshPendingInventory: document.querySelector('#refreshPendingInventory'),
  orderRows: document.querySelector('#orderRows'),
  ordersRecentCount: document.querySelector('#ordersRecentCount'),
  orderHistoryRows: document.querySelector('#orderHistoryRows'),
  orderHistoryPrev: document.querySelector('#orderHistoryPrev'),
  orderHistoryNext: document.querySelector('#orderHistoryNext'),
  orderHistoryPageInfo: document.querySelector('#orderHistoryPageInfo'),
  orderDateFilter: document.querySelector('#orderDateFilter'),
  movementRows: document.querySelector('#movementRows'),
  messageRows: document.querySelector('#messageRows'),
  messageSearch: document.querySelector('#messageSearch'),
  messageDateFrom: document.querySelector('#messageDateFrom'),
  messageDateTo: document.querySelector('#messageDateTo'),
  messagePrev: document.querySelector('#messagePrev'),
  messageNext: document.querySelector('#messageNext'),
  messagePageInfo: document.querySelector('#messagePageInfo'),
  reportPeriod: document.querySelector('#reportPeriod'),
  toggleCriticalMissing: document.querySelector('#toggleCriticalMissing'),
  statsPeriod: document.querySelector('#statsPeriod'),
  missingRows: document.querySelector('#missingRows'),
  missingPrev: document.querySelector('#missingPrev'),
  missingNext: document.querySelector('#missingNext'),
  missingPageInfo: document.querySelector('#missingPageInfo'),
  exportMissing: document.querySelector('#exportMissing'),
  exportAllMissing: document.querySelector('#exportAllMissing'),
  flowRows: document.querySelector('#flowRows'),
  statsCards: document.querySelector('#statsCards'),
  topOutputRows: document.querySelector('#topOutputRows'),
  topInputRows: document.querySelector('#topInputRows'),
  adjustmentBanner: document.querySelector('#adjustmentBanner'),
  adjustmentBannerText: document.querySelector('#adjustmentBannerText'),
  toggleAdjustmentMode: document.querySelector('#toggleAdjustmentMode'),
  refreshAdjustmentMode: document.querySelector('#refreshAdjustmentMode'),
  adjustmentEditSection: document.querySelector('#adjustmentEditSection'),
  adjustmentInstructionText: document.querySelector('#adjustmentInstructionText'),
  adjustmentSearch: document.querySelector('#adjustmentSearch'),
  adjustmentRows: document.querySelector('#adjustmentRows'),
  saveAdjustmentDraft: document.querySelector('#saveAdjustmentDraft'),
  sendAdjustmentReview: document.querySelector('#sendAdjustmentReview'),
  approveAdjustment: document.querySelector('#approveAdjustment'),
  rejectAdjustment: document.querySelector('#rejectAdjustment'),
  adjustmentLogRows: document.querySelector('#adjustmentLogRows'),
  refreshAdjustmentLogs: document.querySelector('#refreshAdjustmentLogs'),
  adjustmentLogPrev: document.querySelector('#adjustmentLogPrev'),
  adjustmentLogNext: document.querySelector('#adjustmentLogNext'),
  adjustmentLogPageInfo: document.querySelector('#adjustmentLogPageInfo'),
  // Modal de cambio obligatorio de contraseña
  changePasswordOverlay: document.querySelector('#changePasswordOverlay'),
  changePasswordForm: document.querySelector('#changePasswordForm'),
  cpAlert: document.querySelector('#cpAlert')
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar la operacion');
  }

  return data;
}

function showAlert(message, type = 'success') {
  const target = state.user ? els.alert : els.loginAlert;
  target.textContent = message;
  target.className = `alert ${type}`;
  target.hidden = false;

  window.clearTimeout(showAlert.timer);
  showAlert.timer = window.setTimeout(() => {
    target.hidden = true;
  }, 4200);
}

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function escapeHtml(value) {
  return String(valueOrDash(value))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function badge(value) {
  return `<span class="badge ${value}">${value}</span>`;
}

function imagePathCell(item) {
  if (!item.imagen_item) return '<span class="empty">Sin imagen</span>';
  const path = escapeHtml(item.imagen_item);
  const extension = String(item.imagen_item).split('.').pop() || 'jpg';
  const label = `${item.descripcion || 'imagen'}.${extension}`;
  return `<a class="image-path" href="${path}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function imageUploadCell(item) {
  if (item.imagen_item) {
    return `
      <div class="image-upload">
        ${imagePathCell(item)}
        <input class="image-replace-input" type="file" accept="image/*" data-image-file="${item.id_refaccion}" data-auto-upload="1" aria-label="Reemplazar imagen de ${escapeHtml(item.descripcion)}">
        <div class="image-actions">
          <button type="button" class="secondary" data-edit-image="${item.id_refaccion}">Editar</button>
          <button type="button" class="danger" data-delete-image="${item.id_refaccion}">Eliminar</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="image-upload">
      <span class="empty">Sin imagen</span>
      <input type="file" accept="image/*" data-image-file="${item.id_refaccion}" aria-label="Imagen de ${escapeHtml(item.descripcion)}">
      <button type="button" class="secondary" data-upload-image="${item.id_refaccion}">Subir / cargar</button>
    </div>
  `;
}

function adjustmentNewImageCell() {
  return '<span class="empty">Guarda progreso para cargar imagen</span>';
}

function adjustmentNewImageUploadCell(item, idx) {
  if (item.imagen_item) {
    return `
      <div class="image-upload">
        ${imagePathCell(item)}
        <input class="image-replace-input" type="file" accept="image/*" data-new-image-file="${item.id_nuevo}" data-new-auto-upload="1" aria-label="Reemplazar imagen de ${escapeHtml(item.descripcion)}">
        <div class="image-actions">
          <button type="button" class="secondary" data-edit-new-image="${item.id_nuevo}">Editar</button>
          <button type="button" class="danger" data-delete-new-image="${item.id_nuevo}">Eliminar</button>
        </div>
      </div>
    `;
  }

  if (!item.id_nuevo) {
    return `
      <div class="image-upload">
        <span class="empty">Sin imagen</span>
        <input type="file" accept="image/*" data-new-draft-image-file="${idx}" aria-label="Imagen de ${escapeHtml(item.descripcion || `alta nueva ${idx + 1}`)}">
        <button type="button" class="secondary" data-upload-new-draft-image="${idx}">Subir / cargar</button>
      </div>
    `;
  }

  return `
    <div class="image-upload">
      <span class="empty">Sin imagen</span>
      <input type="file" accept="image/*" data-new-image-file="${item.id_nuevo}" aria-label="Imagen de ${escapeHtml(item.descripcion || `alta nueva ${idx + 1}`)}">
      <button type="button" class="secondary" data-upload-new-image="${item.id_nuevo}">Subir / cargar</button>
    </div>
  `;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('No se pudo leer la imagen')));
    reader.readAsDataURL(file);
  });
}

async function uploadInventoryImage(idRefaccion, file, description = '') {
  const dataUrl = await fileToDataUrl(file);
  return api(`/api/inventario/${idRefaccion}/imagen`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      description,
      mimeType: file.type,
      dataUrl
    })
  });
}

async function deleteInventoryImage(idRefaccion) {
  return api(`/api/inventario/${idRefaccion}/imagen`, { method: 'DELETE' });
}

async function uploadAdjustmentNewImage(idNuevo, file, description = '') {
  const dataUrl = await fileToDataUrl(file);
  return api(`/api/inventario/ajuste/nuevos/${idNuevo}/imagen`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      description,
      mimeType: file.type,
      dataUrl
    })
  });
}

async function deleteAdjustmentNewImage(idNuevo) {
  return api(`/api/inventario/ajuste/nuevos/${idNuevo}/imagen`, { method: 'DELETE' });
}

function getAdjustmentImageDescription(idRefaccion, sourceElement) {
  const row = sourceElement.closest('tr');
  return row?.querySelector('input[name="descripcion"]')?.value?.trim()
    || state.adjustmentItems.find((item) => Number(item.id_refaccion) === Number(idRefaccion))?.descripcion
    || '';
}

async function handleAdjustmentImageUpload(idRefaccion, file, sourceElement) {
  if (!file) {
    showAlert('Selecciona una imagen para cargar', 'error');
    return;
  }

  const description = getAdjustmentImageDescription(idRefaccion, sourceElement);
  await uploadInventoryImage(idRefaccion, file, description);
  await Promise.all([loadInventory(), loadAdjustmentItems(), loadPendingInventory(), loadMessages()]);
  showAlert('Imagen cargada');
}

function getAdjustmentNewImageDescription(idNuevo, sourceElement) {
  const row = sourceElement.closest('tr');
  return row?.querySelector('input[name="descripcion"]')?.value?.trim()
    || state.adjustmentNewItems.find((item) => Number(item.id_nuevo) === Number(idNuevo))?.descripcion
    || '';
}

async function handleAdjustmentNewImageUpload(idNuevo, file, sourceElement) {
  if (!file) {
    showAlert('Selecciona una imagen para cargar', 'error');
    return;
  }

  const description = getAdjustmentNewImageDescription(idNuevo, sourceElement);
  await uploadAdjustmentNewImage(idNuevo, file, description);
  await Promise.all([loadAdjustmentItems(), loadMessages()]);
  showAlert('Imagen cargada');
}

async function persistAdjustmentNewRowForImage(rowIndex) {
  const rows = [...els.adjustmentRows.querySelectorAll('tr[data-new-idx]')];
  const row = rows[rowIndex];
  const description = row?.querySelector('input[name="descripcion"]')?.value?.trim();

  if (!description) {
    const error = new Error('Captura la descripcion antes de cargar imagen');
    error.status = 400;
    throw error;
  }

  const newItems = collectAdjustmentNewItems();
  await api('/api/inventario/ajuste/nuevos', {
    method: 'POST',
    body: JSON.stringify({ items: newItems })
  });
  await loadAdjustmentItems();

  const saved = state.adjustmentNewItems[rowIndex];
  if (!saved?.id_nuevo) {
    throw new Error('No se pudo preparar la alta nueva para cargar imagen');
  }

  return saved.id_nuevo;
}

function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function roleLabel(role) {
  const labels = {
    admin: 'Administrador general',
    encargado: 'Administrador almacen',
    operador: 'Operador almacen'
  };

  return labels[role] || role;
}

function hasRole(roles) {
  return Boolean(state.user && roles.includes(state.user.role));
}

function canViewMovements() {
  return hasRole(['admin', 'encargado']);
}

function canViewStats() {
  return hasRole(['admin', 'encargado']);
}

function canReviewOperations() {
  return hasRole(['admin', 'encargado']);
}

function applyPermissions() {
  document.querySelectorAll('[data-roles]').forEach((element) => {
    const roles = element.dataset.roles.split(',');
    element.hidden = !hasRole(roles);
  });

  document.querySelectorAll('[data-admin-only]').forEach((option) => {
    option.hidden = !hasRole(['admin']);
    option.disabled = !hasRole(['admin']);
  });

  const visibleActiveTab = document.querySelector('.tab.active:not([hidden])');
  if (!visibleActiveTab) {
    const firstTab = document.querySelector('.tab:not([hidden])');
    if (firstTab) firstTab.click();
  }
}

function renderSession() {
  if (state.user) {
    els.loginScreen.hidden = true;
    els.dashboard.hidden = false;
    els.sessionName.textContent = `${state.user.nombre} · ${roleLabel(state.user.role)}`;
    applyPermissions();

    // Si el usuario debe cambiar su contrasena, mostrar el modal bloqueante
    if (state.user.debe_cambiar_password) {
      els.changePasswordOverlay.hidden = false;
    } else {
      els.changePasswordOverlay.hidden = true;
    }
    return;
  }

  els.loginScreen.hidden = false;
  els.dashboard.hidden = true;
  els.changePasswordOverlay.hidden = true;
  els.sessionName.textContent = '';
}

function renderInventory() {
  if (state.inventory.length === 0) {
    els.inventoryRows.innerHTML = '<tr><td class="empty" colspan="9">Sin refacciones registradas.</td></tr>';
    els.inventoryPageInfo.textContent = 'Pagina 1 de 1';
    return;
  }

  els.inventoryRows.innerHTML = state.inventory
    .map(
      (item) => `
        <tr>
          <td>${item.id_refaccion}</td>
          <td>${escapeHtml(item.descripcion)}</td>
          <td>${escapeHtml(item.no_parte)}</td>
          <td>${escapeHtml(item.ubicacion)}</td>
          <td><strong>${item.existencias}</strong></td>
          <td>${item.minimos}</td>
          <td>${item.maximos}</td>
          <td>${imagePathCell(item)}</td>
          <td><button type="button" class="secondary" data-generate-order="${item.id_refaccion}">Generar orden</button></td>
        </tr>
      `
    )
    .join('');

  const pagination = state.inventoryPagination || { page: 1, totalPages: 1 };
  els.inventoryPageInfo.textContent = `Pagina ${pagination.page} de ${pagination.totalPages}`;
  els.inventoryPrev.disabled = pagination.page <= 1;
  els.inventoryNext.disabled = pagination.page >= pagination.totalPages;
}

function optionLabel(item) {
  const part = item.no_parte ? ` - ${item.no_parte}` : '';
  const location = item.ubicacion ? ` - ${item.ubicacion}` : '';
  return `${item.descripcion}${part}${location} (${item.existencias})`;
}

function renderPendingInventory() {
  if (!els.pendingInventoryRows) return;

  if (!canReviewOperations()) {
    els.pendingInventoryRows.innerHTML = '';
    return;
  }

  if (state.pendingInventory.length === 0) {
    els.pendingInventoryRows.innerHTML = '<tr><td class="empty" colspan="8">Sin altas pendientes.</td></tr>';
    return;
  }

  const isAdmin = hasRole(['admin']);

  els.pendingInventoryRows.innerHTML = state.pendingInventory
    .map(
      (item) => `
        <tr>
          <td>${item.id_refaccion}</td>
          <td>${escapeHtml(item.descripcion)}</td>
          <td>${escapeHtml(item.no_parte)}</td>
          <td>${escapeHtml(item.ubicacion)}</td>
          <td>${imagePathCell(item)}</td>
          <td>${escapeHtml(item.solicitante_alta)}</td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            ${isAdmin ? `
            <div class="actions">
              <button type="button" data-approve-inventory="${item.id_refaccion}">Aprobar</button>
              <button class="secondary" type="button" data-reject-inventory="${item.id_refaccion}">Rechazar</button>
            </div>` : '<span>Pendiente de aprobacion</span>'}
          </td>
        </tr>
      `
    )
    .join('');
}

function setDetailOptions(row, items, selectedValue = '') {
  row.inventoryOptions = items;
  const select = row.querySelector('[name="id_refaccion"]');
  select.innerHTML =
    '<option value="">Selecciona una refaccion</option>' +
    items
      .map((item) => `<option value="${item.id_refaccion}">${escapeHtml(optionLabel(item))}</option>`)
      .join('');
  select.disabled = items.length === 0;
  if (selectedValue) select.value = selectedValue;

  updateQuantityLimits();
}

async function searchDetailOptions(row, query) {
  const search = query.trim();
  if (search.length < 2) {
    setDetailOptions(row, []);
    return;
  }

  const items = await api(`/api/inventario?all=1&q=${encodeURIComponent(search)}`);
  setDetailOptions(row, items || []);
}

function updateQuantityLimits() {
  const type = els.orderForm.elements.tipo.value;
  document.querySelectorAll('#detailRows .detail-row').forEach((row) => {
    const select = row.querySelector('[name="id_refaccion"]');
    const quantity = row.querySelector('[name="cantidad"]');
    const item = (row.inventoryOptions || []).find((option) => Number(option.id_refaccion) === Number(select.value));

    if (type === 'salida' && item) {
      quantity.max = item.existencias;
      if (Number(quantity.value) > Number(item.existencias)) {
        quantity.value = item.existencias;
      }
    } else {
      quantity.removeAttribute('max');
    }
  });
}

function syncOrderTypeFields() {
  const type = els.orderForm.elements.tipo.value;
  const machineInput = els.orderForm.elements.maquina;
  const isOutput = type === 'salida';

  els.machineField.hidden = !isOutput;
  machineInput.required = isOutput;
  if (!isOutput) machineInput.value = '';

  updateQuantityLimits();
}

// Renderiza el bloque de ordenes recientes (ultimas 72 h)
function renderRecentOrders() {
  const orders = state.ordersRecent;
  if (els.ordersRecentCount) {
    els.ordersRecentCount.textContent = orders.length > 0 ? `${orders.length} orden${orders.length !== 1 ? 'es' : ''}` : '';
  }

  if (orders.length === 0) {
    els.orderRows.innerHTML = '<tr><td class="empty" colspan="10">Sin ordenes en las ultimas 72 horas.</td></tr>';
    return;
  }

  els.orderRows.innerHTML = orders.map((order) => renderOrderRow(order)).join('');
}

// Renderiza el bloque de historial paginado
function renderHistoryOrders() {
  if (!els.orderHistoryRows) return;

  const orders = state.ordersHistory;
  if (orders.length === 0) {
    els.orderHistoryRows.innerHTML = '<tr><td class="empty" colspan="10">Sin ordenes en el historico.</td></tr>';
  } else {
    els.orderHistoryRows.innerHTML = orders.map((order) => renderOrderRow(order)).join('');
  }

  const pagination = state.ordersHistoryPagination || { page: 1, totalPages: 1 };
  if (els.orderHistoryPageInfo) {
    els.orderHistoryPageInfo.textContent = `Pagina ${pagination.page} de ${pagination.totalPages}`;
  }
  if (els.orderHistoryPrev) els.orderHistoryPrev.disabled = pagination.page <= 1;
  if (els.orderHistoryNext) els.orderHistoryNext.disabled = pagination.page >= pagination.totalPages;
}

// Renderiza una fila de orden (compartido entre ambas secciones)
function renderOrderRow(order) {
  const actions =
    order.estado === 'pendiente' && canReviewOperations()
      ? `
        <div class="actions">
          <button type="button" data-confirm="${order.id_orden}">Confirmar</button>
          <button class="secondary" type="button" data-cancel="${order.id_orden}">Cancelar</button>
        </div>
      `
      : order.estado === 'completado' && Number(order.puede_revertir) === 1 && canReviewOperations()
        ? `<button class="secondary" type="button" data-revert-order="${order.id_orden}">Revertir</button>`
        : '-';

  return `
    <tr>
      <td>${order.id_orden}</td>
      <td>${badge(order.tipo)}</td>
      <td>${escapeHtml(order.solicitante)}</td>
      <td>${escapeHtml(order.turno)}</td>
      <td>${escapeHtml(order.maquina)}</td>
      <td>${escapeHtml(order.numero_empleado)}</td>
      <td>${escapeHtml(order.operador || order.id_operador)}</td>
      <td>${badge(order.estado)}</td>
      <td>${formatDate(order.fecha)}</td>
      <td>${actions}</td>
    </tr>
  `;
}

// renderOrders: modo plano (cuando hay filtro de fecha activo)
function renderOrders() {
  if (state.orders.length === 0) {
    els.orderRows.innerHTML = '<tr><td class="empty" colspan="10">Sin ordenes para la fecha seleccionada.</td></tr>';
    if (els.orderHistoryRows) els.orderHistoryRows.innerHTML = '';
    if (els.ordersRecentCount) els.ordersRecentCount.textContent = '';
    return;
  }

  els.orderRows.innerHTML = state.orders.map((order) => renderOrderRow(order)).join('');
  if (els.orderHistoryRows) els.orderHistoryRows.innerHTML = '';
  if (els.ordersRecentCount) els.ordersRecentCount.textContent = '';
}

function renderMovements() {
  if (state.movements.length === 0) {
    els.movementRows.innerHTML = '<tr><td class="empty" colspan="9">Sin movimientos registrados.</td></tr>';
    return;
  }

  els.movementRows.innerHTML = state.movements
    .map(
      (movement) => `
        <tr>
          <td>${movement.id_movimiento}</td>
          <td>${escapeHtml(movement.descripcion)}</td>
          <td>${badge(movement.tipo)}</td>
          <td>${movement.cantidad}</td>
          <td>${escapeHtml(movement.usuario)}</td>
          <td>${valueOrDash(movement.id_orden)}</td>
          <td>${valueOrDash(movement.id_movimiento_origen)}</td>
          <td>${formatDate(movement.fecha)}</td>
          <td>
            ${
              Number(movement.es_reversion) === 1
                ? 'Revertido'
                : Number(movement.fue_revertido) === 1
                  ? 'Revertido'
                  : `<button class="secondary" type="button" data-revert-movement="${movement.id_movimiento}">Revertir</button>`
            }
          </td>
        </tr>
      `
    )
    .join('');
}

function renderMessages() {
  if (state.messages.length === 0) {
    els.messageRows.innerHTML = '<tr><td class="empty" colspan="5">Sin mensajes registrados.</td></tr>';
  } else {
    els.messageRows.innerHTML = state.messages
      .map(
        (message) => `
          <tr>
            <td>${message.id_mensaje}</td>
            <td>${escapeHtml(message.mensaje)}</td>
            <td>${escapeHtml(message.usuario)}</td>
            <td>${valueOrDash(message.id_movimiento)}</td>
            <td>${formatDate(message.fecha)}</td>
          </tr>
        `
      )
      .join('');
  }

  const pagination = state.messagesPagination || { page: 1, totalPages: 1 };
  els.messagePageInfo.textContent = `Pagina ${pagination.page} de ${pagination.totalPages}`;
  els.messagePrev.disabled = pagination.page <= 1;
  els.messageNext.disabled = pagination.page >= pagination.totalPages;
}

function renderUsers() {
  if (state.users.length === 0) {
    els.userRows.innerHTML = '<tr><td class="empty" colspan="6">Sin usuarios registrados.</td></tr>';
    return;
  }

  els.userRows.innerHTML = state.users
    .map((user) => {
      const canEdit = state.user.id_usuario !== user.id_usuario;
      const isActive = Number(user.activo) === 1;
      const actions = canEdit
        ? `
          <div class="actions">
            <button class="secondary" type="button" data-edit-user="${user.id_usuario}">Editar</button>
            ${
              isActive
                ? `<button class="secondary" type="button" data-deactivate-user="${user.id_usuario}">Desactivar</button>`
                : `<button type="button" data-activate-user="${user.id_usuario}">Activar</button>`
            }
          </div>
        `
        : '-';

      return `
        <tr>
          <td>${user.id_usuario}</td>
          <td>${escapeHtml(user.nombre)}</td>
          <td>${escapeHtml(user.username)}</td>
          <td>${roleLabel(user.role || user.rol)}</td>
          <td>${badge(isActive ? 'activo' : 'inactivo')}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join('');
}

function renderReport() {
  if (!state.report) return;

  const allMissing = state.report.missingProducts || [];
  const missing = state.onlyCriticalMissing
    ? allMissing.filter((item) => item.prioridad === 'critica')
    : allMissing;
  const flow = state.report.productFlow || [];
  const totalMissingPages = Math.max(Math.ceil(missing.length / 25), 1);
  state.missingPage = Math.min(state.missingPage, totalMissingPages);
  els.toggleCriticalMissing.textContent = state.onlyCriticalMissing ? 'Ver todos' : 'Solo criticos';

  els.missingRows.innerHTML =
    missing.length === 0
      ? '<tr><td class="empty" colspan="8">Sin faltantes.</td></tr>'
      : missing
          .slice((state.missingPage - 1) * 25, state.missingPage * 25)
          .map(
            (item) => `
              <tr>
                <td>
                  <input type="checkbox" data-missing-id="${item.id_refaccion}" ${state.selectedMissing.has(String(item.id_refaccion)) ? 'checked' : ''}>
                </td>
                <td>${escapeHtml(item.descripcion)}</td>
                <td>${escapeHtml(item.no_parte)}</td>
                <td><strong>${item.existencias}</strong></td>
                <td>${item.minimos}</td>
                <td>${item.maximos}</td>
                <td>${badge(item.prioridad || 'faltante')}</td>
                <td><strong>${Math.max((item.maximos || 0) - (item.existencias || 0), 0)}</strong></td>
              </tr>
            `
          )
          .join('');

  els.missingPageInfo.textContent = `Pagina ${state.missingPage} de ${totalMissingPages}`;
  els.missingPrev.disabled = state.missingPage <= 1;
  els.missingNext.disabled = state.missingPage >= totalMissingPages;

  els.flowRows.innerHTML =
    flow.length === 0
      ? '<tr><td class="empty" colspan="5">Sin movimientos en el periodo.</td></tr>'
      : flow
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.descripcion)}</td>
                <td>${escapeHtml(item.no_parte)}</td>
                <td>${item.entradas}</td>
                <td>${item.salidas}</td>
                <td>${item.movimientos}</td>
              </tr>
            `
          )
          .join('');
}

function renderStats() {
  if (!state.stats) return;

  const summary = state.stats.summary || {};
  const cards = [
    ['Entradas', summary.entradas || 0],
    ['Salidas', summary.salidas || 0],
    ['Movimientos', summary.movimientos || 0],
    ['Faltantes', (state.stats.lowStock || []).length]
  ];

  els.statsCards.innerHTML = cards
    .map(
      ([label, value]) => `
        <section class="stats-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </section>
      `
    )
    .join('');

  els.topOutputRows.innerHTML =
    state.stats.topOutputs.length === 0
      ? '<tr><td class="empty" colspan="3">Sin salidas.</td></tr>'
      : state.stats.topOutputs
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.descripcion)}</td>
                <td>${escapeHtml(item.no_parte)}</td>
                <td><strong>${item.cantidad}</strong></td>
              </tr>
            `
          )
          .join('');

  els.topInputRows.innerHTML =
    state.stats.topInputs.length === 0
      ? '<tr><td class="empty" colspan="3">Sin entradas.</td></tr>'
      : state.stats.topInputs
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.descripcion)}</td>
                <td>${escapeHtml(item.no_parte)}</td>
                <td><strong>${item.cantidad}</strong></td>
              </tr>
            `
          )
          .join('');
}

function addDetailRow() {
  const node = els.detailTemplate.content.cloneNode(true);
  const row = node.querySelector('.detail-row');
  setDetailOptions(row, []);
  els.detailRows.appendChild(node);
}

async function openOrderForInventoryItem(idRefaccion) {
  const item = await api(`/api/inventario/${idRefaccion}`);
  const orderTab = document.querySelector('.tab[data-tab="ordenes"]');
  if (orderTab) orderTab.click();

  els.detailRows.innerHTML = '';
  addDetailRow();
  const row = els.detailRows.querySelector('.detail-row');
  setDetailOptions(row, [item], item.id_refaccion);
  row.querySelector('.part-search').value = optionLabel(item);
  row.querySelector('[name="cantidad"]').focus();
  window.scrollTo({ top: els.orderForm.offsetTop - 20, behavior: 'smooth' });
}

function removeBlankDetailRows() {
  const rows = [...els.detailRows.querySelectorAll('.detail-row')];
  rows.forEach((row) => {
    const selected = row.querySelector('[name="id_refaccion"]').value;
    const search = row.querySelector('.part-search').value.trim();
    if (!selected && !search && rows.length > 1) row.remove();
  });
}

function exportMissingItems(items, fileLabel) {
  if (items.length === 0) {
    showAlert('Selecciona al menos un faltante', 'error');
    return;
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.descripcion)}</td>
          <td>${escapeHtml(item.no_parte)}</td>
          <td>${escapeHtml(item.ubicacion)}</td>
          <td>${item.existencias}</td>
          <td>${item.minimos}</td>
          <td>${item.maximos}</td>
          <td>${escapeHtml(item.prioridad || 'faltante')}</td>
        </tr>
      `
    )
    .join('');

  const html = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Refaccion</th>
              <th>No. parte</th>
              <th>Ubicacion</th>
              <th>Existencias</th>
              <th>Minimo</th>
              <th>Maximo</th>
              <th>Prioridad</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileLabel}-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function exportSelectedMissing() {
  if (!state.report) return;

  const source = state.onlyCriticalMissing
    ? (state.report.missingProducts || []).filter((item) => item.prioridad === 'critica')
    : (state.report.missingProducts || []);

  const selected = source.filter((item) =>
    state.selectedMissing.has(String(item.id_refaccion))
  );

  exportMissingItems(selected, 'faltantes-seleccionados');
}

function exportAllMissing() {
  if (!state.report) return;
  const source = state.onlyCriticalMissing
    ? (state.report.missingProducts || []).filter((item) => item.prioridad === 'critica')
    : (state.report.missingProducts || []);
  exportMissingItems(source, state.onlyCriticalMissing ? 'faltantes-criticos' : 'faltantes-todos');
}

async function loadSession() {
  const data = await api('/api/usuarios/me');
  state.user = data.user;
  renderSession();
}

async function loadInventory() {
  const q = els.inventorySearch.value.trim();
  const result = await api(`/api/inventario?page=${state.inventoryPage}&limit=25&q=${encodeURIComponent(q)}`);
  state.inventory = result.items || [];
  state.inventoryPagination = result.pagination || null;
  renderInventory();
}

async function loadPendingInventory() {
  if (!canReviewOperations()) {
    state.pendingInventory = [];
    renderPendingInventory();
    return;
  }

  state.pendingInventory = await api('/api/inventario/pendientes');
  renderPendingInventory();
}

async function loadOrders() {
  const dateVal = els.orderDateFilter ? els.orderDateFilter.value : '';

  if (dateVal) {
    // Modo plano: filtro de fecha activo
    const url = `/api/ordenes?date=${encodeURIComponent(dateVal)}`;
    const result = await api(url);
    // El servicio devuelve array plano cuando hay date
    state.orders = Array.isArray(result) ? result : [];
    state.ordersRecent = [];
    state.ordersHistory = [];
    state.ordersHistoryPagination = null;
    renderOrders();
    if (els.orderHistoryRows) els.orderHistoryRows.innerHTML = '<tr><td class="empty" colspan="10">Usa el boton Actualizar para quitar el filtro.</td></tr>';
    if (els.orderHistoryPageInfo) els.orderHistoryPageInfo.textContent = '';
    if (els.orderHistoryPrev) els.orderHistoryPrev.disabled = true;
    if (els.orderHistoryNext) els.orderHistoryNext.disabled = true;
  } else {
    // Modo dual: sin filtro de fecha
    const result = await api(`/api/ordenes?history_page=${state.ordersHistoryPage}`);
    state.ordersRecent = result.recent || [];
    state.ordersHistory = (result.history && result.history.items) || [];
    state.ordersHistoryPagination = (result.history && result.history.pagination) || null;
    state.orders = [];
    renderRecentOrders();
    renderHistoryOrders();
  }
}

async function loadOrdersHistory(page) {
  state.ordersHistoryPage = page;
  const result = await api(`/api/ordenes?history_page=${page}`);
  state.ordersHistory = (result.history && result.history.items) || [];
  state.ordersHistoryPagination = (result.history && result.history.pagination) || null;
  renderHistoryOrders();
}

async function loadMovements() {
  if (!canViewMovements()) {
    state.movements = [];
    renderMovements();
    return;
  }

  state.movements = await api('/api/movimientos');
  renderMovements();
}

async function loadMessages() {
  if (!canViewMovements()) {
    state.messages = [];
    state.messagesPagination = null;
    renderMessages();
    return;
  }

  const q = els.messageSearch.value.trim();
  const dateFrom = els.messageDateFrom.value;
  const dateTo = els.messageDateTo.value;
  const result = await api(
    `/api/movimientos/mensajes?page=${state.messagesPage}&limit=25&q=${encodeURIComponent(q)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
  );
  state.messages = result.items || [];
  state.messagesPagination = result.pagination || null;
  renderMessages();
}

async function loadUsers() {
  if (!canViewStats()) {
    state.users = [];
    renderUsers();
    return;
  }

  state.users = await api('/api/usuarios');
  renderUsers();
}

async function loadReport() {
  const period = els.reportPeriod.value;
  state.report = await api(`/api/reportes?period=${encodeURIComponent(period)}`);
  state.missingPage = 1;
  state.selectedMissing.clear();
  renderReport();
}

async function loadStats() {
  if (!canViewStats()) {
    state.stats = null;
    return;
  }

  const period = els.statsPeriod.value;
  state.stats = await api(`/api/reportes/estadisticas?period=${encodeURIComponent(period)}`);
  renderStats();
}

async function loadAdjustmentMode() {
  if (!hasRole(['admin', 'encargado'])) {
    state.adjustmentMode = { estado: 'inactivo' };
    renderAdjustmentMode();
    return;
  }

  state.adjustmentMode = await api('/api/inventario/ajuste/modo');
  renderAdjustmentMode();

  if (state.adjustmentMode.estado !== 'inactivo') {
    await loadAdjustmentItems();
  }
}

function renderAdjustmentMode() {
  const mode = state.adjustmentMode;
  const banner = els.adjustmentBanner;
  const text = els.adjustmentBannerText;
  const toggle = els.toggleAdjustmentMode;
  const editSection = els.adjustmentEditSection;

  if (!banner) return;

  if (mode.estado === 'activo' || mode.estado === 'en_revision') {
    banner.className = 'adjustment-banner active';
    const byText = mode.updated_by ? ` por ${mode.updated_by}` : '';
    text.textContent = `Modo de ajuste: ${mode.estado === 'en_revision' ? 'EN REVISIÓN' : 'ACTIVO'}${byText}`;
    
    if (toggle) {
      toggle.textContent = 'Desactivar modo';
      toggle.className = 'danger';
    }
    
    const isReview = mode.estado === 'en_revision';
    const isAdmin = state.user && state.user.rol === 'admin';
    const isEncargado = state.user && state.user.rol === 'encargado';
    
    const showTable = (isEncargado && mode.estado === 'activo') || (isAdmin && isReview);
    
    if (editSection) {
      editSection.hidden = !showTable;
      
      els.adjustmentInstructionText.textContent = isReview 
        ? "Borrador en revisión. Confirma para aplicar los cambios o rechaza para devolverlos." 
        : "Modifica las cantidades y haz clic en Guardar Progreso. Al terminar, envía a revisión.";
      
      // Determinar visibilidad de botones según estado y rol
      if (els.saveAdjustmentDraft) els.saveAdjustmentDraft.hidden = isReview || !isEncargado;
      if (els.sendAdjustmentReview) els.sendAdjustmentReview.hidden = isReview || !isEncargado;
      if (els.approveAdjustment) els.approveAdjustment.hidden = !isReview || !isAdmin;
      if (els.rejectAdjustment) els.rejectAdjustment.hidden = !isReview || !isAdmin;

      // Mostrar/ocultar el botón de agregar nueva refacción en barra de acciones
      const addRowBtn = document.querySelector('#addAdjustmentRowAction');
      if (addRowBtn) addRowBtn.hidden = isReview || !isEncargado;

      // Ocultar "Dar de alta" mientras el modo ajuste está activo (evita flujos paralelos)
      if (els.showInventoryForm) {
        els.showInventoryForm.hidden = !isReview && isEncargado && (mode.estado === 'activo');
      }
    }
  } else {
    banner.className = 'adjustment-banner inactive';
    text.textContent = 'Modo de ajuste: Inactivo';
    if (toggle) {
      toggle.textContent = 'Activar modo';
      toggle.className = '';
    }
    if (editSection) editSection.hidden = true;

    // Restaurar botón "Dar de alta" cuando el modo está inactivo
    if (els.showInventoryForm) els.showInventoryForm.hidden = false;

    // Ocultar botón de agregar fila
    const addRowBtn = document.querySelector('#addAdjustmentRowAction');
    if (addRowBtn) addRowBtn.hidden = true;
  }
}

async function loadAdjustmentItems() {
  const allItems = await api('/api/inventario?all=1');
  let drafts = [];
  let newItems = [];
  try {
    drafts = await api('/api/inventario/ajuste/borrador');
    newItems = await api('/api/inventario/ajuste/nuevos');
  } catch (e) {
    console.error('Error cargando borrador', e);
  }

  const draftMap = new Map();
  drafts.forEach(d => draftMap.set(Number(d.id_refaccion), d));

  state.adjustmentItems = allItems.map(item => {
    const draft = draftMap.get(Number(item.id_refaccion));
    if (draft) {
      if (Number(draft.marcar_eliminar) === 1) {
        return { ...item, _marcar_eliminar: true, isDraft: true };
      }
      const merged = { ...item };
      ['descripcion', 'no_parte', 'ubicacion', 'existencias', 'minimos', 'maximos'].forEach(field => {
        if (draft[field] !== null && draft[field] !== undefined) merged[field] = draft[field];
      });
      return {
        ...merged,
        old_descripcion: draft.old_descripcion,
        old_no_parte: draft.old_no_parte,
        old_ubicacion: draft.old_ubicacion,
        old_existencias: draft.old_existencias,
        old_minimos: draft.old_minimos,
        old_maximos: draft.old_maximos,
        isDraft: true
      };
    }
    return item;
  });

  // Filas nuevas pendientes guardadas
  state.adjustmentNewItems = newItems.map(n => ({ ...n, isNew: true }));

  renderAdjustmentItems();
}

function renderAdjustmentItems() {
  if (!els.adjustmentRows) return;

  const searchTerm = (els.adjustmentSearch?.value || '').trim().toLowerCase();
  let items = state.adjustmentItems || [];

  if (searchTerm.length >= 2) {
    items = items.filter((item) =>
      (item.descripcion || '').toLowerCase().includes(searchTerm) ||
      (item.no_parte || '').toLowerCase().includes(searchTerm) ||
      (item.ubicacion || '').toLowerCase().includes(searchTerm)
    );
  }

  const mode = state.adjustmentMode.estado;
  const isEditing = mode === 'activo';
  const isReview = mode === 'en_revision';

  // -- Modo edición (encargado editando) --
  if (isEditing) {
    const existingRows = items.map((item) => {
      const isDraft = item.isDraft;
      const isDeleted = item._marcar_eliminar;
      const getOriginal = (field) => isDraft && !isDeleted && item[`old_${field}`] !== undefined ? item[`old_${field}`] : item[field];
      const isModified = (field) => isDraft && !isDeleted && String(item[field]) !== String(item[`old_${field}`]);

      const rowClass = isDeleted ? 'adj-row-delete' : '';
      const deleteBtn = isDeleted
        ? `<button type="button" class="adj-btn-restore" data-adj-restore="${item.id_refaccion}" title="Deshacer eliminacion">↩ Restaurar</button>`
        : `<button type="button" class="adj-btn-delete" data-adj-delete="${item.id_refaccion}" title="Marcar para eliminar">🗑</button>`;

      if (isDeleted) {
        return `
          <tr data-adj-id="${item.id_refaccion}" class="${rowClass}">
            <td class="id-cell">${item.id_refaccion}</td>
            <td colspan="7" class="adj-delete-label">❌ ${escapeHtml(item.descripcion)} — marcada para <strong>eliminar</strong></td>
            <td>${deleteBtn}</td>
          </tr>`;
      }

      return `
        <tr data-adj-id="${item.id_refaccion}" class="${rowClass}">
          <td class="id-cell">${item.id_refaccion}</td>
          <td><input type="text" name="descripcion" value="${escapeHtml(item.descripcion || '')}" data-original="${escapeHtml(getOriginal('descripcion') || '')}" class="${isModified('descripcion') ? 'modified' : ''}"></td>
          <td><input type="text" name="no_parte" value="${escapeHtml(item.no_parte || '')}" data-original="${escapeHtml(getOriginal('no_parte') || '')}" class="${isModified('no_parte') ? 'modified' : ''}"></td>
          <td><input type="text" name="ubicacion" value="${escapeHtml(item.ubicacion || '')}" data-original="${escapeHtml(getOriginal('ubicacion') || '')}" class="${isModified('ubicacion') ? 'modified' : ''}"></td>
          <td><input type="number" name="existencias" min="0" value="${item.existencias}" data-original="${getOriginal('existencias')}" class="${isModified('existencias') ? 'modified' : ''}"></td>
          <td><input type="number" name="minimos" min="0" value="${item.minimos}" data-original="${getOriginal('minimos')}" class="${isModified('minimos') ? 'modified' : ''}"></td>
          <td><input type="number" name="maximos" min="0" value="${item.maximos}" data-original="${getOriginal('maximos')}" class="${isModified('maximos') ? 'modified' : ''}"></td>
          <td>${imageUploadCell(item)}</td>
          <td>${deleteBtn}</td>
        </tr>`;
    });

    // Filas nuevas en edición
    const newRows = (state.adjustmentNewItems || []).map((item, idx) => `
      <tr data-new-idx="${idx}" data-new-id="${item.id_nuevo || ''}" class="adj-row-new">
        <td class="id-cell">+</td>
        <td><input type="text" name="descripcion" value="${escapeHtml(item.descripcion || '')}" placeholder="Descripcion *"></td>
        <td><input type="text" name="no_parte" value="${escapeHtml(item.no_parte || '')}" placeholder="No. parte"></td>
        <td><input type="text" name="ubicacion" value="${escapeHtml(item.ubicacion || '')}" placeholder="Ubicacion"></td>
        <td><input type="number" name="existencias" min="0" value="${item.existencias || 0}"></td>
        <td><input type="number" name="minimos" min="0" value="${item.minimos || 0}"></td>
        <td><input type="number" name="maximos" min="0" value="${item.maximos || 0}"></td>
        <td>${adjustmentNewImageUploadCell(item, idx)}</td>
        <td><button type="button" class="adj-btn-delete" data-remove-new="${idx}">✕</button></td>
      </tr>`);

    // Fila separadora al final (sin el botón, que ahora está en la barra de acciones)
    const addRow = `
      <tr class="adj-row-add-btn" id="adj-add-row-placeholder"><td colspan="9"></td></tr>`;

    if (items.length === 0 && (state.adjustmentNewItems || []).length === 0) {
      els.adjustmentRows.innerHTML = `<tr><td class="empty" colspan="9">Sin items. Usa el boton de arriba para agregar una nueva refaccion.</td></tr>${addRow}`;
    } else {
      els.adjustmentRows.innerHTML = existingRows.join('') + newRows.join('') + addRow;
    }
    return;
  }

  // -- Modo revisión (admin revisando) --
  if (isReview) {
    const drafts = items.filter(i => i.isDraft);
    const deletions = drafts.filter(i => i._marcar_eliminar);
    const edits = drafts.filter(i => !i._marcar_eliminar);
    const newItems = state.adjustmentNewItems || [];

    const renderEdit = (item) => {
      const isModified = (field) => String(item[field]) !== String(item[`old_${field}`]);
      return `
        <tr data-adj-id="${item.id_refaccion}">
          <td class="id-cell">${item.id_refaccion}</td>
          <td class="${isModified('descripcion') ? 'adj-modified-cell' : ''}">${escapeHtml(item.descripcion || '')}</td>
          <td class="${isModified('no_parte') ? 'adj-modified-cell' : ''}">${escapeHtml(item.no_parte || '')}</td>
          <td class="${isModified('ubicacion') ? 'adj-modified-cell' : ''}">${escapeHtml(item.ubicacion || '')}</td>
          <td class="${isModified('existencias') ? 'adj-modified-cell' : ''}">${item.existencias}</td>
          <td class="${isModified('minimos') ? 'adj-modified-cell' : ''}">${item.minimos}</td>
          <td class="${isModified('maximos') ? 'adj-modified-cell' : ''}">${item.maximos}</td>
          <td>${imagePathCell(item)}</td>
          <td>✏️</td>
        </tr>`;
    };

    const renderDeletion = (item) => `
      <tr class="adj-row-delete">
        <td class="id-cell">${item.id_refaccion}</td>
        <td colspan="7">${escapeHtml(item.descripcion)}</td>
        <td>🗑</td>
      </tr>`;

    const renderNew = (item) => `
      <tr class="adj-row-new">
        <td class="id-cell">+</td>
        <td>${escapeHtml(item.descripcion)}</td>
        <td>${escapeHtml(item.no_parte || '')}</td>
        <td>${escapeHtml(item.ubicacion || '')}</td>
        <td>${item.existencias || 0}</td>
        <td>${item.minimos || 0}</td>
        <td>${item.maximos || 0}</td>
        <td>${imagePathCell(item)}</td>
        <td>➕</td>
      </tr>`;

    let html = '';
    if (edits.length > 0) html += `<tr class="adj-section-header"><td colspan="9">✏️ Ediciones (${edits.length})</td></tr>` + edits.map(renderEdit).join('');
    if (deletions.length > 0) html += `<tr class="adj-section-header adj-section-delete"><td colspan="9">🗑 Bajas (${deletions.length})</td></tr>` + deletions.map(renderDeletion).join('');
    if (newItems.length > 0) html += `<tr class="adj-section-header adj-section-new"><td colspan="9">➕ Altas (${newItems.length})</td></tr>` + newItems.map(renderNew).join('');
    if (!html) html = '<tr><td class="empty" colspan="9">Sin cambios en el borrador.</td></tr>';

    els.adjustmentRows.innerHTML = html;
    return;
  }

  // Fallback sin modo activo
  els.adjustmentRows.innerHTML = '<tr><td class="empty" colspan="9">Modo de ajuste inactivo.</td></tr>';
}

function collectAdjustmentChanges() {
  const rows = els.adjustmentRows.querySelectorAll('tr[data-adj-id]');
  const items = [];

  rows.forEach((row) => {
    const id = Number(row.dataset.adjId);

    // Fila marcada para eliminar
    if (row.classList.contains('adj-row-delete')) {
      items.push({ id_refaccion: id, marcar_eliminar: true });
      return;
    }

    const inputs = row.querySelectorAll('input');
    const item = { id_refaccion: id };
    let hasChange = false;

    inputs.forEach((input) => {
      if (!input.name || input.type === 'file') return;
      const original = input.dataset.original || '';
      const current = input.value;
      if (current !== original) {
        hasChange = true;
        item[input.name] = input.type === 'number' ? Number(current) : current;
      }
    });

    if (hasChange) items.push(item);
  });

  return items;
}

function collectAdjustmentNewItems() {
  const rows = els.adjustmentRows.querySelectorAll('tr[data-new-idx]');
  const items = [];
  rows.forEach((row) => {
    const inputs = row.querySelectorAll('input');
    const item = {};
    if (row.dataset.newId) item.id_nuevo = Number(row.dataset.newId);
    inputs.forEach(input => {
      if (!input.name || input.type === 'file') return;
      item[input.name] = input.type === 'number' ? Number(input.value) : input.value;
    });
    if (item.descripcion && item.descripcion.trim()) items.push(item);
  });
  return items;
}

async function loadAdjustmentLogs() {
  if (!hasRole(['admin', 'encargado'])) {
    state.adjustmentLogs = [];
    state.adjustmentLogsPagination = null;
    renderAdjustmentLogs();
    return;
  }

  const result = await api(`/api/inventario/ajuste/logs?page=${state.adjustmentLogsPage}&limit=25`);
  state.adjustmentLogs = result.items || [];
  state.adjustmentLogsPagination = result.pagination || null;
  renderAdjustmentLogs();
}

function renderAdjustmentLogs() {
  if (!els.adjustmentLogRows) return;

  if (state.adjustmentLogs.length === 0) {
    els.adjustmentLogRows.innerHTML = '<tr><td class="empty" colspan="7">Sin logs de ajuste.</td></tr>';
  } else {
    els.adjustmentLogRows.innerHTML = state.adjustmentLogs
      .map((log) => `
        <tr>
          <td>${log.id_log}</td>
          <td>${escapeHtml(log.descripcion)}</td>
          <td>${escapeHtml(log.campo_modificado)}</td>
          <td>${escapeHtml(String(log.valor_anterior ?? ''))}</td>
          <td><strong>${escapeHtml(String(log.valor_nuevo ?? ''))}</strong></td>
          <td>${escapeHtml(log.usuario)}</td>
          <td>${formatDate(log.fecha)}</td>
        </tr>`)
      .join('');
  }

  const pagination = state.adjustmentLogsPagination || { page: 1, totalPages: 1 };
  if (els.adjustmentLogPageInfo) {
    els.adjustmentLogPageInfo.textContent = `Pagina ${pagination.page} de ${pagination.totalPages}`;
  }
  if (els.adjustmentLogPrev) els.adjustmentLogPrev.disabled = pagination.page <= 1;
  if (els.adjustmentLogNext) els.adjustmentLogNext.disabled = pagination.page >= pagination.totalPages;
}

async function refreshAll() {
  if (!state.user) return;
  await Promise.all([
    loadInventory(), loadPendingInventory(), loadOrders(),
    loadMovements(), loadMessages(), loadUsers(),
    loadReport(), loadStats(),
    loadAdjustmentMode(), loadAdjustmentLogs()
  ]);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`#${tab.dataset.tab}`).classList.add('active');
  });
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const payload = readForm(els.loginForm);
    const data = await api('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.user = data.user;
    renderSession();
    els.loginForm.reset();
    await refreshAll();
    showAlert('Sesion iniciada');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.firstAdminForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const payload = readForm(els.firstAdminForm);
    await api('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ ...payload, rol: 'admin' })
    });
    els.firstAdminForm.reset();
    showAlert('Administrador creado. Ahora inicia sesion.');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.logoutButton.addEventListener('click', async () => {
  await api('/api/usuarios/logout', { method: 'POST' });
  state.user = null;
  renderSession();
  showAlert('Sesion cerrada');
});

els.userForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const payload = readForm(els.userForm);
    await api('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    els.userForm.reset();
    await Promise.all([loadUsers(), loadMessages()]);
    showAlert('Usuario creado');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.userRows.addEventListener('click', async (event) => {
  const editUserId = event.target.dataset.editUser;
  const deactivateUserId = event.target.dataset.deactivateUser;
  const activateUserId = event.target.dataset.activateUser;

  try {
    if (editUserId) {
      const user = state.users.find((item) => Number(item.id_usuario) === Number(editUserId));
      const nombre = window.prompt('Nombre', user.nombre);
      if (!nombre) return;

      const username = window.prompt('Usuario', user.username);
      if (!username) return;

      const password = window.prompt('Nuevo password (dejar vacio para no cambiar)') || '';
      const rol = hasRole(['admin'])
        ? window.prompt('Rol (admin, encargado, operador)', user.role || user.rol)
        : user.role || user.rol;
      await api(`/api/usuarios/${editUserId}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre, username, password, rol })
      });
      await Promise.all([loadUsers(), loadMessages()]);
      showAlert('Usuario editado');
    }

    if (deactivateUserId) {
      const user = state.users.find((item) => Number(item.id_usuario) === Number(deactivateUserId));
      const confirmed = window.confirm(`Desactivar usuario ${user.nombre}?`);
      if (!confirmed) return;

      await api(`/api/usuarios/${deactivateUserId}`, { method: 'DELETE' });
      await Promise.all([loadUsers(), loadMessages()]);
      showAlert('Usuario desactivado');
    }

    if (activateUserId) {
      const user = state.users.find((item) => Number(item.id_usuario) === Number(activateUserId));
      const confirmed = window.confirm(`Activar usuario ${user.nombre}?`);
      if (!confirmed) return;

      await api(`/api/usuarios/${activateUserId}/activar`, { method: 'PATCH' });
      await Promise.all([loadUsers(), loadMessages()]);
      showAlert('Usuario activado');
    }
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.inventoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = els.inventoryForm.querySelector('[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

  try {
    const form = readForm(els.inventoryForm);
    const item = await api('/api/inventario', {
      method: 'POST',
      body: JSON.stringify({
        descripcion: form.descripcion,
        no_parte: form.no_parte,
        ubicacion: form.ubicacion,
        minimos: Number(form.minimos || 0),
        maximos: Number(form.maximos || 0)
      })
    });
    els.inventoryForm.reset();
    els.inventoryForm.elements.minimos.value = 0;
    els.inventoryForm.elements.maximos.value = 0;
    await Promise.all([loadInventory(), loadPendingInventory(), loadMessages()]);
    showAlert(item.estado_revision === 'pendiente' ? 'Solicitud de alta enviada' : 'Refaccion agregada');
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
  }
});

els.pendingInventoryRows.addEventListener('click', async (event) => {
  const approveId = event.target.dataset.approveInventory;
  const rejectId = event.target.dataset.rejectInventory;

  try {
    if (approveId) {
      await api(`/api/inventario/${approveId}/aprobar`, { method: 'POST' });
      await Promise.all([loadInventory(), loadPendingInventory(), loadMessages()]);
      showAlert('Alta aprobada');
    }

    if (rejectId) {
      const item = state.pendingInventory.find((pending) => Number(pending.id_refaccion) === Number(rejectId));
      const confirmed = window.confirm(`Rechazar alta de ${item?.descripcion || 'esta refaccion'}?`);
      if (!confirmed) return;

      await api(`/api/inventario/${rejectId}/rechazar`, { method: 'POST' });
      await Promise.all([loadPendingInventory(), loadMessages()]);
      showAlert('Alta rechazada');
    }
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.inventoryRows.addEventListener('click', async (event) => {
  const generateOrderId = event.target.dataset.generateOrder;
  if (!generateOrderId) return;

  try {
    await openOrderForInventoryItem(generateOrderId);
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.adjustmentRows.addEventListener('click', async (event) => {
  const uploadId = event.target.dataset.uploadImage;
  const editId = event.target.dataset.editImage;
  const deleteId = event.target.dataset.deleteImage;
  const uploadNewId = event.target.dataset.uploadNewImage;
  const editNewId = event.target.dataset.editNewImage;
  const deleteNewId = event.target.dataset.deleteNewImage;
  const uploadNewDraftIdx = event.target.dataset.uploadNewDraftImage;

  if (editNewId) {
    const input = els.adjustmentRows.querySelector(`[data-new-image-file="${editNewId}"]`);
    if (input) input.click();
    return;
  }

  if (deleteNewId) {
    const confirmed = window.confirm('Eliminar la imagen de esta alta nueva?');
    if (!confirmed) return;

    event.target.disabled = true;
    event.target.textContent = 'Eliminando...';

    try {
      await deleteAdjustmentNewImage(deleteNewId);
      await Promise.all([loadAdjustmentItems(), loadMessages()]);
      showAlert('Imagen eliminada');
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      event.target.disabled = false;
      event.target.textContent = 'Eliminar';
    }
    return;
  }

  if (uploadNewId) {
    const input = els.adjustmentRows.querySelector(`[data-new-image-file="${uploadNewId}"]`);
    const file = input?.files?.[0];

    event.target.disabled = true;
    event.target.textContent = 'Cargando...';

    try {
      await handleAdjustmentNewImageUpload(uploadNewId, file, event.target);
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      event.target.disabled = false;
      event.target.textContent = 'Subir / cargar';
    }
    return;
  }

  if (uploadNewDraftIdx !== undefined) {
    const input = els.adjustmentRows.querySelector(`[data-new-draft-image-file="${uploadNewDraftIdx}"]`);
    const file = input?.files?.[0];
    if (!file) {
      showAlert('Selecciona una imagen para cargar', 'error');
      return;
    }

    event.target.disabled = true;
    event.target.textContent = 'Cargando...';

    try {
      const idNuevo = await persistAdjustmentNewRowForImage(Number(uploadNewDraftIdx));
      await handleAdjustmentNewImageUpload(idNuevo, file, event.target);
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      event.target.disabled = false;
      event.target.textContent = 'Subir / cargar';
    }
    return;
  }

  if (editId) {
    const input = els.adjustmentRows.querySelector(`[data-image-file="${editId}"]`);
    if (input) input.click();
    return;
  }

  if (deleteId) {
    const confirmed = window.confirm('Eliminar la imagen de esta refaccion?');
    if (!confirmed) return;

    event.target.disabled = true;
    event.target.textContent = 'Eliminando...';

    try {
      await deleteInventoryImage(deleteId);
      await Promise.all([loadInventory(), loadAdjustmentItems(), loadPendingInventory(), loadMessages()]);
      showAlert('Imagen eliminada');
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      event.target.disabled = false;
      event.target.textContent = 'Eliminar';
    }
    return;
  }

  if (!uploadId) return;

  const input = els.adjustmentRows.querySelector(`[data-image-file="${uploadId}"]`);
  const file = input?.files?.[0];

  event.target.disabled = true;
  event.target.textContent = 'Cargando...';

  try {
    await handleAdjustmentImageUpload(uploadId, file, event.target);
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    event.target.disabled = false;
    event.target.textContent = 'Subir / cargar';
  }
});

els.adjustmentRows.addEventListener('change', async (event) => {
  if (event.target.matches('[data-new-auto-upload="1"]')) {
    const uploadId = event.target.dataset.newImageFile;
    const file = event.target.files?.[0];
    if (!uploadId || !file) return;

    try {
      await handleAdjustmentNewImageUpload(uploadId, file, event.target);
    } catch (error) {
      showAlert(error.message, 'error');
    }
    return;
  }

  if (!event.target.matches('[data-auto-upload="1"]')) return;

  const uploadId = event.target.dataset.imageFile;
  const file = event.target.files?.[0];
  if (!uploadId || !file) return;

  try {
    await handleAdjustmentImageUpload(uploadId, file, event.target);
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

document.querySelector('#addDetail').addEventListener('click', addDetailRow);

els.showInventoryForm.addEventListener('click', () => {
  els.inventoryForm.hidden = !els.inventoryForm.hidden;
});

els.detailRows.addEventListener('click', (event) => {
  if (!event.target.matches('.remove-detail')) return;
  event.target.closest('.detail-row').remove();
});

els.detailRows.addEventListener('input', (event) => {
  if (!event.target.matches('.part-search')) return;

  const input = event.target;
  window.clearTimeout(input.timer);
  input.timer = window.setTimeout(() => {
    searchDetailOptions(input.closest('.detail-row'), input.value).catch((error) => showAlert(error.message, 'error'));
  }, 250);
});

els.detailRows.addEventListener('change', (event) => {
  if (event.target.matches('[name="id_refaccion"]')) {
    updateQuantityLimits();
  }
});

els.orderForm.elements.tipo.addEventListener('change', syncOrderTypeFields);

els.orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const form = readForm(els.orderForm);
    removeBlankDetailRows();
    const detalles = [...els.detailRows.querySelectorAll('.detail-row')]
      .filter((row) => row.querySelector('[name="id_refaccion"]').value)
      .map((row) => ({
        id_refaccion: Number(row.querySelector('[name="id_refaccion"]').value),
        cantidad: Number(row.querySelector('[name="cantidad"]').value)
      }));

    if (detalles.length === 0) {
      throw new Error('Busca y selecciona al menos una refaccion');
    }

    const createdOrder = await api('/api/ordenes', {
      method: 'POST',
      body: JSON.stringify({
        tipo: form.tipo,
        solicitante: form.solicitante,
        turno: form.turno,
        maquina: form.tipo === 'salida' ? form.maquina : null,
        numero_empleado: form.numero_empleado,
        detalles
      })
    });

    // Descargar el PDF solo para salidas.
    if (form.tipo === 'salida' && createdOrder && createdOrder.id_orden) {
      try {
        const response = await fetch(`/api/ordenes/${createdOrder.id_orden}/pdf`);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vale_orden_${createdOrder.id_orden}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } else {
          console.error('Error al descargar el PDF');
        }
      } catch (err) {
        console.error('Error de red al descargar PDF:', err);
      }
    }

    els.orderForm.reset();
    els.detailRows.innerHTML = '';
    addDetailRow();
    await Promise.all([loadOrders(), loadMessages()]);
    syncOrderTypeFields();
    showAlert(form.tipo === 'salida' ? 'Orden creada y vale generado' : 'Entrada creada');
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.orderRows.addEventListener('click', async (event) => {
  const confirmId = event.target.dataset.confirm;
  const cancelId = event.target.dataset.cancel;
  const revertOrderId = event.target.dataset.revertOrder;

  try {
    if (confirmId) {
      await api(`/api/ordenes/${confirmId}/confirmar`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await Promise.all([loadInventory(), loadOrders(), loadMovements(), loadMessages()]);
      showAlert('Orden confirmada');
    }

    if (cancelId) {
      await api(`/api/ordenes/${cancelId}/cancelar`, { method: 'POST' });
      await Promise.all([loadOrders(), loadMessages()]);
      showAlert('Orden cancelada');
    }

    if (revertOrderId) {
      const motivo = window.prompt('Motivo de la reversion') || 'Correccion operativa';
      await api(`/api/ordenes/${revertOrderId}/revertir`, {
        method: 'POST',
        body: JSON.stringify({ motivo })
      });
      await Promise.all([loadInventory(), loadOrders(), loadMovements(), loadMessages()]);
      showAlert('Operacion revertida');
    }
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

els.movementRows.addEventListener('click', async (event) => {
  const revertMovementId = event.target.dataset.revertMovement;

  try {
    if (revertMovementId) {
      const motivo = window.prompt('Motivo de la reversion') || 'Correccion operativa';
      await api(`/api/movimientos/${revertMovementId}/revertir`, {
        method: 'POST',
        body: JSON.stringify({ motivo })
      });
      await Promise.all([loadInventory(), loadOrders(), loadMovements(), loadMessages()]);
      showAlert('Movimiento revertido');
    }
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

document.querySelector('#refreshInventory').addEventListener('click', () => {
  state.inventoryPage = 1;
  loadInventory().catch((error) => showAlert(error.message, 'error'));
});

els.refreshPendingInventory.addEventListener('click', () => {
  loadPendingInventory().catch((error) => showAlert(error.message, 'error'));
});

els.inventorySearch.addEventListener('input', () => {
  window.clearTimeout(els.inventorySearch.timer);
  els.inventorySearch.timer = window.setTimeout(() => {
    state.inventoryPage = 1;
    loadInventory().catch((error) => showAlert(error.message, 'error'));
  }, 250);
});

els.inventoryPrev.addEventListener('click', () => {
  state.inventoryPage = Math.max(state.inventoryPage - 1, 1);
  loadInventory().catch((error) => showAlert(error.message, 'error'));
});

els.inventoryNext.addEventListener('click', () => {
  const totalPages = state.inventoryPagination?.totalPages || 1;
  state.inventoryPage = Math.min(state.inventoryPage + 1, totalPages);
  loadInventory().catch((error) => showAlert(error.message, 'error'));
});

document.querySelector('#refreshOrders').addEventListener('click', () => {
  if (els.orderDateFilter) els.orderDateFilter.value = '';
  state.ordersHistoryPage = 1;
  loadOrders().catch((error) => showAlert(error.message, 'error'));
});

if (els.orderDateFilter) {
  els.orderDateFilter.addEventListener('change', () => {
    state.ordersHistoryPage = 1;
    loadOrders().catch((error) => showAlert(error.message, 'error'));
  });
}

if (els.orderHistoryPrev) {
  els.orderHistoryPrev.addEventListener('click', () => {
    const page = Math.max((state.ordersHistoryPage || 1) - 1, 1);
    loadOrdersHistory(page).catch((error) => showAlert(error.message, 'error'));
  });
}

if (els.orderHistoryNext) {
  els.orderHistoryNext.addEventListener('click', () => {
    const totalPages = state.ordersHistoryPagination?.totalPages || 1;
    const page = Math.min((state.ordersHistoryPage || 1) + 1, totalPages);
    loadOrdersHistory(page).catch((error) => showAlert(error.message, 'error'));
  });
}

document.querySelector('#refreshMovements').addEventListener('click', () => {
  loadMovements().catch((error) => showAlert(error.message, 'error'));
});

document.querySelector('#refreshMessages').addEventListener('click', () => {
  state.messagesPage = 1;
  loadMessages().catch((error) => showAlert(error.message, 'error'));
});

document.querySelector('#refreshUsers').addEventListener('click', () => {
  loadUsers().catch((error) => showAlert(error.message, 'error'));
});

document.querySelector('#refreshReports').addEventListener('click', () => {
  loadReport().catch((error) => showAlert(error.message, 'error'));
});

els.reportPeriod.addEventListener('change', () => {
  loadReport().catch((error) => showAlert(error.message, 'error'));
});

els.missingRows.addEventListener('change', (event) => {
  if (!event.target.matches('[data-missing-id]')) return;
  const id = event.target.dataset.missingId;

  if (event.target.checked) {
    state.selectedMissing.add(id);
  } else {
    state.selectedMissing.delete(id);
  }
});

els.messageSearch.addEventListener('input', () => {
  window.clearTimeout(els.messageSearch.timer);
  els.messageSearch.timer = window.setTimeout(() => {
    state.messagesPage = 1;
    loadMessages().catch((error) => showAlert(error.message, 'error'));
  }, 250);
});

els.messageDateFrom.addEventListener('change', () => {
  state.messagesPage = 1;
  loadMessages().catch((error) => showAlert(error.message, 'error'));
});

els.messageDateTo.addEventListener('change', () => {
  state.messagesPage = 1;
  loadMessages().catch((error) => showAlert(error.message, 'error'));
});

els.messagePrev.addEventListener('click', () => {
  state.messagesPage = Math.max(state.messagesPage - 1, 1);
  loadMessages().catch((error) => showAlert(error.message, 'error'));
});

els.messageNext.addEventListener('click', () => {
  const totalPages = state.messagesPagination?.totalPages || 1;
  state.messagesPage = Math.min(state.messagesPage + 1, totalPages);
  loadMessages().catch((error) => showAlert(error.message, 'error'));
});

els.missingPrev.addEventListener('click', () => {
  state.missingPage = Math.max(state.missingPage - 1, 1);
  renderReport();
});

els.missingNext.addEventListener('click', () => {
  const source = state.onlyCriticalMissing
    ? (state.report?.missingProducts || []).filter((item) => item.prioridad === 'critica')
    : (state.report?.missingProducts || []);
  const totalPages = Math.max(Math.ceil(source.length / 25), 1);
  state.missingPage = Math.min(state.missingPage + 1, totalPages);
  renderReport();
});

els.toggleCriticalMissing.addEventListener('click', () => {
  state.onlyCriticalMissing = !state.onlyCriticalMissing;
  state.missingPage = 1;
  renderReport();
});

els.exportMissing.addEventListener('click', exportSelectedMissing);
els.exportAllMissing.addEventListener('click', exportAllMissing);

document.querySelector('#refreshStats').addEventListener('click', () => {
  loadStats().catch((error) => showAlert(error.message, 'error'));
});

els.statsPeriod.addEventListener('change', () => {
  loadStats().catch((error) => showAlert(error.message, 'error'));
});

// Shared helper: add a blank new item row to the adjustment draft
function addAdjustmentNewRow() {
  if (!state.adjustmentNewItems) state.adjustmentNewItems = [];
  state.adjustmentNewItems.push({ descripcion: '', no_parte: '', ubicacion: '', existencias: 0, minimos: 0, maximos: 0 });
  renderAdjustmentItems();
  // Focus the description input on the newly added row
  const newRows = els.adjustmentRows.querySelectorAll('tr[data-new-idx]');
  if (newRows.length > 0) {
    const lastInput = newRows[newRows.length - 1].querySelector('input[name="descripcion"]');
    if (lastInput) lastInput.focus();
  }
}

// Adjustment mode: highlight modified fields
if (els.adjustmentRows) {
  els.adjustmentRows.addEventListener('input', (event) => {
    const input = event.target;
    if (!input.matches('input')) return;
    const original = input.dataset.original || '';
    if (input.value !== original) {
      input.classList.add('modified');
    } else {
      input.classList.remove('modified');
    }
  });

  // Delete / restore / remove-new / add row buttons (event delegation inside table)
  els.adjustmentRows.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;

    // Mark existing row for deletion
    if (btn.dataset.adjDelete) {
      const id = Number(btn.dataset.adjDelete);
      const item = state.adjustmentItems.find(i => Number(i.id_refaccion) === id);
      if (item) { item._marcar_eliminar = true; item.isDraft = true; }
      renderAdjustmentItems();
      return;
    }

    // Restore existing row
    if (btn.dataset.adjRestore) {
      const id = Number(btn.dataset.adjRestore);
      const item = state.adjustmentItems.find(i => Number(i.id_refaccion) === id);
      if (item) { item._marcar_eliminar = false; }
      renderAdjustmentItems();
      return;
    }

    // Remove a new item row
    if (btn.dataset.removeNew !== undefined) {
      const idx = Number(btn.dataset.removeNew);
      state.adjustmentNewItems.splice(idx, 1);
      renderAdjustmentItems();
      return;
    }
  });
}

// Adjustment mode: action-bar button "+ Nueva refaccion" (outside the table)
const addAdjustmentRowActionBtn = document.querySelector('#addAdjustmentRowAction');
if (addAdjustmentRowActionBtn) {
  addAdjustmentRowActionBtn.addEventListener('click', () => {
    addAdjustmentNewRow();
  });
}

// Adjustment mode: search filter
if (els.adjustmentSearch) {
  els.adjustmentSearch.addEventListener('input', () => {
    window.clearTimeout(els.adjustmentSearch.timer);
    els.adjustmentSearch.timer = window.setTimeout(() => {
      renderAdjustmentItems();
    }, 250);
  });
}

// Adjustment mode: toggle
if (els.toggleAdjustmentMode) {
  els.toggleAdjustmentMode.addEventListener('click', async () => {
    try {
      const newState = state.adjustmentMode.estado === 'inactivo' ? 'activo' : 'inactivo';
      const action = newState === 'activo' ? 'ACTIVAR' : 'DESACTIVAR';
      const confirmed = window.confirm(`¿${action} el modo de ajuste general de inventario?`);
      if (!confirmed) return;

      await api('/api/inventario/ajuste/modo', {
        method: 'PUT',
        body: JSON.stringify({ estado: newState })
      });
      await loadAdjustmentMode();
      await loadMessages();
      showAlert(newState === 'activo' ? 'Modo de ajuste activado' : 'Modo de ajuste desactivado');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  });
}

async function handleSaveDraft(silent = false) {
  const items = collectAdjustmentChanges();
  const newItems = collectAdjustmentNewItems();

  if (items.length === 0 && newItems.length === 0) {
    if (!silent) showAlert('No hay cambios para guardar', 'error');
    return [];
  }

  const requests = [];

  if (items.length > 0) {
    requests.push(api('/api/inventario/ajuste/borrador', {
      method: 'POST',
      body: JSON.stringify({ items })
    }));
  }

  // Siempre sincronizar los nuevos (aunque sea lista vacía, reemplaza los anteriores)
  requests.push(api('/api/inventario/ajuste/nuevos', {
    method: 'POST',
    body: JSON.stringify({ items: newItems })
  }));

  await Promise.all(requests);

  if (!silent) {
    const parts = [];
    if (items.length > 0) parts.push(`${items.length} edicion(es)/baja(s)`);
    if (newItems.length > 0) parts.push(`${newItems.length} nueva(s)`);
    showAlert(`Progreso guardado: ${parts.join(', ')}`);
    await loadAdjustmentItems();
  }
  return items;
}

// Adjustment mode: save draft
if (els.saveAdjustmentDraft) {
  els.saveAdjustmentDraft.addEventListener('click', async () => {
    try {
      await handleSaveDraft();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  });
}

// Adjustment mode: send to review
if (els.sendAdjustmentReview) {
  els.sendAdjustmentReview.addEventListener('click', async () => {
    try {
      const confirmed = window.confirm('¿Enviar el borrador a revisión? Ya no podrás editarlo hasta que el administrador lo apruebe o rechace.');
      if (!confirmed) return;

      await handleSaveDraft(true);
      
      await api('/api/inventario/ajuste/modo', {
        method: 'PUT',
        body: JSON.stringify({ estado: 'en_revision' })
      });
      
      showAlert('Borrador enviado a revisión exitosamente', 'success');
      await Promise.all([loadAdjustmentMode(), loadMessages()]);
    } catch (error) {
      showAlert(error.message, 'error');
    }
  });
}

// Adjustment mode: approve
if (els.approveAdjustment) {
  els.approveAdjustment.addEventListener('click', async () => {
    try {
      const confirmed = window.confirm('¿Estás seguro de APROBAR y APLICAR todos los cambios del borrador al inventario real?');
      if (!confirmed) return;

      const result = await api('/api/inventario/ajuste/aprobar', { method: 'POST' });
      const resumen = [
        result.ediciones > 0 ? `${result.ediciones} edicion(es)` : null,
        result.eliminados > 0 ? `${result.eliminados} baja(s)` : null,
        result.agregados  > 0 ? `${result.agregados} alta(s)` : null
      ].filter(Boolean).join(', ') || '0 cambios';
      showAlert(`Ajuste aplicado: ${resumen}`);
      await Promise.all([loadAdjustmentMode(), loadAdjustmentLogs(), loadInventory(), loadMessages()]);
    } catch (error) {
      showAlert(error.message, 'error');
    }
  });
}

// Adjustment mode: reject/reopen
if (els.rejectAdjustment) {
  els.rejectAdjustment.addEventListener('click', async () => {
    try {
      const confirmed = window.confirm('¿Rechazar el borrador y devolver los cambios? Esto descartará todo el progreso del encargado.');
      if (!confirmed) return;

      await api('/api/inventario/ajuste/rechazar', {
        method: 'POST'
      });
      
      showAlert('Borrador rechazado y descartado');
      await Promise.all([loadAdjustmentMode(), loadMessages()]);
    } catch (error) {
      showAlert(error.message, 'error');
    }
  });
}

// Adjustment mode: refresh
if (els.refreshAdjustmentMode) {
  els.refreshAdjustmentMode.addEventListener('click', () => {
    loadAdjustmentMode().catch((error) => showAlert(error.message, 'error'));
  });
}

// Adjustment logs: refresh
if (els.refreshAdjustmentLogs) {
  els.refreshAdjustmentLogs.addEventListener('click', () => {
    state.adjustmentLogsPage = 1;
    loadAdjustmentLogs().catch((error) => showAlert(error.message, 'error'));
  });
}

// Adjustment logs: pagination
if (els.adjustmentLogPrev) {
  els.adjustmentLogPrev.addEventListener('click', () => {
    state.adjustmentLogsPage = Math.max(state.adjustmentLogsPage - 1, 1);
    loadAdjustmentLogs().catch((error) => showAlert(error.message, 'error'));
  });
}

if (els.adjustmentLogNext) {
  els.adjustmentLogNext.addEventListener('click', () => {
    const totalPages = state.adjustmentLogsPagination?.totalPages || 1;
    state.adjustmentLogsPage = Math.min(state.adjustmentLogsPage + 1, totalPages);
    loadAdjustmentLogs().catch((error) => showAlert(error.message, 'error'));
  });
}

addDetailRow();
syncOrderTypeFields();
loadSession()
  .then(refreshAll)
  .catch((error) => showAlert(error.message, 'error'));

// ── Handler del modal de cambio obligatorio de contraseña ──
els.changePasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const cpAlert = els.cpAlert;
  const nuevaPassword = document.querySelector('#cpNewPassword').value;
  const confirmarPassword = document.querySelector('#cpConfirmPassword').value;

  cpAlert.hidden = true;

  if (nuevaPassword !== confirmarPassword) {
    cpAlert.textContent = 'Las contraseñas no coinciden';
    cpAlert.className = 'alert error';
    cpAlert.hidden = false;
    return;
  }

  const submitBtn = document.querySelector('#cpSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  try {
    await api('/api/usuarios/cambiar-password', {
      method: 'POST',
      body: JSON.stringify({ nueva_password: nuevaPassword })
    });

    // Actualizar flag en estado local
    state.user.debe_cambiar_password = false;
    els.changePasswordOverlay.hidden = true;
    els.changePasswordForm.reset();
    showAlert('Contraseña actualizada correctamente');
    await refreshAll();
  } catch (error) {
    cpAlert.textContent = error.message;
    cpAlert.className = 'alert error';
    cpAlert.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Establecer contraseña';
  }
});
