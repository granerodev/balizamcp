# baliza16mcp

[![npm version](https://badge.fury.io/js/baliza16mcp.svg)](https://www.npmjs.com/package/baliza16mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![balizame.com](https://img.shields.io/badge/balizame.com-official-orange)](https://balizame.com)

**Servidor MCP oficial de [balizame.com](https://balizame.com) para datos en tiempo real de balizas V16 activas en Espana.**

Conecta Claude y otros LLMs con datos de balizas V16, obteniendo las ubicaciones de vehiculos detenidos/averiados que estan transmitiendo su posicion mediante balizas V16 conectadas.

---

## Caracteristicas

- **Datos en tiempo real**: Actualizacion cada minuto
- **Filtrado inteligente**: Solo muestra incidentes tipo `vehicleObstruction` (balizas V16 activas)
- **Cobertura nacional**: Todas las balizas V16 conectadas en Espana
- **Informacion completa**: Coordenadas GPS, carretera, km, municipio, provincia, severidad
- **Cache inteligente**: Minimiza llamadas al servidor respetando la frecuencia de actualizacion

## Instalacion

### Opcion 1: npx (recomendado)

No necesitas instalar nada, usalo directamente:

```bash
npx baliza16mcp
```

### Opcion 2: Instalacion global

```bash
npm install -g baliza16mcp
```

### Opcion 3: Desde codigo fuente

```bash
git clone https://github.com/granerodev/baliza16mcp.git
cd baliza16mcp
npm install
npm run build
```

## Configuracion en Claude Desktop

Anade a tu archivo de configuracion `claude_desktop_config.json`:

### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Configuracion

```json
{
  "mcpServers": {
    "balizas-v16": {
      "command": "npx",
      "args": ["-y", "baliza16mcp"]
    }
  }
}
```

O si lo instalaste globalmente:

```json
{
  "mcpServers": {
    "balizas-v16": {
      "command": "baliza16mcp"
    }
  }
}
```

**Reinicia Claude Desktop** despues de modificar la configuracion.

## Herramientas disponibles

### `obtener_balizas_activas`

Obtiene las balizas V16 actualmente activas en Espana.

**Parametros** (todos opcionales):

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `provincia` | string | Filtrar por provincia (ej: "Madrid", "Barcelona") |
| `carretera` | string | Filtrar por carretera (ej: "A-1", "AP-7") |
| `severidad` | string | Filtrar por severidad: "baja", "media", "alta", "critica" |
| `limite` | number | Numero maximo de resultados |

**Ejemplo de uso en Claude:**

> "Cuantas balizas V16 hay activas en Madrid ahora mismo?"

**Respuesta:**

```json
{
  "fuente": "balizame.com",
  "actualizadoEn": "2026-01-16T17:00:00.000Z",
  "totalEncontradas": 33,
  "totalEspana": 322,
  "balizas": [
    {
      "id": "v16-8355636",
      "coordenadas": { "lat": 40.416775, "lon": -3.703790 },
      "ubicacion": {
        "nombreCarretera": "A-6",
        "km": 15.2,
        "municipio": "Las Rozas",
        "provincia": "Madrid",
        "comunidadAutonoma": "Madrid"
      },
      "incidente": {
        "tipo": "vehiculo_detenido",
        "severidad": "baja",
        "horaInicio": "2026-01-16T16:45:00.000+01:00"
      }
    }
  ]
}
```

### `estadisticas_balizas`

Obtiene estadisticas agregadas de las balizas V16 activas.

**Ejemplo de uso en Claude:**

> "Dame estadisticas de las balizas V16 activas en Espana"

**Respuesta:**

```json
{
  "estadisticas": {
    "totalBalizasActivas": 322,
    "porProvincia": {
      "Madrid": 33,
      "Valencia": 22,
      "Alicante": 22,
      "A Coruna": 20
    },
    "porSeveridad": {
      "baja": 317,
      "critica": 3,
      "alta": 1,
      "media": 1
    }
  }
}
```

## Recurso MCP

El servidor tambien expone un recurso MCP:

- **URI**: `balizas://activas`
- **Descripcion**: Listado completo de balizas V16 activas en formato JSON

## Que son las balizas V16?

Las **balizas V16** son dispositivos de senalizacion luminosa de emergencia que sustituyen a los triangulos de emergencia en Espana. Las balizas V16 **conectadas** (IoT) transmiten automaticamente su posicion GPS cuando se activan, permitiendo:

- Alertar a otros conductores a traves de sistemas de navegacion
- Mejorar la respuesta de servicios de emergencia
- Reducir el riesgo de atropellos en carretera

> Mas informacion: [balizame.com](https://balizame.com)

## Desarrollo

```bash
# Clonar repositorio
git clone https://github.com/granerodev/baliza16mcp.git
cd baliza16mcp

# Instalar dependencias
npm install

# Desarrollo con hot-reload
npm run dev

# Compilar
npm run build

# Probar con MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Licencia

[MIT](LICENSE) - Libre para uso personal y comercial.

---

**Problemas o sugerencias?** [Abre un issue](https://github.com/granerodev/baliza16mcp/issues)
