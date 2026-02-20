/**
 * visualization.js — Vue 1: Interactive Visualization
 * 
 * Chart.js based interactive charting with side panel configuration.
 */

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let chartInstance = null;
let currentType = 'bar';
let currentData = [];

// Field definitions for select dropdowns
const FIELD_CONFIG = {
    nom: { label: 'Nom du bâtiment', numeric: false },
    type: { label: 'Type d\'infrastructure', numeric: false },
    electricite_kwh: { label: 'Électricité (kWh)', numeric: true },
    gaz_kwh: { label: 'Gaz (kWh)', numeric: true },
    eau_m3: { label: 'Eau (m³)', numeric: true },
    surface_m2: { label: 'Surface (m²)', numeric: true },
    occupants: { label: 'Occupants', numeric: true },
    energie_totale_kwh: { label: 'Énergie Totale (kWh)', numeric: true },
    intensite_energetique: { label: 'Intensité Énergie (kWh/m²)', numeric: true },
    intensite_eau: { label: 'Intensité Eau (m³/m²)', numeric: true },
    classe_dpe: { label: 'Classe DPE', numeric: false },
};

/**
 * Initialize visualization module
 */
export function initVisualization() {
    setupChartTypeGrid();
    setupFormListeners();

    // Listen for ETL completion
    window.addEventListener('etl:complete', (e) => {
        currentData = e.detail.data;
        enableForm();
        updateChart();
    });
}

function setupChartTypeGrid() {
    const grid = document.getElementById('chart-type-grid');
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.chart-type-card');
        if (!card) return;

        grid.querySelectorAll('.chart-type-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentType = card.dataset.type;
        updateChart();
    });
}

function setupFormListeners() {
    const xSelect = document.getElementById('x-axis-data');
    const ySelect = document.getElementById('y-axis-data');
    const xLabel = document.getElementById('x-axis-label');
    const yLabel = document.getElementById('y-axis-label');
    const xColor = document.getElementById('x-axis-color');
    const yColor = document.getElementById('y-axis-color');

    [xSelect, ySelect, xLabel, yLabel].forEach(el => {
        el.addEventListener('change', () => updateChart());
        el.addEventListener('input', () => updateChart());
    });

    xColor.addEventListener('input', (e) => {
        document.getElementById('x-color-hex').textContent = e.target.value;
        updateChart();
    });

    yColor.addEventListener('input', (e) => {
        document.getElementById('y-color-hex').textContent = e.target.value;
        updateChart();
    });
}

function enableForm() {
    const xSelect = document.getElementById('x-axis-data');
    const ySelect = document.getElementById('y-axis-data');

    // Populate selects
    const xOptions = Object.entries(FIELD_CONFIG)
        .map(([key, cfg]) => `<option value="${key}">${cfg.label}</option>`)
        .join('');

    const yOptions = Object.entries(FIELD_CONFIG)
        .filter(([, cfg]) => cfg.numeric)
        .map(([key, cfg]) => `<option value="${key}">${cfg.label}</option>`)
        .join('');

    xSelect.innerHTML = xOptions;
    ySelect.innerHTML = yOptions;

    // Set defaults
    xSelect.value = 'nom';
    ySelect.value = 'energie_totale_kwh';

    // Enable all form elements
    document.querySelectorAll('#data-form select, #data-form input').forEach(el => {
        el.disabled = false;
    });

    // Set default labels
    document.getElementById('x-axis-label').value = 'Bâtiment';
    document.getElementById('y-axis-label').value = 'Énergie Totale (kWh)';
}

function updateChart() {
    if (currentData.length === 0) return;

    const xField = document.getElementById('x-axis-data').value;
    const yField = document.getElementById('y-axis-data').value;
    const xLabel = document.getElementById('x-axis-label').value || xField;
    const yLabel = document.getElementById('y-axis-label').value || yField;
    const xColor = document.getElementById('x-axis-color').value;
    const yColor = document.getElementById('y-axis-color').value;

    if (!xField || !yField) return;

    // Hide placeholder, show canvas
    const placeholder = document.getElementById('chart-placeholder');
    const canvas = document.getElementById('main-chart');
    placeholder.classList.add('hidden');
    canvas.classList.remove('hidden');

    // Prepare data
    let labels = [];
    let values = [];

    const isCategorical = !FIELD_CONFIG[xField].numeric && xField !== 'nom';

    if (isCategorical) {
        // Aggregate data by category
        const groups = currentData.reduce((acc, d) => {
            const key = String(d[xField]);
            if (!acc[key]) acc[key] = 0;
            acc[key] += Number(d[yField]) || 0;
            return acc;
        }, {});

        labels = Object.keys(groups);
        values = Object.values(groups);
    } else {
        // Direct mapping
        labels = currentData.map(d => truncateLabel(String(d[xField])));
        values = currentData.map(d => d[yField]);
    }

    // Generate colors
    const colors = generateColors(xColor, yColor, labels.length);

    // Destroy previous chart
    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    const config = buildChartConfig(currentType, labels, values, xLabel, yLabel, colors);
    chartInstance = new Chart(ctx, config);
}

function buildChartConfig(type, labels, values, xLabel, yLabel, colors) {
    const isAxisChart = ['bar', 'line', 'scatter'].includes(type);

    const dataset = {
        label: yLabel,
        data: type === 'scatter'
            ? values.map((v, i) => ({ x: i, y: v }))
            : values,
        backgroundColor: type === 'line'
            ? colors.bg[0]
            : colors.bg,
        borderColor: type === 'line'
            ? colors.border[0]
            : colors.border,
        borderWidth: type === 'line' ? 3 : 1,
        tension: 0.4,
        fill: type === 'line',
        pointBackgroundColor: colors.border,
        pointRadius: type === 'line' ? 4 : type === 'scatter' ? 6 : 0,
        pointHoverRadius: type === 'scatter' ? 8 : 6,
        borderRadius: type === 'bar' ? 6 : 0,
    };

    return {
        type,
        data: {
            labels,
            datasets: [dataset],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeOutQuart',
            },
            plugins: {
                legend: {
                    display: !isAxisChart,
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 12 },
                        padding: 16,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: 'rgba(55, 65, 81, 0.5)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'Inter' },
                },
            },
            ...(isAxisChart ? {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xLabel,
                            color: '#9ca3af',
                            font: { family: 'Inter', size: 12, weight: '500' },
                        },
                        ticks: {
                            color: '#6b7280',
                            font: { family: 'Inter', size: 11 },
                            maxRotation: 45,
                            minRotation: 0,
                        },
                        grid: { color: 'rgba(55, 65, 81, 0.3)' },
                    },
                    y: {
                        title: {
                            display: true,
                            text: yLabel,
                            color: '#9ca3af',
                            font: { family: 'Inter', size: 12, weight: '500' },
                        },
                        ticks: {
                            color: '#6b7280',
                            font: { family: 'Inter', size: 11 },
                        },
                        grid: { color: 'rgba(55, 65, 81, 0.3)' },
                        beginAtZero: true,
                    },
                },
            } : {}),
        },
    };
}

function generateColors(color1, color2, count) {
    const bg = [];
    const border = [];

    for (let i = 0; i < count; i++) {
        const ratio = count > 1 ? i / (count - 1) : 0;
        const c = interpolateColor(color1, color2, ratio);
        bg.push(c + '99'); // 60% opacity
        border.push(c);
    }

    return { bg, border };
}

function interpolateColor(hex1, hex2, ratio) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function truncateLabel(label, maxLen = 20) {
    return label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
}
