// api/tipo-cambio.js
// Serverless function para Vercel Edge Runtime

const BCH_CONFIG = {
  API_URL: 'https://bchapi-am.azure-api.net/api/v1/indicadores/97/cifras',
  API_KEY: process.env.BCH_API_KEY,
  TIMEOUT: 10000
};

export default async function handler(req) {
  // Solo permitir GET
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        allowedMethods: ['GET']
      }), 
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    // Validar API Key
    if (!BCH_CONFIG.API_KEY) {
      throw new Error('BCH_API_KEY no está configurada');
    }

    // Construir URL
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BCH API HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Validar datos
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid data structure from BCH API');
    }

    const item = data[0];
    if (!item.Valor || !item.Fecha) {
      throw new Error('Missing required fields');
    }

    if (typeof item.Valor !== 'number' || item.Valor <= 0) {
      throw new Error('Invalid Valor');
    }

    // Retornar respuesta exitosa
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate'
      }
    });

  } catch (error) {
    console.error('❌ Error en /api/tipo-cambio:', error.message);

    let statusCode = 500;
    let errorMessage = 'Error al obtener tipo de cambio del BCH';

    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'Timeout: BCH API no respondió';
    } else if (error.message.includes('fetch failed')) {
      statusCode = 503;
      errorMessage = 'No se pudo conectar con el BCH';
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error.message,
        timestamp: new Date().toISOString(),
        status: statusCode
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

export const config = {
  runtime: 'edge',
  regions: ['iad1']
};