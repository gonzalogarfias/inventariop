const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

let mainWindow;
let db;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'inventario.db');
  db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin', 'supervisor', 'almacenista')),
      activo INTEGER DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      stock_actual INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 10,
      unidad TEXT DEFAULT 'unidad',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'ajuste')),
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_nuevo INTEGER NOT NULL,
      motivo TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos(producto_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
  `);

  const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@inventario.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)').run(
      'Administrador',
      'admin@inventario.com',
      hash,
      'admin'
    );
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools(); 
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});


ipcMain.handle('login', async (event, { email, password }) => {
  try {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);
    
    if (!usuario) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const validPassword = bcrypt.compareSync(password, usuario.password_hash);
    
    if (!validPassword) {
      return { success: false, message: 'Contraseña incorrecta' };
    }

    return {
      success: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});


ipcMain.handle('crear-usuario', async (event, { nombre, email, password, rol }) => {
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)'
    ).run(nombre, email, hash, rol);
    
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('obtener-usuarios', async () => {
  try {
    const usuarios = db.prepare('SELECT id, nombre, email, rol, activo FROM usuarios').all();
    return { success: true, usuarios };
  } catch (error) {
    return { success: false, message: error.message };
  }
});


ipcMain.handle('crear-producto', async (event, { codigo, nombre, descripcion, stock_minimo, unidad }) => {
  try {
    const result = db.prepare(
      'INSERT INTO productos (codigo, nombre, descripcion, stock_minimo, unidad) VALUES (?, ?, ?, ?, ?)'
    ).run(codigo, nombre, descripcion, stock_minimo, unidad);
    
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('obtener-productos', async () => {
  try {
    const productos = db.prepare('SELECT * FROM productos ORDER BY nombre').all();
    return { success: true, productos };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('obtener-producto', async (event, id) => {
  try {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    return { success: true, producto };
  } catch (error) {
    return { success: false, message: error.message };
  }
});


ipcMain.handle('registrar-movimiento', async (event, { producto_id, usuario_id, tipo, cantidad, motivo }) => {
  try {
=    const transaction = db.transaction(() => {
      const producto = db.prepare('SELECT stock_actual FROM productos WHERE id = ?').get(producto_id);
      const stock_anterior = producto.stock_actual;
      let stock_nuevo;

      switch (tipo) {
        case 'entrada':
          stock_nuevo = stock_anterior + cantidad;
          break;
        case 'salida':
          if (stock_anterior < cantidad) {
            throw new Error('Stock insuficiente');
          }
          stock_nuevo = stock_anterior - cantidad;
          break;
        case 'ajuste':
          stock_nuevo = cantidad; 
          break;
      }

      db.prepare(
        'INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(producto_id, usuario_id, tipo, Math.abs(cantidad), stock_anterior, stock_nuevo, motivo);

      db.prepare('UPDATE productos SET stock_actual = ? WHERE id = ?').run(stock_nuevo, producto_id);

      return stock_nuevo;
    });

    const nuevoStock = transaction();
    return { success: true, stock_nuevo: nuevoStock };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('obtener-movimientos', async (event, filtros = {}) => {
  try {
    let query = `
      SELECT 
        m.*,
        p.nombre as producto_nombre,
        p.codigo as producto_codigo,
        u.nombre as usuario_nombre
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      JOIN usuarios u ON m.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.producto_id) {
      query += ' AND m.producto_id = ?';
      params.push(filtros.producto_id);
    }

    if (filtros.usuario_id) {
      query += ' AND m.usuario_id = ?';
      params.push(filtros.usuario_id);
    }

    if (filtros.tipo) {
      query += ' AND m.tipo = ?';
      params.push(filtros.tipo);
    }

    if (filtros.fecha_inicio) {
      query += ' AND m.fecha >= ?';
      params.push(filtros.fecha_inicio);
    }

    if (filtros.fecha_fin) {
      query += ' AND m.fecha <= ?';
      params.push(filtros.fecha_fin);
    }

    query += ' ORDER BY m.fecha DESC LIMIT 1000';

    const movimientos = db.prepare(query).all(...params);
    return { success: true, movimientos };
  } catch (error) {
    return { success: false, message: error.message };
  }
});


ipcMain.handle('obtener-dashboard', async () => {
  try {
    const stats = {
      total_productos: db.prepare('SELECT COUNT(*) as count FROM productos').get().count,
      productos_bajo_stock: db.prepare('SELECT COUNT(*) as count FROM productos WHERE stock_actual <= stock_minimo').get().count,
      movimientos_hoy: db.prepare('SELECT COUNT(*) as count FROM movimientos WHERE DATE(fecha) = DATE("now")').get().count,
      valor_total: db.prepare('SELECT SUM(stock_actual) as total FROM productos').get().total || 0
    };

    const productos_bajo_stock = db.prepare(`
      SELECT id, codigo, nombre, stock_actual, stock_minimo 
      FROM productos 
      WHERE stock_actual <= stock_minimo 
      ORDER BY stock_actual ASC
      LIMIT 10
    `).all();

    const movimientos_recientes = db.prepare(`
      SELECT 
        m.*,
        p.nombre as producto_nombre,
        u.nombre as usuario_nombre
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      JOIN usuarios u ON m.usuario_id = u.id
      ORDER BY m.fecha DESC
      LIMIT 10
    `).all();

    return { 
      success: true, 
      dashboard: {
        stats,
        productos_bajo_stock,
        movimientos_recientes
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('obtener-movimientos-por-usuario', async (event, dias = 30) => {
  try {
    const movimientos = db.prepare(`
      SELECT 
        u.nombre,
        COUNT(*) as total_movimientos,
        SUM(CASE WHEN m.tipo = 'entrada' THEN 1 ELSE 0 END) as entradas,
        SUM(CASE WHEN m.tipo = 'salida' THEN 1 ELSE 0 END) as salidas,
        SUM(CASE WHEN m.tipo = 'ajuste' THEN 1 ELSE 0 END) as ajustes
      FROM movimientos m
      JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.fecha >= datetime('now', '-' || ? || ' days')
      GROUP BY u.id, u.nombre
      ORDER BY total_movimientos DESC
    `).all(dias);

    return { success: true, movimientos };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
