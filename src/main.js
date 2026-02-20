/**
 * main.js — Application Entry Point
 * 
 * Initializes navigation, ETL pipeline, and all views.
 */

import { runETLPipeline } from './etl/pipeline.js';
import { initVisualization } from './views/visualization.js';
import { initDataTable } from './views/dataTable.js';
import { initCartography } from './views/cartography.js';

// ---- Navigation ----

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;

            // Update nav buttons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update views
            views.forEach(v => v.classList.remove('active'));
            const target = document.getElementById(`view-${targetView}`);
            if (target) {
                target.classList.add('active');
            }
        });
    });
}

// ---- ETL Button ----

function initETLButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    const etlStatus = document.getElementById('etl-status');
    const statusText = etlStatus.querySelector('.status-text');

    refreshBtn.addEventListener('click', async () => {
        if (refreshBtn.classList.contains('spinning')) return;

        // Start animation
        refreshBtn.classList.add('spinning');
        etlStatus.className = 'etl-status processing';
        statusText.textContent = 'Pipeline en cours...';

        // Show loading overlay
        const overlay = createLoadingOverlay();
        document.body.appendChild(overlay);

        try {
            await runETLPipeline((step, state) => {
                updateLoadingStep(overlay, step, state);
            });

            // Success
            etlStatus.className = 'etl-status success';
            statusText.textContent = 'Données à jour';
        } catch (error) {
            console.error('ETL Error:', error);
            etlStatus.className = 'etl-status error';
            statusText.textContent = 'Erreur ETL';
        } finally {
            refreshBtn.classList.remove('spinning');

            // Remove overlay with fade
            setTimeout(() => {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.3s ease';
                setTimeout(() => overlay.remove(), 300);
            }, 400);
        }
    });
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">🤖 IA Copilot — Pipeline ETL en cours</div>
    <div class="loading-steps">
      <div class="loading-step" data-step="extract">
        <span class="loading-step-icon">○</span>
        <span>Extract — Lecture des données API PISTE</span>
      </div>
      <div class="loading-step" data-step="transform">
        <span class="loading-step-icon">○</span>
        <span>Transform — Nettoyage & normalisation</span>
      </div>
      <div class="loading-step" data-step="load">
        <span class="loading-step-icon">○</span>
        <span>Load — Chargement des données traitées</span>
      </div>
    </div>
  `;
    return overlay;
}

function updateLoadingStep(overlay, step, state) {
    const stepEl = overlay.querySelector(`[data-step="${step}"]`);
    if (!stepEl) return;

    const icon = stepEl.querySelector('.loading-step-icon');

    if (state === 'active') {
        stepEl.classList.add('active');
        stepEl.classList.remove('done');
        icon.textContent = '◉';
    } else if (state === 'done') {
        stepEl.classList.remove('active');
        stepEl.classList.add('done');
        icon.textContent = '✓';
    }
}

// ---- Initialize App ----

function init() {
    initNavigation();
    initETLButton();
    initVisualization();
    initDataTable();
    initCartography();

    console.log('🌿 E-Copilot — Tableau de Bord Écologique initialisé');
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
