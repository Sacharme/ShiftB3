/**
 * cartography.js — Vue 3: Cartographie
 * 
 * Carte interactive de Lyon avec marqueurs des bâtiments publics
 * Tuiles WMTS depuis data.geopf.fr (IGN / cartes.gouv.fr)
 */

import L from 'leaflet';

let mapInstance = null;
let markersLayer = null;

// Lyon center coordinates
const LYON_CENTER = [45.7578, 4.8320];
const LYON_ZOOM = 13;

// Building type icons
const TYPE_ICONS = {
    'École': '🏫',
    'Piscine': '🏊',
    'Mairie': '🏛️',
    'Bibliothèque': '📚',
    'Gymnase': '🏋️',
    'Crèche': '👶',
};

/**
 * Initialize the cartography module
 */
export function initCartography() {
    // Listen for ETL completion
    window.addEventListener('etl:complete', (e) => {
        // Delay map init to ensure container is visible
        setTimeout(() => {
            if (!mapInstance) {
                createMap();
            }
            addMarkers(e.detail.data);
        }, 100);
    });

    // Fix map size when view becomes visible
    const observer = new MutationObserver(() => {
        const view = document.getElementById('view-cartography');
        if (view.classList.contains('active') && mapInstance) {
            setTimeout(() => mapInstance.invalidateSize(), 50);
        }
    });

    const view = document.getElementById('view-cartography');
    observer.observe(view, { attributes: true, attributeFilter: ['class'] });
}

function createMap() {
    const container = document.getElementById('map-container');

    // Create map
    mapInstance = L.map(container, {
        center: LYON_CENTER,
        zoom: LYON_ZOOM,
        zoomControl: true,
        attributionControl: true,
    });

    // Add IGN WMTS tiles (Plan IGN from data.geopf.fr / cartes.gouv.fr)
    L.tileLayer('https://data.geopf.fr/wmts?' +
        'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
        '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
        '&STYLE=normal' +
        '&FORMAT=image/png' +
        '&TILEMATRIXSET=PM' +
        '&TILEMATRIX={z}' +
        '&TILEROW={y}' +
        '&TILECOL={x}', {
        attribution: '© <a href="https://cartes.gouv.fr" target="_blank">cartes.gouv.fr</a> — IGN',
        maxZoom: 19,
        minZoom: 5,
    }).addTo(mapInstance);

    // Initialize markers layer
    markersLayer = L.layerGroup().addTo(mapInstance);
}

function addMarkers(data) {
    if (!markersLayer) return;

    // Clear existing markers
    markersLayer.clearLayers();

    data.forEach(building => {
        if (!building.latitude || !building.longitude) return;

        // Create custom marker
        const level = building.niveau_conso;
        const icon = TYPE_ICONS[building.type] || '🏢';

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-icon ${level}">${icon}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -22],
        });

        // Create marker
        const marker = L.marker([building.latitude, building.longitude], {
            icon: customIcon,
        });

        // Create popup content
        const popupContent = buildPopup(building);
        marker.bindPopup(popupContent, {
            maxWidth: 280,
            minWidth: 220,
        });

        markersLayer.addLayer(marker);
    });
}

function buildPopup(building) {
    const energyColor = getColor(building.niveau_conso);
    const waterLevel = building.intensite_eau < 0.3 ? 'low' : building.intensite_eau < 0.8 ? 'medium' : 'high';
    const waterColor = getColor(waterLevel);

    return `
    <div class="popup-title">${building.nom}</div>
    <div class="popup-type">${building.type} — ${building.classe_dpe ? 'DPE ' + building.classe_dpe : ''}</div>
    <div class="popup-stats">
      <div class="popup-stat">
        <span class="popup-stat-label">⚡ Électricité</span>
        <span class="popup-stat-value" style="color:${energyColor}">${formatNum(building.electricite_kwh)} kWh</span>
      </div>
      <div class="popup-stat">
        <span class="popup-stat-label">🔥 Gaz</span>
        <span class="popup-stat-value" style="color:${energyColor}">${formatNum(building.gaz_kwh)} kWh</span>
      </div>
      <div class="popup-stat">
        <span class="popup-stat-label">💧 Eau</span>
        <span class="popup-stat-value" style="color:${waterColor}">${formatNum(building.eau_m3)} m³</span>
      </div>
      <div class="popup-stat">
        <span class="popup-stat-label">📐 Surface</span>
        <span class="popup-stat-value">${formatNum(building.surface_m2)} m²</span>
      </div>
      <div class="popup-stat">
        <span class="popup-stat-label">⚡ Intensité</span>
        <span class="popup-stat-value" style="color:${energyColor}">${building.intensite_energetique} kWh/m²</span>
      </div>
    </div>
  `;
}

function getColor(level) {
    switch (level) {
        case 'low': return '#34d399';
        case 'medium': return '#fbbf24';
        case 'high': return '#ef4444';
        default: return '#9ca3af';
    }
}

function formatNum(value) {
    return new Intl.NumberFormat('fr-FR').format(value);
}
