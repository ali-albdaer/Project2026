/**
 * Input Handler
 * Mouse and keyboard input management
 */

import { Vec2 } from './math.js';
import { Config, State, updateConfig } from './config.js';

/**
 * Input handler class
 */
export class InputHandler {
    constructor(canvas, renderer, simulation, ui) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.simulation = simulation;
        this.ui = ui;
        
        this.isDragging = false;
        this.isPanning = false;
        this.dragStart = null;
        this.draggedElement = null;
        
        this.setupEventListeners();
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Window resize
        window.addEventListener('resize', this.onResize.bind(this));
    }
    
    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
        
        State.mouse.x = e.clientX;
        State.mouse.y = e.clientY;
        State.mouse.worldX = worldPos.x;
        State.mouse.worldY = worldPos.y;
        State.mouse.isDown = true;
        State.mouse.button = e.button;
        
        if (e.button === 0) {
            // Left click - check for element selection/drag
            const element = this.findElementAtPosition(worldPos);
            
            if (element) {
                this.draggedElement = element;
                this.isDragging = true;
                State.ui.selectedElement = element.id;
                this.dragStart = { x: element.x, y: element.y };
                this.ui.updateElementList();
            } else {
                // Deselect
                State.ui.selectedElement = null;
                this.ui.updateElementList();
            }
        } else if (e.button === 1 || e.button === 2) {
            // Middle or right click - pan
            this.isPanning = true;
            this.dragStart = { x: Config.view.panX, y: Config.view.panY };
        }
    }
    
    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
        
        const dx = e.clientX - State.mouse.x;
        const dy = e.clientY - State.mouse.y;
        
        State.mouse.x = e.clientX;
        State.mouse.y = e.clientY;
        State.mouse.worldX = worldPos.x;
        State.mouse.worldY = worldPos.y;
        
        if (this.isDragging && this.draggedElement) {
            // Drag element
            this.draggedElement.x = worldPos.x;
            this.draggedElement.y = worldPos.y;
            this.ui.updateElementList();
        } else if (this.isPanning) {
            // Pan view
            Config.view.panX += dx;
            Config.view.panY += dy;
        }
        
        // Update probe tooltip
        if (Config.probe.enabled) {
            this.ui.updateProbeTooltip(e.clientX, e.clientY, worldPos);
        }
    }
    
    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        State.mouse.isDown = false;
        this.isDragging = false;
        this.isPanning = false;
        this.draggedElement = null;
        this.dragStart = null;
    }
    
    /**
     * Mouse wheel handler
     */
    onWheel(e) {
        e.preventDefault();
        
        const worldPosBefore = this.renderer.screenToWorld(e.clientX, e.clientY);
        
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Config.view.zoom * zoomFactor;
        
        // Clamp zoom
        Config.view.zoom = Math.max(Config.view.minZoom, Math.min(Config.view.maxZoom, newZoom));
        
        // Adjust pan to zoom towards mouse position
        const worldPosAfter = this.renderer.screenToWorld(e.clientX, e.clientY);
        Config.view.panX += (worldPosAfter.x - worldPosBefore.x) * Config.view.zoom;
        Config.view.panY += (worldPosAfter.y - worldPosBefore.y) * Config.view.zoom;
        
        // Update UI
        this.ui.updateZoomDisplay();
    }
    
    /**
     * Key down handler
     */
    onKeyDown(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlayPause();
                break;
                
            case 'ArrowRight':
                if (!State.isPlaying) {
                    this.simulation.step();
                }
                break;
                
            case 'Backspace':
                e.preventDefault();
                this.simulation.reset();
                this.ui.updateTimeDisplay();
                break;
                
            case 'KeyH':
                this.toggleUI();
                break;
                
            case 'KeyP':
                this.toggleCheckbox('showParticles');
                break;
                
            case 'KeyV':
                this.toggleCheckbox('showVelocityVectors');
                break;
                
            case 'KeyS':
                this.toggleCheckbox('showStreamlines');
                break;
                
            case 'KeyK':
                this.toggleCheckbox('showStreaklines');
                break;
                
            case 'KeyF':
                this.toggleCheckbox('showStaticVectors');
                break;
                
            case 'KeyT':
                this.toggleCheckbox('enableProbe', 'probe');
                break;
                
            case 'KeyR':
                this.resetView();
                break;
                
            case 'KeyQ':
                this.ui.toggleLeftMenu();
                break;
                
            case 'KeyE':
                this.ui.toggleRightMenu();
                break;
                
            case 'Delete':
                if (State.ui.selectedElement) {
                    this.ui.deleteElement(State.ui.selectedElement);
                }
                break;
                
            case 'Escape':
                State.ui.selectedElement = null;
                this.ui.updateElementList();
                this.ui.closeModal();
                break;
        }
    }
    
    /**
     * Key up handler
     */
    onKeyUp(e) {
        // Currently not needed
    }
    
    /**
     * Window resize handler
     */
    onResize() {
        this.renderer.resize();
    }
    
    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        State.isPlaying = !State.isPlaying;
        this.ui.updatePlayPauseButton();
    }
    
    /**
     * Toggle UI visibility
     */
    toggleUI() {
        State.ui.hidden = !State.ui.hidden;
        document.body.classList.toggle('ui-hidden', State.ui.hidden);
        document.getElementById('hiddenUIIndicator').classList.toggle('hidden', !State.ui.hidden);
    }
    
    /**
     * Toggle checkbox setting
     */
    toggleCheckbox(id, configSection = 'visualization') {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            Config[configSection][id] = checkbox.checked;
        }
    }
    
    /**
     * Reset view
     */
    resetView() {
        Config.view.zoom = 1.0;
        Config.view.panX = 0;
        Config.view.panY = 0;
        this.ui.updateZoomDisplay();
    }
    
    /**
     * Find element at world position
     */
    findElementAtPosition(worldPos, threshold = 25) {
        for (const element of State.flowElements) {
            if (!element.enabled) continue;
            
            // Check distance to element center
            const dx = worldPos.x - (element.x || 0);
            const dy = worldPos.y - (element.y || 0);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < threshold / Config.view.zoom) {
                return element;
            }
        }
        return null;
    }
}
