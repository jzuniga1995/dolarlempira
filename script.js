// ===================================
// CONFIGURACIÓN
// ===================================
const CONFIG = {
    API_URL: '/api/tipo-cambio',
    CACHE_KEY: 'dolarlempira_cache',
    CACHE_DURATION: 3600000, // 1 hora
    DEBUG: false
};

let tasaCambio = null;
let fechaTasa = null;

// Helper para logs
const log = {
    info: (...args) => CONFIG.DEBUG && console.log(...args),
    warn: (...args) => CONFIG.DEBUG && console.warn(...args),
    error: (...args) => console.error(...args)
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
    
    // ✅ Establecer valor inicial DESPUÉS de cargar la tasa
    inicializarConversor();
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
    const cached = getCacheExpired();
    
    if (cached) {
        tasaCambio = cached.valor;
        fechaTasa = cached.fecha;
        actualizarUI(cached);
        mostrarAdvertencia('Mostrando última tasa conocida');
        log.warn('⚠️ Usando cache expirado');
        return;
    }
    
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
        tasaEl.textContent = `L ${formatNumber(data.valor, 2)}`;
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
    
    // Actualizar tabla y conversor después de tener la tasa
    if (tasaCambio) {
        generarTablaConversiones();
        inicializarConversor();
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
    const tasaCard = document.querySelector('.tasa-card');
    if (tasaCard) {
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
// INICIALIZAR CONVERSOR
// ===================================
function inicializarConversor() {
    const inputUSD = document.getElementById('cantidadUSD');
    const inputHNL = document.getElementById('cantidadHNL');
    
    if (inputUSD && inputHNL && tasaCambio) {
        // Establecer valor inicial de 100 USD
        inputUSD.value = '100';
        const hnl = usdToHnl(100);
        inputHNL.value = formatNumber(hnl, 2);
        log.info('✅ Conversor inicializado con $100');
    }
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
            // Remover formato para obtener valor numérico
            const valorStr = e.target.value.replace(/,/g, '');
            const valor = parseFloat(valorStr) || 0;
            
            if (inputHNL && tasaCambio) {
                if (valor > 0) {
                    const hnl = usdToHnl(valor);
                    inputHNL.value = formatNumber(hnl, 2);
                } else {
                    inputHNL.value = '';
                }
            }
        });
    }
    
    if (inputHNL) {
        inputHNL.addEventListener('input', (e) => {
            // Remover formato para obtener valor numérico
            const valorStr = e.target.value.replace(/,/g, '');
            const valor = parseFloat(valorStr) || 0;
            
            if (inputUSD && tasaCambio) {
                if (valor > 0) {
                    const usd = hnlToUsd(valor);
                    inputUSD.value = formatNumber(usd, 2);
                } else {
                    inputUSD.value = '';
                }
            }
        });
    }
    
    if (btnSwap) {
        btnSwap.addEventListener('click', () => {
            if (inputUSD && inputHNL && tasaCambio) {
                // Obtener valores sin formato
                const valorUSD = parseFloat(inputUSD.value.replace(/,/g, '')) || 0;
                const valorHNL = parseFloat(inputHNL.value.replace(/,/g, '')) || 0;
                
                if (valorUSD > 0 || valorHNL > 0) {
                    // Intercambiar: el valor de HNL pasa a USD y se recalcula
                    inputUSD.value = formatNumber(valorHNL, 2);
                    const nuevoHNL = usdToHnl(valorHNL);
                    inputHNL.value = formatNumber(nuevoHNL, 2);
                }
            }
        });
    }
    
    // Smooth scroll
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
setInterval(() => {
    log.info('🔄 Auto-refresh: Recargando tipo de cambio...');
    cargarTipoCambio();
}, 1800000); // 30 minutos

// ===================================
// DETECCIÓN DE VISIBILIDAD
// ===================================
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const cached = getCache();
        if (!cached) {
            log.info('🔄 Página visible: Recargando...');
            cargarTipoCambio();
        }
    }
});