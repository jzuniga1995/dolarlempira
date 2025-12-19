// ===================================
// CONFIGURACIÓN
// ===================================
const CONFIG = {
    API_URL: '/api/tipo-cambio', // Para Vercel
    CACHE_KEY: 'dolarlempira_cache',
    CACHE_DURATION: 3600000, // 1 hora
    DEBUG: false // Cambiar a true solo para desarrollo
};

let tasaCambio = null;
let fechaTasa = null;

// Helper para logs solo en desarrollo
const log = {
    info: (...args) => CONFIG.DEBUG && console.log(...args),
    warn: (...args) => CONFIG.DEBUG && console.warn(...args),
    error: (...args) => console.error(...args) // Errores siempre se muestran
};

// ===================================
// INICIALIZACIÓN
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupEventListeners();
    await cargarTipoCambio();
    generarTablaConversiones();
    actualizarFechaHero();
}

// ===================================
// CARGAR TIPO DE CAMBIO
// ===================================
async function cargarTipoCambio() {
    try {
        mostrarLoading();

        // Intentar cache primero
        const cached = getCache();
        if (cached) {
            tasaCambio = cached.valor;
            fechaTasa = cached.fecha;
            actualizarUI(cached);
            log.info('✅ Usando cache:', cached);
            return;
        }

        // Llamar API
        log.info('🔄 Llamando API...');
        const response = await fetch(CONFIG.API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data && data.length > 0) {
            const resultado = data[0];
            tasaCambio = resultado.Valor;
            fechaTasa = resultado.Fecha;
            
            setCache({
                valor: resultado.Valor,
                fecha: resultado.Fecha
            });
            
            actualizarUI({
                valor: resultado.Valor,
                fecha: resultado.Fecha
            });
            
            log.info('✅ Tipo de cambio cargado:', tasaCambio);
        } else {
            throw new Error('Datos vacíos de la API');
        }

    } catch (error) {
        log.error('❌ Error al cargar tipo de cambio:', error.message);
        manejarError(error);
    }
}

// ===================================
// MANEJO DE ERRORES
// ===================================
function manejarError(error) {
    // Intentar usar cache aunque esté expirado
    const cached = getCacheExpired();
    
    if (cached) {
        tasaCambio = cached.valor;
        fechaTasa = cached.fecha;
        actualizarUI(cached);
        mostrarAdvertencia('Mostrando última tasa conocida');
        log.warn('⚠️ Usando cache expirado');
        return;
    }
    
    // No hay datos disponibles - mostrar error
    mostrarErrorCompleto('No se pudo cargar el tipo de cambio. Por favor, intenta más tarde.');
    log.error('❌ Sin datos disponibles (no hay cache ni conexión)');
}

// ===================================
// CACHE
// ===================================
function setCache(data) {
    try {
        const cacheData = {
            valor: data.valor,
            fecha: data.fecha,
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cacheData));
        log.info('💾 Cache guardado');
    } catch (e) {
        log.error('Error al guardar cache:', e);
    }
}

function getCache() {
    try {
        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            const edad = Date.now() - data.timestamp;
            
            if (edad < CONFIG.CACHE_DURATION) {
                return data;
            }
        }
    } catch (e) {
        log.error('Error al leer cache:', e);
    }
    return null;
}

function getCacheExpired() {
    try {
        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        log.error('Error al leer cache expirado:', e);
    }
    return null;
}

// ===================================
// ACTUALIZAR UI
// ===================================
function actualizarUI(data) {
    const tasaEl = document.getElementById('tasaActual');
    const fechaEl = document.getElementById('fechaActualizacion');
    
    if (tasaEl) {
        tasaEl.textContent = `L ${formatNumber(data.valor)}`;
    }
    
    if (fechaEl) {
        const fecha = new Date(data.fecha);
        const opciones = { 
            weekday: 'long',
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        };
        fechaEl.textContent = fecha.toLocaleDateString('es-HN', opciones);
    }
    
    // Actualizar tabla después de tener la tasa
    if (tasaCambio) {
        generarTablaConversiones();
    }
    
    ocultarLoading();
}

function actualizarFechaHero() {
    const heroFechaEl = document.getElementById('heroFecha');
    if (heroFechaEl) {
        const hoy = new Date();
        const opciones = { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        };
        heroFechaEl.textContent = hoy.toLocaleDateString('es-HN', opciones);
    }
}

function mostrarLoading() {
    const tasaEl = document.getElementById('tasaActual');
    const fechaEl = document.getElementById('fechaActualizacion');
    
    if (tasaEl) tasaEl.textContent = 'L ---.--';
    if (fechaEl) fechaEl.textContent = 'cargando...';
}

function ocultarLoading() {
    // Remover indicadores de carga si los hay
}

