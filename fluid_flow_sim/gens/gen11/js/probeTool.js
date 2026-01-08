/**
 * Probe Tool Module
 * Displays flow properties at mouse position
 */

import { Vector2 } from './utils.js';
import { QUANTITY_CONFIG } from './colorGradients.js';

/**
 * Probe Tool for displaying flow properties
 */
export class ProbeTool {
    constructor(probeElement) {
        this.element = probeElement;
        this.contentElement = probeElement.querySelector('.probe-content');
        
        this.enabled = false;
        this.position = new Vector2(0, 0);
        this.worldPosition = new Vector2(0, 0);
        
        // Quantities to display
        this.quantities = [
            'position',
            'velocity',
            'speed',
            'pressure',
            'stream-function',
            'potential'
        ];
        
        // Update throttling
        this.lastUpdate = 0;
        this.updateInterval = 50; // ms
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.element.classList.remove('hidden');
        } else {
            this.element.classList.add('hidden');
        }
    }

    setQuantities(quantities) {
        this.quantities = quantities;
    }

    updatePosition(screenX, screenY, worldX, worldY) {
        this.position.set(screenX, screenY);
        this.worldPosition.set(worldX, worldY);
        
        // Position the probe display
        // Offset from cursor to avoid overlap
        const offsetX = 20;
        const offsetY = 20;
        
        // Check if we need to flip to avoid going off screen
        const rect = this.element.getBoundingClientRect();
        let x = screenX + offsetX;
        let y = screenY + offsetY;
        
        if (x + rect.width > window.innerWidth) {
            x = screenX - rect.width - offsetX;
        }
        if (y + rect.height > window.innerHeight) {
            y = screenY - rect.height - offsetY;
        }
        
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
    }

    update(physics, time) {
        if (!this.enabled) return;
        
        // Throttle updates
        if (time - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = time;
        
        const x = this.worldPosition.x;
        const y = this.worldPosition.y;
        
        // Get all properties at this point
        const props = physics.getPropertiesAt(x, y);
        
        // Build HTML content
        let html = '';
        
        for (const quantity of this.quantities) {
            const row = this.formatQuantity(quantity, props);
            if (row) {
                html += row;
            }
        }
        
        this.contentElement.innerHTML = html;
    }

    formatQuantity(quantityId, props) {
        let label, value, unit = '';
        
        switch (quantityId) {
            case 'position':
                label = 'Position';
                value = `(${props.position.x.toFixed(1)}, ${props.position.y.toFixed(1)})`;
                break;
            
            case 'velocity':
                label = 'Velocity';
                value = `(${props.velocity.x.toFixed(2)}, ${props.velocity.y.toFixed(2)})`;
                unit = 'm/s';
                break;
            
            case 'speed':
                label = 'Speed |V|';
                value = props.speed.toFixed(3);
                unit = 'm/s';
                break;
            
            case 'pressure':
                label = 'Pressure';
                value = props.pressure.toFixed(1);
                unit = 'Pa';
                break;
            
            case 'density':
                label = 'Density';
                value = props.density.toFixed(3);
                unit = 'kg/m³';
                break;
            
            case 'temperature':
                label = 'Temperature';
                value = props.temperature.toFixed(1);
                unit = 'K';
                break;
            
            case 'vorticity':
                label = 'Vorticity';
                value = props.vorticity.toFixed(4);
                unit = '1/s';
                break;
            
            case 'stream-function':
                label = 'ψ (Stream)';
                value = props.streamFunction.toFixed(3);
                unit = 'm²/s';
                break;
            
            case 'potential':
                label = 'φ (Potential)';
                value = props.potential.toFixed(3);
                unit = 'm²/s';
                break;
            
            default:
                return null;
        }
        
        return `
            <div class="probe-row">
                <span class="probe-label">${label}:</span>
                <span class="probe-value">${value} ${unit}</span>
            </div>
        `;
    }

    hide() {
        this.element.classList.add('hidden');
    }

    show() {
        if (this.enabled) {
            this.element.classList.remove('hidden');
        }
    }
}
