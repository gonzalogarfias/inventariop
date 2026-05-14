const { ipcRenderer } = require('electron');

// Estado global
let currentUser = null;
let productos = [];
let usuarios = [];
let movimientos = [];

// ========== AUTENTICACIÓN ==========

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  if (!email || !password) {
    errorDiv.textContent = 'Por favor ingresa email y contraseña';
    return;
  }

  const result = await ipcRenderer.invoke('login', { email, password });

  if (result.success) {
    currentUser = result.usuario;
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('user-badge').textContent = `${currentUser.nombre} (${currentUser.rol})`;
    
    // Mostrar tab de usuarios solo para admins
    if (currentUser.rol === 'admin') {
      document.getElementById('usuarios-tab').style.display = 'block';
    }

    // Cargar datos iniciales
    await cargarDashboard();
    await cargarProductos();
    await cargarUsuarios();
  } else {
    errorDiv.textContent = result.message;
  }
}

function logout() {
  currentUser = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

// Enter para login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
});

// ========== NAVEGACIÓN ==========

function showSection(sectionName) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  // Mostrar sección seleccionada
  document.getElementById(`${sectionName}-section`).classList.add('active');
  event.target.classList.add('active');

  // Cargar datos según la sección
  switch(sectionName) {
    case 'dashboard':
      cargarDashboard();
      break;
    case 'productos':
      cargarProductos();
      break;
    case 'movimientos':
      cargarMovimientos();
      cargarProductosParaSelect();
      cargarUsuariosParaFiltro();
      break;
    case 'reportes':
      cargarProductosParaReporte();
      cargarReporteUsuarios();
      break;
    case 'usuarios':
      cargarUsuarios();
      break;
  }
}

// ========== DASHBOARD ==========

async function cargarDashboard() {
  const result = await ipcRenderer.invoke('obtener-dashboard');
  
  if (result.success) {
    const { stats, productos_bajo_stock, movimientos_recientes } = result.dashboard;

    // Renderizar estadísticas
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = `
      <div class="stat-card">
        <h4>Total Productos</h4>
        <div class="stat-value">${stats.total_productos}</div>
      </div>
      <div class="stat-card warning">
        <h4>Productos Bajo Stock</h4>
        <div class="stat-value">${stats.productos_bajo_stock}</div>
      </div>
      <div class="stat-card success">
        <h4>Movimientos Hoy</h4>
        <div class="stat-value">${stats.movimientos_hoy}</div>
      </div>
      <div class="stat-card">
        <h4>Items en Inventario</h4>
        <div class="stat-value">${stats.valor_total}</div>
      </div>
    `;

    // Renderizar productos bajo stock
    const tbody = document.querySelector('#productos-bajo-stock-table tbody');
    tbody.innerHTML = productos_bajo_stock.length > 0 
      ? productos_bajo_stock.map(p => `
          <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td><strong>${p.stock_actual}</strong></td>
            <td>${p.stock_minimo}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" style="text-align: center;">✅ Todos los productos tienen stock suficiente</td></tr>';

    // Renderizar movimientos recientes
    const movTbody = document.querySelector('#movimientos-recientes-table tbody');
    movTbody.innerHTML = movimientos_recientes.length > 0
      ? movimientos_recientes.map(m => `
          <tr>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.producto_nombre}</td>
            <td><span class="badge badge-${m.tipo}">${m.tipo}</span></td>
            <td>${m.cantidad}</td>
            <td>${m.usuario_nombre}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" style="text-align: center;">No hay movimientos recientes</td></tr>';
  }
}

// ========== PRODUCTOS ==========