function mostrarAdvertencia(mensaje) {
    // Notificación visual discreta
    const tasaCard = document.querySelector('.tasa-card');
    if (tasaCard) {
        // Verificar si ya existe una advertencia
        const existente = tasaCard.querySelector('.aviso-offline');
        if (existente) return;
        
        const aviso = document.createElement('div');
        aviso.className = 'aviso-offline';
        aviso.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(245, 158, 11, 0.9);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            z-index: 10;
        `;
        aviso.textContent = '⚠️ Sin conexión';
        aviso.title = mensaje;
        
        // Remover después de 5 segundos
        setTimeout(() => aviso.remove(), 5000);
        
        tasaCard.style.position = 'relative';
        tasaCard.appendChild(aviso);
    }
}

function mostrarErrorCompleto(mensaje) {
    const tasaEl = document.getElementById('tasaActual');
    const fechaEl = document.getElementById('fechaActualizacion');
    const conversorCard = document.querySelector('.conversor-card');
    
    if (tasaEl) {
        tasaEl.textContent = 'Error';
        tasaEl.style.fontSize = '1.5rem';
    }
    
    if (fechaEl) {
        fechaEl.textContent = 'No disponible';
    }
    
    // Mostrar mensaje en el conversor
    if (conversorCard) {
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            background: #fee2e2;
            border: 1px solid #ef4444;
            color: #991b1b;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 16px;
            font-weight: 600;
        `;
        errorMsg.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>
            <div>${mensaje}</div>
            <div style="font-size: 0.875rem; margin-top: 8px; opacity: 0.8;">
                Verifica tu conexión a internet e intenta recargar la página.
            </div>
        `;
        conversorCard.insertBefore(errorMsg, conversorCard.firstChild);
    }
    
    // Deshabilitar inputs
    const inputUSD = document.getElementById('cantidadUSD');
    const inputHNL = document.getElementById('cantidadHNL');
    const btnSwap = document.getElementById('btnInvertir');
    
    if (inputUSD) inputUSD.disabled = true;
    if (inputHNL) inputHNL.disabled = true;
    if (btnSwap) btnSwap.disabled = true;
}

// ===================================
// CONVERSIONES
// ===================================
function usdToHnl(usd) {
    if (!tasaCambio || isNaN(usd)) return 0;
    return usd * tasaCambio;
}

function hnlToUsd(hnl) {
    if (!tasaCambio || isNaN(hnl)) return 0;
    return hnl / tasaCambio;
}

// ===================================
// EVENT LISTENERS
// ===================================
function setupEventListeners() {
    const inputUSD = document.getElementById('cantidadUSD');
    const inputHNL = document.getElementById('cantidadHNL');
    const btnSwap = document.getElementById('btnInvertir');
    
    if (inputUSD) {
        inputUSD.addEventListener('input', (e) => {
            const valor = parseFloat(e.target.value) || 0;
            if (inputHNL && tasaCambio) {
                inputHNL.value = valor > 0 ? formatNumber(usdToHnl(valor)) : '';
            }
        });
        
        // Agregar valor inicial
        inputUSD.value = '100';
        inputUSD.dispatchEvent(new Event('input'));
    }
    
    if (inputHNL) {
        inputHNL.addEventListener('input', (e) => {
            const valorStr = e.target.value.replace(/,/g, '');
            const valor = parseFloat(valorStr) || 0;
            if (inputUSD && tasaCambio) {
                inputUSD.value = valor > 0 ? formatNumber(hnlToUsd(valor), 2) : '';
            }
        });
    }
    
    if (btnSwap) {
        btnSwap.addEventListener('click', () => {
            if (inputUSD && inputHNL) {
                const tempUSD = inputUSD.value;
                const tempHNL = inputHNL.value;
                
                // Intercambiar valores
                inputHNL.value = tempUSD;
                inputUSD.value = tempHNL;
                
                // Trigger conversion desde HNL
                inputHNL.dispatchEvent(new Event('input'));
            }
        });
    }
    
    // Smooth scroll para enlaces internos
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ===================================
// GENERAR TABLA
// ===================================
function generarTablaConversiones() {
    const tbody = document.getElementById('tablaConversionesBody');
    if (!tbody || !tasaCambio) return;
    
    const cantidades = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000];
    
    tbody.innerHTML = '';
    
    cantidades.forEach(cantidad => {
        const hnl = usdToHnl(cantidad);
        const row = document.createElement('div');
        row.className = 'tabla-row';
        row.innerHTML = `
            <div>$${formatNumber(cantidad, 0)}</div>
            <div>L ${formatNumber(hnl, 2)}</div>
        `;
        tbody.appendChild(row);
    });
    
    log.info('✅ Tabla generada con', cantidades.length, 'conversiones');
}

// ===================================
// FORMATEAR NÚMEROS
// ===================================
function formatNumber(num, decimales = 2) {
    if (isNaN(num) || num === null || num === undefined) return '0.00';
    
    return new Intl.NumberFormat('es-HN', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    }).format(num);
}

// ===================================
// AUTO-REFRESH
// ===================================
// Recargar cada 30 minutos
setInterval(() => {
    log.info('🔄 Auto-refresh: Recargando tipo de cambio...');
    cargarTipoCambio();
}, 1800000);

// ===================================
// DETECCIÓN DE VISIBILIDAD
// ===================================
// Recargar cuando la página vuelve a estar visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const cached = getCache();
        if (!cached) {
            log.info('🔄 Página visible: Recargando...');
            cargarTipoCambio();
        }
    }
});