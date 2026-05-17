const state = {
  inventory: [],
  pendingInventory: [],
  inventoryPage: 1,
  inventoryPagination: null,
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
  user: null
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
  topInputRows: document.querySelector('#topInputRows')
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
    return;
  }

  els.loginScreen.hidden = false;
  els.dashboard.hidden = true;
  els.sessionName.textContent = '';
}

function renderInventory() {
  if (state.inventory.length === 0) {
    els.inventoryRows.innerHTML = '<tr><td class="empty" colspan="7">Sin refacciones registradas.</td></tr>';
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
    els.pendingInventoryRows.innerHTML = '<tr><td class="empty" colspan="7">Sin altas pendientes.</td></tr>';
    return;
  }

  els.pendingInventoryRows.innerHTML = state.pendingInventory
    .map(
      (item) => `
        <tr>
          <td>${item.id_refaccion}</td>
          <td>${escapeHtml(item.descripcion)}</td>
          <td>${escapeHtml(item.no_parte)}</td>
          <td>${escapeHtml(item.ubicacion)}</td>
          <td>${escapeHtml(item.solicitante_alta)}</td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="actions">
              <button type="button" data-approve-inventory="${item.id_refaccion}">Aprobar</button>
              <button class="secondary" type="button" data-reject-inventory="${item.id_refaccion}">Rechazar</button>
            </div>
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

function renderOrders() {
  if (state.orders.length === 0) {
    els.orderRows.innerHTML = '<tr><td class="empty" colspan="9">Sin ordenes registradas.</td></tr>';
    return;
  }

  els.orderRows.innerHTML = state.orders
    .map((order) => {
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
          <td>${escapeHtml(order.operador || order.id_operador)}</td>
          <td>${badge(order.estado)}</td>
          <td>${formatDate(order.fecha)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join('');
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
                ? `<button class="secondary" type="button" data-document="${movement.id_movimiento}">Documento</button>`
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
  state.orders = await api('/api/ordenes');
  renderOrders();
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

async function refreshAll() {
  if (!state.user) return;
  await Promise.all([loadInventory(), loadPendingInventory(), loadOrders(), loadMovements(), loadMessages(), loadUsers(), loadReport(), loadStats()]);
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
    const detalles = [...els.detailRows.querySelectorAll('.detail-row')].map((row) => ({
      id_refaccion: Number(row.querySelector('[name="id_refaccion"]').value),
      cantidad: Number(row.querySelector('[name="cantidad"]').value)
    }));

    if (detalles.some((detalle) => !detalle.id_refaccion)) {
      throw new Error('Busca y selecciona una refaccion en cada renglon');
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
  const documentMovementId = event.target.dataset.document;

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

    if (documentMovementId) {
      const documentData = await api(`/api/movimientos/${documentMovementId}/documento`);
      window.alert(JSON.stringify(documentData.contenido, null, 2));
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
  loadOrders().catch((error) => showAlert(error.message, 'error'));
});

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

addDetailRow();
syncOrderTypeFields();
loadSession()
  .then(refreshAll)
  .catch((error) => showAlert(error.message, 'error'));
