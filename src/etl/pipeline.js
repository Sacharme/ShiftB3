/**
 * pipeline.js — ETL Pipeline (IA Copilot)
 * 
 * Extract → Transform → Load
 * Nettoie, renomme, filtre et type les données brutes avant affichage.
 */

import { RAW_API_RESPONSE } from '../data/rawData.js';

// App state
let processedData = [];
let isProcessing = false;

/**
 * Returns current processed data
 */
export function getData() {
    return processedData;
}

/**
 * Returns processing state
 */
export function isETLProcessing() {
    return isProcessing;
}

/**
 * Run the full ETL pipeline with visual feedback
 */
export async function runETLPipeline(onStepUpdate) {
    if (isProcessing) return processedData;
    isProcessing = true;

    try {
        // Step 1: EXTRACT
        onStepUpdate?.('extract', 'active');
        await delay(600);
        const rawData = extract();
        onStepUpdate?.('extract', 'done');

        // Step 2: TRANSFORM
        onStepUpdate?.('transform', 'active');
        await delay(800);
        const transformedData = transform(rawData);
        onStepUpdate?.('transform', 'done');

        // Step 3: LOAD
        onStepUpdate?.('load', 'active');
        await delay(500);
        processedData = load(transformedData);
        onStepUpdate?.('load', 'done');

        // Dispatch custom event to notify views
        window.dispatchEvent(new CustomEvent('etl:complete', { detail: { data: processedData } }));

        return processedData;
    } finally {
        isProcessing = false;
    }
}

/**
 * EXTRACT — Read raw data from source
 */
function extract() {
    console.log('🔍 [ETL] Extract — Lecture des données brutes API PISTE...');

    // Simulate reading from API
    const raw = JSON.parse(JSON.stringify(RAW_API_RESPONSE.resultats));
    console.log(`   → ${raw.length} enregistrements extraits`);
    return raw;
}

/**
 * TRANSFORM — Clean, rename, filter, type
 */
function transform(rawData) {
    console.log('🔄 [ETL] Transform — Nettoyage & normalisation...');

    const cleaned = rawData
        // 1. Rename fields (French → standardized)
        .map(record => ({
            nom: cleanString(record.nom_batiment),
            type: normalizeType(record.type_infra),
            adresse: cleanString(record.adresse_postale),
            electricite_kwh: toNumber(record.conso_elec_kwh),
            gaz_kwh: toNumber(record.conso_gaz_kwh),
            eau_m3: toNumber(record.conso_eau_m3),
            surface_m2: toNumber(record.surface_m2),
            annee: toNumber(record.annee),
            latitude: toFloat(record.lat),
            longitude: toFloat(record.lng),
            classe_dpe: cleanString(record.dpe_classe),
            occupants: toNumber(record.nb_occupants) || 0,
        }))
        // 2. Filter out invalid entries (need at least name, coordinates, and consumption)
        .filter(r =>
            r.nom &&
            r.latitude && r.longitude &&
            r.electricite_kwh > 0
        )
        // 3. Add computed fields
        .map(record => ({
            ...record,
            energie_totale_kwh: record.electricite_kwh + record.gaz_kwh,
            intensite_energetique: record.surface_m2 > 0
                ? Math.round((record.electricite_kwh + record.gaz_kwh) / record.surface_m2 * 10) / 10
                : 0,
            intensite_eau: record.surface_m2 > 0
                ? Math.round(record.eau_m3 / record.surface_m2 * 100) / 100
                : 0,
            niveau_conso: getConsumptionLevel(record.electricite_kwh + record.gaz_kwh, record.surface_m2),
        }))
        // 4. Sort by total energy consumption (descending)
        .sort((a, b) => b.energie_totale_kwh - a.energie_totale_kwh);

    console.log(`   → ${cleaned.length} enregistrements après nettoyage`);
    return cleaned;
}

/**
 * LOAD — Store processed data
 */
function load(transformedData) {
    console.log('📦 [ETL] Load — Chargement des données traitées...');
    console.log(`   → ${transformedData.length} enregistrements prêts`);
    return transformedData;
}

// ---- Utility functions ----

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanString(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value).trim();
}

function toNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : Math.round(num);
}

function toFloat(value) {
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function normalizeType(type) {
    if (!type) return 'Autre';
    const map = {
        'ECOLE': 'École',
        'PISCINE': 'Piscine',
        'MAIRIE': 'Mairie',
        'BIBLIOTHEQUE': 'Bibliothèque',
        'GYMNASE': 'Gymnase',
        'CRECHE': 'Crèche',
    };
    return map[type.toUpperCase()] || type;
}

function getConsumptionLevel(totalEnergy, surface) {
    if (surface <= 0) return 'medium';
    const intensity = totalEnergy / surface;
    if (intensity < 30) return 'low';
    if (intensity < 60) return 'medium';
    return 'high';
}