async function cargarProductos() {
  const result = await ipcRenderer.invoke('obtener-productos');
  
  if (result.success) {
    productos = result.productos;
    const tbody = document.querySelector('#productos-table tbody');
    
    tbody.innerHTML = productos.length > 0
      ? productos.map(p => `
          <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td><strong>${p.stock_actual}</strong></td>
            <td>${p.stock_minimo}</td>
            <td>${p.unidad}</td>
            <td>
              <button class="btn-small btn-success" onclick="abrirMovimientoRapido(${p.id})">+ Movimiento</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" style="text-align: center;">No hay productos registrados</td></tr>';
  }
}

async function crearProducto() {
  const codigo = document.getElementById('nuevo-producto-codigo').value;
  const nombre = document.getElementById('nuevo-producto-nombre').value;
  const descripcion = document.getElementById('nuevo-producto-descripcion').value;
  const stock_minimo = parseInt(document.getElementById('nuevo-producto-stock-min').value);
  const unidad = document.getElementById('nuevo-producto-unidad').value;

  if (!codigo || !nombre) {
    alert('Código y nombre son obligatorios');
    return;
  }

  const result = await ipcRenderer.invoke('crear-producto', {
    codigo, nombre, descripcion, stock_minimo, unidad
  });

  if (result.success) {
    closeModal('producto-modal');
    await cargarProductos();
    // Limpiar formulario
    document.getElementById('nuevo-producto-codigo').value = '';
    document.getElementById('nuevo-producto-nombre').value = '';
    document.getElementById('nuevo-producto-descripcion').value = '';
    document.getElementById('nuevo-producto-stock-min').value = '10';
    document.getElementById('nuevo-producto-unidad').value = 'unidad';
    alert('Producto creado exitosamente');
  } else {
    alert('Error: ' + result.message);
  }
}

// ========== MOVIMIENTOS ==========

async function cargarProductosParaSelect() {
  const result = await ipcRenderer.invoke('obtener-productos');
  
  if (result.success) {
    const select = document.getElementById('mov-producto');
    const filterSelect = document.getElementById('filter-producto');
    
    const options = result.productos.map(p => 
      `<option value="${p.id}">${p.codigo} - ${p.nombre} (Stock: ${p.stock_actual})</option>`
    ).join('');
    
    select.innerHTML = '<option value="">Seleccionar producto...</option>' + options;
    filterSelect.innerHTML = '<option value="">Todos los productos</option>' + options;
  }
}

async function cargarUsuariosParaFiltro() {
  const result = await ipcRenderer.invoke('obtener-usuarios');
  
  if (result.success) {
    const select = document.getElementById('filter-usuario');
    const options = result.usuarios.map(u => 
      `<option value="${u.id}">${u.nombre}</option>`
    ).join('');
    
    select.innerHTML = '<option value="">Todos los usuarios</option>' + options;
  }
}

function updateMovimientoForm() {
  const tipo = document.getElementById('mov-tipo').value;
  const label = document.getElementById('mov-cantidad-label');
  
  if (tipo === 'ajuste') {
    label.textContent = 'Nuevo Stock';
  } else {
    label.textContent = 'Cantidad';
  }
}

async function registrarMovimiento() {
  const producto_id = document.getElementById('mov-producto').value;
  const tipo = document.getElementById('mov-tipo').value;
  const cantidad = parseInt(document.getElementById('mov-cantidad').value);
  const motivo = document.getElementById('mov-motivo').value;
  const alertDiv = document.getElementById('movimiento-alert');

  if (!producto_id || !cantidad || cantidad <= 0) {
    alertDiv.innerHTML = '<div class="alert alert-danger">Por favor completa todos los campos correctamente</div>';
    return;
  }

  const result = await ipcRenderer.invoke('registrar-movimiento', {
    producto_id: parseInt(producto_id),
    usuario_id: currentUser.id,
    tipo,
    cantidad,
    motivo
  });

  if (result.success) {
    alertDiv.innerHTML = '<div class="alert alert-success">✅ Movimiento registrado exitosamente. Nuevo stock: ' + result.stock_nuevo + '</div>';
    
    // Limpiar formulario
    document.getElementById('mov-cantidad').value = '';
    document.getElementById('mov-motivo').value = '';
    
    // Recargar datos
    await cargarProductosParaSelect();
    await cargarMovimientos();
    
    setTimeout(() => {
      alertDiv.innerHTML = '';
    }, 3000);
  } else {
    alertDiv.innerHTML = '<div class="alert alert-danger">❌ Error: ' + result.message + '</div>';
  }
}

async function cargarMovimientos(filtros = {}) {
  const result = await ipcRenderer.invoke('obtener-movimientos', filtros);
  
  if (result.success) {
    movimientos = result.movimientos;
    const tbody = document.querySelector('#movimientos-table tbody');
    
    tbody.innerHTML = movimientos.length > 0
      ? movimientos.map(m => `
          <tr>
            <td>${formatearFecha(m.fecha)}</td>
            <td>${m.producto_codigo} - ${m.producto_nombre}</td>
            <td><span class="badge badge-${m.tipo}">${m.tipo}</span></td>
            <td>${m.cantidad}</td>
            <td>${m.stock_anterior}</td>
            <td><strong>${m.stock_nuevo}</strong></td>
            <td>${m.usuario_nombre}</td>
            <td>${m.motivo || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="8" style="text-align: center;">No hay movimientos registrados</td></tr>';
  }
}

function aplicarFiltrosMovimientos() {
  const filtros = {};
  
  const producto_id = document.getElementById('filter-producto').value;
  const tipo = document.getElementById('filter-tipo').value;
  const usuario_id = document.getElementById('filter-usuario').value;
  
  if (producto_id) filtros.producto_id = parseInt(producto_id);
  if (tipo) filtros.tipo = tipo;
  if (usuario_id) filtros.usuario_id = parseInt(usuario_id);
  
  cargarMovimientos(filtros);
}

function abrirMovimientoRapido(productoId) {
  showSection('movimientos');
  document.getElementById('mov-producto').value = productoId;
  document.getElementById('mov-producto').scrollIntoView({ behavior: 'smooth' });
}

// ========== REPORTES ==========

async function cargarProductosParaReporte() {
  const result = await ipcRenderer.invoke('obtener-productos');
  
  if (result.success) {
    const select = document.getElementById('reporte-producto');
    const options = result.productos.map(p => 
      `<option value="${p.id}">${p.codigo} - ${p.nombre}</option>`
    ).join('');
    
    select.innerHTML = '<option value="">Seleccionar producto...</option>' + options;
  }
}

async function cargarReporteUsuarios() {
  const dias = parseInt(document.getElementById('reporte-dias').value);
  const result = await ipcRenderer.invoke('obtener-movimientos-por-usuario', dias);
  
  if (result.success) {
    const tbody = document.querySelector('#reporte-usuarios-table tbody');
    
    tbody.innerHTML = result.movimientos.length > 0
      ? result.movimientos.map(m => `
          <tr>
            <td>${m.nombre}</td>
            <td><strong>${m.total_movimientos}</strong></td>
            <td>${m.entradas}</td>
            <td>${m.salidas}</td>
            <td>${m.ajustes}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" style="text-align: center;">No hay datos en este período</td></tr>';
  }
}

async function cargarHistorialProducto() {
  const producto_id = document.getElementById('reporte-producto').value;
  
  if (!producto_id) {
    document.querySelector('#historial-producto-table tbody').innerHTML = 
      '<tr><td colspan="7" style="text-align: center;">Selecciona un producto</td></tr>';
    return;
  }

  const result = await ipcRenderer.invoke('obtener-movimientos', { producto_id: parseInt(producto_id) });
  
  if (result.success) {
    const tbody = document.querySelector('#historial-producto-table tbody');
    
    tbody.innerHTML = result.movimientos.length > 0
      ? result.movimientos.map(m => `
          <tr>
            <td>${formatearFecha(m.fecha)}</td>
            <td><span class="badge badge-${m.tipo}">${m.tipo}</span></td>
            <td>${m.cantidad}</td>
            <td>${m.stock_anterior}</td>
            <td><strong>${m.stock_nuevo}</strong></td>
            <td>${m.usuario_nombre}</td>
            <td>${m.motivo || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="7" style="text-align: center;">No hay movimientos para este producto</td></tr>';
  }
}

// ========== USUARIOS ==========

async function cargarUsuarios() {
  if (currentUser.rol !== 'admin') return;

  const result = await ipcRenderer.invoke('obtener-usuarios');
  
  if (result.success) {
    usuarios = result.usuarios;
    const tbody = document.querySelector('#usuarios-table tbody');
    
    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td><span class="badge badge-${u.rol}">${u.rol}</span></td>
        <td>${u.activo ? '✅ Activo' : '❌ Inactivo'}</td>
      </tr>
    `).join('');
  }
}

async function crearUsuario() {
  const nombre = document.getElementById('nuevo-usuario-nombre').value;
  const email = document.getElementById('nuevo-usuario-email').value;
  const password = document.getElementById('nuevo-usuario-password').value;
  const rol = document.getElementById('nuevo-usuario-rol').value;

  if (!nombre || !email || !password) {
    alert('Todos los campos son obligatorios');
    return;
  }

  const result = await ipcRenderer.invoke('crear-usuario', {
    nombre, email, password, rol
  });

  if (result.success) {
    closeModal('usuario-modal');
    await cargarUsuarios();
    // Limpiar formulario
    document.getElementById('nuevo-usuario-nombre').value = '';
    document.getElementById('nuevo-usuario-email').value = '';
    document.getElementById('nuevo-usuario-password').value = '';
    alert('Usuario creado exitosamente');
  } else {
    alert('Error: ' + result.message);
  }
}

// ========== MODALES ==========

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Cerrar modal al hacer click fuera
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
}

// ========== UTILIDADES ==========

function formatearFecha(fecha) {
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const año = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  
  return `${dia}/${mes}/${año} ${hora}:${min}`;
}
