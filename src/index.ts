#!/usr/bin/env node
/**
 * baliza16mcp - Datos en tiempo real de balizas V16 activas en España
 *
 * Servidor MCP oficial de balizame.com
 *
 * @author granero
 * @license MIT
 * @see https://balizame.com
 * @see https://github.com/granerodev/baliza16mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ============= TIPOS =============

type Severidad = "baja" | "media" | "alta" | "crítica";

interface BalizaActiva {
  id: string;
  lat: number;
  lon: number;
  carretera: string;
  nombreCarretera?: string;
  kmInicio?: number;
  direccion?: string;
  municipio: string;
  provincia: string;
  comunidadAutonoma: string;
  descripcion?: string;
  severidad: Severidad;
  tipoIncidente: string;
  subtipoIncidente?: string;
  causa: string;
  horaInicio?: string;
  carrilesAfectados?: number;
  carrilesTotales?: number;
  retrasoSegundos?: number;
  longitudColaMtrs?: number;
}

interface DatosBalizas {
  timestamp: number;
  total: number;
  balizasActivas: BalizaActiva[];
  fuente: string;
  ultimaActualizacion: string;
}

// ============= CONFIGURACIÓN =============

const DATA_SOURCE_URL = "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml";
const CACHE_TTL_MS = 60_000;
const VERSION = "1.0.0";

const VEHICLE_OBSTRUCTION_CAUSES = new Set(["vehicleObstruction", "obstruction"]);

function extractCoordinates(xml: string): { lat: number; lon: number } | null {
  // Buscar latitud y longitud
  const latMatch = xml.match(/<[^:]*:?latitude[^>]*>([^<]+)</i);
  const lonMatch = xml.match(/<[^:]*:?longitude[^>]*>([^<]+)</i);

  if (latMatch && lonMatch) {
    const lat = parseFloat(latMatch[1].trim());
    const lon = parseFloat(lonMatch[1].trim());
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon };
    }
  }
  return null;
}

function mapSeverity(severity: string | null): Severidad {
  if (!severity) return "baja";
  const s = severity.toLowerCase();
  if (s === "highest" || s === "critical") return "crítica";
  if (s === "high" || s === "severe") return "alta";
  if (s === "medium" || s === "moderate") return "media";
  return "baja";
}

function parseSituation(situationXml: string): BalizaActiva | null {
  // Extraer ID
  const idMatch = situationXml.match(/id="([^"]+)"/);
  if (!idMatch) return null;
  const id = idMatch[1];

  // Extraer causa
  const causeMatch = situationXml.match(/<[^:]*:?causeType[^>]*>([^<]+)</i);
  const causa = causeMatch ? causeMatch[1].trim() : null;

  // Solo procesar obstrucciones de vehículos (balizas V16)
  if (!causa || !VEHICLE_OBSTRUCTION_CAUSES.has(causa)) {
    return null;
  }

  // Extraer coordenadas
  const coords = extractCoordinates(situationXml);
  if (!coords) return null;

  // Extraer datos adicionales
  const severityMatch = situationXml.match(/<[^:]*:?overallSeverity[^>]*>([^<]+)</i);
  const roadMatch = situationXml.match(/<[^:]*:?roadNumber[^>]*>([^<]+)</i);
  const roadNameMatch = situationXml.match(/<[^:]*:?roadName[^>]*>([^<]+)</i);
  const kmMatch = situationXml.match(/<[^:]*:?kilometerPoint[^>]*>([^<]+)</i);
  const directionMatch = situationXml.match(/<[^:]*:?tpegDirectionRoad[^>]*>([^<]+)</i);
  const municipalityMatch = situationXml.match(/<[^:]*:?municipality[^>]*>([^<]+)</i);
  const provinceMatch = situationXml.match(/<[^:]*:?province[^>]*>([^<]+)</i);
  const autonomousCommunityMatch = situationXml.match(/<[^:]*:?autonomousCommunity[^>]*>([^<]+)</i);
  const startTimeMatch = situationXml.match(/<[^:]*:?overallStartTime[^>]*>([^<]+)</i);
  const lanesAffectedMatch = situationXml.match(/<[^:]*:?numberOfLanesRestricted[^>]*>([^<]+)</i);
  const lanesTotalMatch = situationXml.match(/<[^:]*:?numberOfLanes[^>]*>([^<]+)</i);
  const delayMatch = situationXml.match(/<[^:]*:?delayTimeValue[^>]*>([^<]+)</i);
  const queueMatch = situationXml.match(/<[^:]*:?queueLengthValue[^>]*>([^<]+)</i);
  const subtypeMatch = situationXml.match(/<[^:]*:?detailedCauseType[^>]*>[\s\S]*?<[^:>]+>([^<]+)</i);

  // Extraer descripción del comentario
  let descripcion: string | undefined;
  const commentMatch = situationXml.match(/<[^:]*:?value[^>]*lang="es"[^>]*>([^<]+)</i) ||
                       situationXml.match(/<[^:]*:?value[^>]*>([^<]+)</i);
  if (commentMatch) {
    descripcion = commentMatch[1].trim().substring(0, 500);
  }

  return {
    id: `v16-${id}`,
    lat: coords.lat,
    lon: coords.lon,
    carretera: roadMatch ? roadMatch[1].trim() : "",
    nombreCarretera: roadNameMatch ? roadNameMatch[1].trim() : undefined,
    kmInicio: kmMatch ? parseFloat(kmMatch[1]) : undefined,
    direccion: directionMatch ? directionMatch[1].trim() : undefined,
    municipio: municipalityMatch ? municipalityMatch[1].trim() : "",
    provincia: provinceMatch ? provinceMatch[1].trim() : "",
    comunidadAutonoma: autonomousCommunityMatch ? autonomousCommunityMatch[1].trim() : "",
    descripcion,
    severidad: mapSeverity(severityMatch ? severityMatch[1] : null),
    tipoIncidente: "vehiculo_detenido",
    subtipoIncidente: subtypeMatch ? subtypeMatch[1].trim() : undefined,
    causa: causa,
    horaInicio: startTimeMatch ? startTimeMatch[1].trim() : undefined,
    carrilesAfectados: lanesAffectedMatch ? parseInt(lanesAffectedMatch[1]) : undefined,
    carrilesTotales: lanesTotalMatch ? parseInt(lanesTotalMatch[1]) : undefined,
    retrasoSegundos: delayMatch ? parseInt(delayMatch[1]) : undefined,
    longitudColaMtrs: queueMatch ? parseInt(queueMatch[1]) : undefined,
  };
}

function parseDatex2(xml: string): BalizaActiva[] {
  const balizas: BalizaActiva[] = [];

  // Buscar todas las situaciones
  const situationRegex = /<[^:]*:?situation\s+[^>]*id="[^"]+">[\s\S]*?<\/[^:]*:?situation>/gi;
  let match;

  while ((match = situationRegex.exec(xml)) !== null) {
    const baliza = parseSituation(match[0]);
    if (baliza) {
      balizas.push(baliza);
    }
  }

  return balizas;
}

// ============= CACHE Y DATOS =============

let cachedData: DatosBalizas | null = null;
let cacheTimestamp = 0;

async function obtenerBalizasActivas(): Promise<DatosBalizas> {
  const now = Date.now();

  // Usar caché si es válida
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedData;
  }

  try {
    const response = await fetch(DATA_SOURCE_URL, {
      headers: {
        "User-Agent": `baliza16mcp/${VERSION} (+https://balizame.com)`,
        "Accept": "application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate", // Solicitar compresión
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const balizas = parseDatex2(xml);

    cachedData = {
      timestamp: now,
      total: balizas.length,
      balizasActivas: balizas,
      fuente: "balizame.com",
      ultimaActualizacion: new Date().toISOString(),
    };
    cacheTimestamp = now;

    return cachedData;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    console.error(`[MCP Balizas V16] Error obteniendo datos: ${errorMsg}`);

    // Devolver caché antigua si existe, o datos vacíos
    if (cachedData) {
      return {
        ...cachedData,
        fuente: `balizame.com (caché: ${errorMsg})`,
      };
    }

    return {
      timestamp: now,
      total: 0,
      balizasActivas: [],
      fuente: `balizame.com (error: ${errorMsg})`,
      ultimaActualizacion: new Date().toISOString(),
    };
  }
}

// ============= SERVIDOR MCP =============

const server = new Server(
  {
    name: "baliza16mcp",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "obtener_balizas_activas",
        description: "Obtiene en TIEMPO REAL las balizas V16 actualmente activas en España. Devuelve las ubicaciones de vehículos detenidos/averiados que han activado su baliza V16. Incluye coordenadas GPS, carretera, km, municipio, provincia y tiempo de activación.",
        inputSchema: {
          type: "object",
          properties: {
            provincia: {
              type: "string",
              description: "Filtrar por provincia (ej: 'Madrid', 'Barcelona')",
            },
            carretera: {
              type: "string",
              description: "Filtrar por carretera (ej: 'A-1', 'AP-7')",
            },
            severidad: {
              type: "string",
              enum: ["baja", "media", "alta", "crítica"],
              description: "Filtrar por severidad del incidente",
            },
            limite: {
              type: "number",
              description: "Número máximo de resultados",
            },
          },
        },
      },
      {
        name: "estadisticas_balizas",
        description: "Obtiene estadísticas de las balizas V16 activas: total por provincia, por carretera y distribución por severidad.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "obtener_balizas_activas") {
    const datos = await obtenerBalizasActivas();
    let balizas = [...datos.balizasActivas];

    // Aplicar filtros
    if (args?.provincia) {
      const busqueda = (args.provincia as string).toLowerCase();
      balizas = balizas.filter(b => b.provincia.toLowerCase().includes(busqueda));
    }

    if (args?.carretera) {
      const busqueda = (args.carretera as string).toLowerCase();
      balizas = balizas.filter(b => b.carretera.toLowerCase().includes(busqueda));
    }

    if (args?.severidad) {
      balizas = balizas.filter(b => b.severidad === args.severidad);
    }

    if (args?.limite && typeof args.limite === "number") {
      balizas = balizas.slice(0, args.limite);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            fuente: datos.fuente,
            actualizadoEn: datos.ultimaActualizacion,
            nota: "Datos en tiempo real de vehículos detenidos/averiados con baliza V16 activa",
            totalEncontradas: balizas.length,
            totalEspana: datos.total,
            balizas: balizas.map(b => ({
              id: b.id,
              coordenadas: { lat: b.lat, lon: b.lon },
              ubicacion: {
                carretera: b.carretera,
                nombreCarretera: b.nombreCarretera,
                km: b.kmInicio,
                direccion: b.direccion,
                municipio: b.municipio,
                provincia: b.provincia,
                comunidadAutonoma: b.comunidadAutonoma,
              },
              incidente: {
                tipo: b.tipoIncidente,
                subtipo: b.subtipoIncidente,
                severidad: b.severidad,
                descripcion: b.descripcion,
                horaInicio: b.horaInicio,
              },
              trafico: {
                carrilesAfectados: b.carrilesAfectados,
                carrilesTotales: b.carrilesTotales,
                retrasoSegundos: b.retrasoSegundos,
                longitudColaMtrs: b.longitudColaMtrs,
              },
            })),
          }, null, 2),
        },
      ],
    };
  }

  if (name === "estadisticas_balizas") {
    const datos = await obtenerBalizasActivas();

    // Contar por provincia
    const porProvincia: Record<string, number> = {};
    const porCarretera: Record<string, number> = {};
    const porSeveridad: Record<string, number> = {};

    for (const b of datos.balizasActivas) {
      if (b.provincia) {
        porProvincia[b.provincia] = (porProvincia[b.provincia] || 0) + 1;
      }
      if (b.carretera) {
        porCarretera[b.carretera] = (porCarretera[b.carretera] || 0) + 1;
      }
      porSeveridad[b.severidad] = (porSeveridad[b.severidad] || 0) + 1;
    }

    // Ordenar por cantidad descendente
    const ordenarDesc = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            fuente: datos.fuente,
            actualizadoEn: datos.ultimaActualizacion,
            estadisticas: {
              totalBalizasActivas: datos.total,
              porProvincia: ordenarDesc(porProvincia),
              porCarretera: ordenarDesc(porCarretera),
              porSeveridad: ordenarDesc(porSeveridad),
            },
          }, null, 2),
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: `Herramienta desconocida: ${name}` }],
    isError: true,
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "balizas://activas",
        name: "Balizas V16 activas en tiempo real",
        description: "Listado de vehículos detenidos/averiados con baliza V16 activa",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "balizas://activas") {
    const datos = await obtenerBalizasActivas();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            fuente: datos.fuente,
            actualizadoEn: datos.ultimaActualizacion,
            total: datos.total,
            balizas: datos.balizasActivas,
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Recurso no encontrado: ${uri}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`baliza16mcp v${VERSION} - https://balizame.com`);
}

main().catch(console.error);
