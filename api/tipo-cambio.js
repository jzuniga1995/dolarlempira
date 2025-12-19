// api/tipo-cambio.js
// Serverless function para Vercel - Proxy a API del BCH

// ===================================
// CONFIGURACIÓN
// ===================================
const BCH_CONFIG = {
  API_URL: 'https://bchapi-am.azure-api.net/api/v1/indicadores/97/cifras',
  API_KEY: process.env.BCH_API_KEY,
  TIMEOUT: 10000 // 10 segundos
};

// ===================================
// HANDLER PRINCIPAL
// ===================================
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Cache control (1 hora)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  try {
    // Validar que exista la API Key
    if (!BCH_CONFIG.API_KEY) {
      throw new Error('BCH_API_KEY no está configurada en las variables de entorno');
    }

    // Construir URL con parámetros
    const url = new URL(BCH_CONFIG.API_URL);
    url.searchParams.append('reciente', '1');
    url.searchParams.append('formato', 'json');
    url.searchParams.append('ordenamiento', 'desc');

    // Fetch con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BCH_CONFIG.TIMEOUT);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': BCH_CONFIG.API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'DolarLempira.com/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Verificar respuesta HTTP
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BCH API HTTP ${response.status}: ${errorText}`);
    }

    // Parsear JSON
    const data = await response.json();

    // Validar estructura de datos
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid data structure from BCH API');
    }

    // Validar campos requeridos
    const item = data[0];
    if (!item.Valor || !item.Fecha) {
      throw new Error('Missing required fields (Valor or Fecha)');
    }

    // Validar que el valor sea número
    if (typeof item.Valor !== 'number' || item.Valor <= 0) {
      throw new Error('Invalid Valor from BCH API');
    }

    // Log exitoso (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Tipo de cambio obtenido:', {
        valor: item.Valor,
        fecha: item.Fecha
      });
    }

    // Retornar datos con metadata adicional
    return res.status(200).json(data);

  } catch (error) {
    // Log de error (siempre)
    console.error('❌ Error en /api/tipo-cambio:', {
      message: error.message,
      name: error.name,
      timestamp: new Date().toISOString()
    });

    // Determinar código de estado apropiado
    let statusCode = 500;
    let errorMessage = 'Error al obtener tipo de cambio del BCH';

    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'Timeout: BCH API no respondió a tiempo';
    } else if (error.message.includes('fetch failed')) {
      statusCode = 503;
      errorMessage = 'No se pudo conectar con el BCH';
    }

    // Retornar error estructurado
    return res.status(statusCode).json({
      error: errorMessage,
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
      timestamp: new Date().toISOString(),
      status: statusCode
    });
  }
}

// ===================================
// CONFIGURACIÓN DE VERCEL
// ===================================
export const config = {
  runtime: 'edge', // Usar Edge Runtime (más rápido)
  regions: ['iad1'], // US East (más cerca de Honduras)
};