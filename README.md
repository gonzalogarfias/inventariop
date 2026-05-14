# 📦 Sistema de Inventario con Trazabilidad

Sistema de escritorio completo para gestión de inventario con seguimiento de usuarios y roles diferenciados.

## 🚀 Características

### ✅ Implementadas
- **Autenticación de usuarios** con roles (Admin, Supervisor, Almacenista)
- **Gestión de productos** (crear, listar, ver stock)
- **Movimientos de inventario**:
  - ✅ Entradas de productos
  - ✅ Salidas de productos
  - ✅ Ajustes manuales de stock
- **Trazabilidad completa**: Cada movimiento guarda quién lo hizo, cuándo y por qué
- **Reportes**:
  - ✅ Dashboard con estadísticas generales
  - ✅ Historial completo por producto
  - ✅ Movimientos por usuario
  - ✅ Alertas de stock bajo
- **Permisos diferenciados**:
  - Admin: acceso completo + gestión de usuarios
  - Supervisor: gestión de inventario completa
  - Almacenista: registro de movimientos

## 📋 Requisitos

- Node.js 16 o superior
- npm o yarn

## 🔧 Instalación

1. **Navega a la carpeta del proyecto**:
```bash
cd inventario-app
```

2. **Instala las dependencias**:
```bash
npm install
```

3. **Inicia la aplicación**:
```bash
npm start
```

## 👤 Usuario por Defecto

Al iniciar por primera vez, se crea automáticamente un usuario administrador:

- **Email**: `admin@inventario.com`
- **Contraseña**: `admin123`

⚠️ **IMPORTANTE**: Cambia esta contraseña después del primer inicio de sesión.

## 📊 Estructura de la Base de Datos

La base de datos SQLite se crea automáticamente en:
- **Windows**: `C:\Users\[TuUsuario]\AppData\Roaming\inventario-app\inventario.db`
- **macOS**: `~/Library/Application Support/inventario-app/inventario.db`
- **Linux**: `~/.config/inventario-app/inventario.db`

### Tablas:
- `usuarios`: Gestión de usuarios y roles
- `productos`: Catálogo de productos
- `movimientos`: Registro completo de todas las transacciones

## 🎯 Uso

### 1. Crear Productos
1. Ir a la pestaña "Productos"
2. Clic en "+ Nuevo Producto"
3. Completar formulario (código, nombre, stock mínimo, etc.)

### 2. Registrar Movimientos
1. Ir a la pestaña "Movimientos"
2. Seleccionar producto y tipo de movimiento
3. Ingresar cantidad y motivo
4. Clic en "Registrar Movimiento"

**Tipos de movimiento**:
- **Entrada**: Suma al stock actual
- **Salida**: Resta del stock actual (valida que haya suficiente)
- **Ajuste**: Establece un nuevo stock directamente

### 3. Ver Reportes
- **Dashboard**: Vista general con alertas y movimientos recientes
- **Historial por Producto**: Todos los movimientos de un producto específico
- **Movimientos por Usuario**: Actividad de cada usuario en un período

### 4. Gestionar Usuarios (Solo Admin)
1. Ir a la pestaña "Usuarios"
2. Clic en "+ Nuevo Usuario"
3. Asignar nombre, email, contraseña y rol

## 🔐 Roles y Permisos

| Función | Almacenista | Supervisor | Admin |
|---------|-------------|------------|-------|
| Ver productos | ✅ | ✅ | ✅ |
| Crear productos | ❌ | ✅ | ✅ |
| Registrar entradas | ✅ | ✅ | ✅ |
| Registrar salidas | ✅ | ✅ | ✅ |
| Ajustes de stock | ❌ | ✅ | ✅ |
| Ver reportes | ✅ | ✅ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ✅ |

## 📦 Compilar para Distribución

Para crear ejecutables para diferentes plataformas:

1. **Instala electron-builder**:
```bash
npm install --save-dev electron-builder
```

2. **Agrega scripts al package.json**:
```json
"scripts": {
  "start": "electron .",
  "build": "electron-builder",
  "build:win": "electron-builder --win",
  "build:mac": "electron-builder --mac",
  "build:linux": "electron-builder --linux"
}
```

3. **Compila**:
```bash
npm run build:win   # Para Windows
npm run build:mac   # Para macOS
npm run build:linux # Para Linux
```

Los ejecutables se generarán en la carpeta `dist/`.

## 🛠️ Tecnologías Utilizadas

- **Electron**: Framework para aplicaciones de escritorio
- **SQLite** (better-sqlite3): Base de datos local
- **bcrypt**: Encriptación de contraseñas
- **HTML/CSS/JavaScript**: Interfaz de usuario

## 📝 Notas Importantes

1. **Backup**: La base de datos es un archivo SQLite. Realiza copias de seguridad periódicas.
2. **Seguridad**: Las contraseñas se almacenan hasheadas con bcrypt.
3. **Auditoría**: Todos los movimientos quedan registrados de forma permanente.
4. **Validaciones**: El sistema valida stock suficiente antes de salidas.

## 🐛 Solución de Problemas

**Error al instalar better-sqlite3**:
- Asegúrate de tener Python y build tools instalados
- Windows: `npm install --global windows-build-tools`
- macOS: Xcode Command Line Tools
- Linux: `build-essential`

**La app no inicia**:
- Verifica que Node.js esté instalado: `node --version`
- Reinstala dependencias: `rm -rf node_modules && npm install`

## 📧 Soporte

Para reportar problemas o sugerencias, crea un issue en el repositorio del proyecto.

## 📄 Licencia

MIT License - Uso libre para proyectos personales y comerciales.
