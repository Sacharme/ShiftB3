/**
 * dataTable.js — Vue 2: Data Table
 * 
 * Sortable, searchable table of processed data.
 */

let tableData = [];
let sortField = null;
let sortDirection = 'asc';
let searchTerm = '';
let columnFilters = {}; // { field: value }

const COLUMN_CONFIG = [
    { key: 'nom', label: 'Bâtiment', type: 'text', filter: 'text' },
    { key: 'type', label: 'Type', type: 'badge', filter: 'select' },
    { key: 'electricite_kwh', label: 'Électricité (kWh)', type: 'number', filter: 'number' },
    { key: 'gaz_kwh', label: 'Gaz (kWh)', type: 'number', filter: 'number' },
    { key: 'eau_m3', label: 'Eau (m³)', type: 'number', filter: 'number' },
    { key: 'energie_totale_kwh', label: 'Énergie Totale (kWh)', type: 'number', filter: 'number' },
    { key: 'surface_m2', label: 'Surface (m²)', type: 'number', filter: 'number' },
    { key: 'intensite_energetique', label: 'Intensité (kWh/m²)', type: 'intensity', filter: 'number' },
    { key: 'classe_dpe', label: 'DPE', type: 'text', filter: 'select' },
    { key: 'occupants', label: 'Occupants', type: 'number', filter: 'number' },
];

/**
 * Initialize data table module
 */
export function initDataTable() {
    const searchInput = document.getElementById('table-search');
    const exportBtn = document.getElementById('btn-export');

    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderTable();
    });

    exportBtn.addEventListener('click', () => {
        downloadCSV();
    });

    // Listen for ETL completion
    window.addEventListener('etl:complete', (e) => {
        tableData = e.detail.data;
        // Reset filters when data changes? Or keep them? 
        // Let's reset for now to ensure consistency.
        columnFilters = {};
        renderTable();
    });
}

function renderTable() {
    const container = document.getElementById('table-container');
    const countEl = document.getElementById('record-count');

    if (tableData.length === 0) {
        container.innerHTML = '<div class="table-placeholder"><p>Lancez le pipeline ETL pour afficher les données</p></div>';
        countEl.textContent = '0 enregistrements';
        return;
    }

    // Filter
    let filtered = tableData;

    // Global search
    if (searchTerm) {
        filtered = filtered.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(searchTerm)
            )
        );
    }

    // Column specific filtering
    Object.entries(columnFilters).forEach(([field, value]) => {
        if (!value || value === 'all') return;

        filtered = filtered.filter(row => {
            const cellValue = String(row[field]).toLowerCase();
            const filterValue = String(value).toLowerCase();

            // For select fields, we want exact match (mostly)
            const config = COLUMN_CONFIG.find(c => c.key === field);
            if (config && config.filter === 'select') {
                return cellValue === filterValue;
            }

            // For others, include
            return cellValue.includes(filterValue);
        });
    });

    // Sort
    if (sortField) {
        filtered = [...filtered].sort((a, b) => {
            const va = a[sortField];
            const vb = b[sortField];

            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDirection === 'asc' ? va - vb : vb - va;
            }

            return sortDirection === 'asc'
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
    }

    countEl.textContent = `${filtered.length} enregistrement${filtered.length > 1 ? 's' : ''}`;

    // Build table HTML
    // Row 1: Headers with Sorting
    const theadSort = COLUMN_CONFIG.map(col => {
        const isSorted = sortField === col.key;
        const arrow = isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '↕';
        return `<th data-field="${col.key}" class="${isSorted ? 'sorted' : ''}">
      <div class="th-content">
        <span>${col.label}</span>
        <span class="sort-indicator">${arrow}</span>
      </div>
    </th>`;
    }).join('');

    // Row 2: Filter inputs
    const theadFilter = COLUMN_CONFIG.map(col => {
        return `<th class="filter-cell">
      ${renderFilterInput(col)}
    </th>`;
    }).join('');

    const tbody = filtered.map(row => {
        const cells = COLUMN_CONFIG.map(col => {
            const value = row[col.key];
            switch (col.type) {
                case 'badge':
                    return `<td><span class="badge badge-${getBadgeClass(value)}">${value}</span></td>`;
                case 'number':
                    return `<td>${formatNumber(value)}</td>`;
                case 'intensity':
                    return `<td class="${getIntensityClass(value)}">${value}</td>`;
                default:
                    return `<td>${value}</td>`;
            }
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>${theadSort}</tr>
        <tr class="filter-row">${theadFilter}</tr>
      </thead>
      <tbody>${tbody}</tbody>
    </table>
  `;

    // Attach sort listeners
    container.querySelectorAll('th[data-field]').forEach(th => {
        th.addEventListener('click', (e) => {
            // Don't sort if clicked on filter input
            if (e.target.closest('.header-filter')) return;

            const field = th.dataset.field;
            if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDirection = 'asc';
            }
            renderTable();
        });
    });

    // Attach filter listeners
    container.querySelectorAll('.header-filter').forEach(input => {
        input.addEventListener('input', (e) => {
            const field = e.target.dataset.field;
            columnFilters[field] = e.target.value;
            renderTable();
        });
        // Prevent sorting when clicking selects or inputs
        input.addEventListener('click', (e) => e.stopPropagation());
    });
}

function renderFilterInput(col) {
    const value = columnFilters[col.key] || '';

    if (col.filter === 'select') {
        let options = [];
        if (col.key === 'type') {
            options = [...new Set(tableData.map(d => d.type))].sort();
        } else if (col.key === 'classe_dpe') {
            options = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        }

        return `
      <select class="header-filter" data-field="${col.key}">
        <option value="all">Tous</option>
        ${options.map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    `;
    }

    return `
    <input type="text" 
           class="header-filter" 
           data-field="${col.key}" 
           placeholder="Filtrer..." 
           value="${value}" />
  `;
}

function downloadCSV() {
    if (tableData.length === 0) return;

    // Use currently visible data (applying all filters)
    // The same logic as in renderTable but returning the array
    let filtered = tableData;

    if (searchTerm) {
        filtered = filtered.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(searchTerm)
            )
        );
    }

    Object.entries(columnFilters).forEach(([field, value]) => {
        if (!value || value === 'all') return;
        filtered = filtered.filter(row => {
            const cellValue = String(row[field]).toLowerCase();
            const filterValue = String(value).toLowerCase();
            const config = COLUMN_CONFIG.find(c => c.key === field);
            if (config && config.filter === 'select') return cellValue === filterValue;
            return cellValue.includes(filterValue);
        });
    });

    if (sortField) {
        filtered = [...filtered].sort((a, b) => {
            const va = a[sortField];
            const vb = b[sortField];
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDirection === 'asc' ? va - vb : vb - va;
            }
            return sortDirection === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
    }

    const headers = COLUMN_CONFIG.map(col => col.label).join(';');
    const rows = filtered.map(row => {
        return COLUMN_CONFIG.map(col => {
            let val = row[col.key];
            if (val === null || val === undefined) return '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(';');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `E-Copilot_Export_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function getBadgeClass(type) {
    const map = {
        'École': 'ecole',
        'Piscine': 'piscine',
        'Mairie': 'mairie',
        'Bibliothèque': 'bibliotheque',
        'Gymnase': 'gymnase',
        'Crèche': 'creche',
    };
    return map[type] || 'ecole';
}

function formatNumber(value) {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('fr-FR').format(value);
}

function getIntensityClass(value) {
    if (value < 30) return 'consumption-low';
    if (value < 60) return 'consumption-medium';
    return 'consumption-high';
}
