/**
 * Input Handler Module
 * Manages mouse, keyboard, and touch input
 */

import { Vector2, EventEmitter } from './utils.js';

/**
 * Input Handler for mouse, keyboard, and touch events
 */
export class InputHandler extends EventEmitter {
    constructor(canvas, view) {
        super();
        
        this.canvas = canvas;
        this.view = view;
        
        // Mouse state
        this.mouse = new Vector2(0, 0);
        this.mouseWorld = new Vector2(0, 0);
        this.isMouseDown = false;
        this.isDragging = false;
        this.dragStart = new Vector2(0, 0);
        this.dragButton = -1;
        
        // Touch state
        this.touches = [];
        this.lastPinchDistance = 0;
        
        // Keyboard state
        this.keys = {};
        this.modifiers = {
            shift: false,
            ctrl: false,
            alt: false
        };
        
        // Element dragging
        this.draggingElement = null;
        this.elementDragOffset = new Vector2(0, 0);
        
        // Settings
        this.panButton = 1; // Middle mouse button
        this.zoomSensitivity = 0.001;
        
        this.bindEvents();
    }

    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Keyboard events
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Focus management
        this.canvas.setAttribute('tabindex', '0');
    }

    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.set(e.clientX - rect.left, e.clientY - rect.top);
        this.mouseWorld = this.view.screenToWorld(this.mouse.x, this.mouse.y);
    }

    onMouseDown(e) {
        this.updateMousePosition(e);
        this.isMouseDown = true;
        this.dragButton = e.button;
        this.dragStart.copy(this.mouse);
        
        this.updateModifiers(e);
        
        // Check for element at click position
        this.emit('mousedown', {
            screen: this.mouse.clone(),
            world: this.mouseWorld.clone(),
            button: e.button,
            modifiers: { ...this.modifiers }
        });
        
        // Middle button or Space+Left for panning
        if (e.button === 1 || (e.button === 0 && this.keys[' '])) {
            this.canvas.classList.add('panning');
        }
    }

    onMouseMove(e) {
        const prevMouse = this.mouse.clone();
        this.updateMousePosition(e);
        
        const dx = this.mouse.x - prevMouse.x;
        const dy = this.mouse.y - prevMouse.y;
        
        // Emit move event
        this.emit('mousemove', {
            screen: this.mouse.clone(),
            world: this.mouseWorld.clone(),
            delta: new Vector2(dx, dy)
        });
        
        if (this.isMouseDown) {
            const distance = this.mouse.distanceTo(this.dragStart);
            
            if (distance > 5) {
                this.isDragging = true;
            }
            
            // Handle panning
            if (this.dragButton === 1 || (this.dragButton === 0 && this.keys[' '])) {
                this.view.pan(dx, dy);
                this.emit('viewchange');
            }
            // Handle element dragging
            else if (this.draggingElement) {
                const worldDelta = new Vector2(dx / this.view.zoom, dy / this.view.zoom);
                this.emit('elementdrag', {
                    element: this.draggingElement,
                    delta: worldDelta,
                    position: this.mouseWorld.clone()
                });
            }
            // Regular drag
            else if (this.dragButton === 0) {
                this.emit('drag', {
                    screen: this.mouse.clone(),
                    world: this.mouseWorld.clone(),
                    delta: new Vector2(dx, dy)
                });
            }
        }
    }

    onMouseUp(e) {
        this.updateMousePosition(e);
        
        const wasDragging = this.isDragging;
        
        this.emit('mouseup', {
            screen: this.mouse.clone(),
            world: this.mouseWorld.clone(),
            button: e.button,
            wasDragging: wasDragging
        });
        
        // Emit click if not dragging
        if (!wasDragging && this.dragButton === 0) {
            this.emit('click', {
                screen: this.mouse.clone(),
                world: this.mouseWorld.clone(),
                modifiers: { ...this.modifiers }
            });
        }
        
        this.isMouseDown = false;
        this.isDragging = false;
        this.draggingElement = null;
        this.dragButton = -1;
        this.canvas.classList.remove('panning');
    }

    onWheel(e) {
        e.preventDefault();
        
        this.updateMousePosition(e);
        
        // Zoom towards mouse position
        const zoomFactor = 1 - e.deltaY * this.zoomSensitivity;
        
        // Convert mouse to world before zoom
        const worldBefore = this.view.screenToWorld(this.mouse.x, this.mouse.y);
        
        this.view.zoomAt(worldBefore.x, worldBefore.y, zoomFactor);
        
        this.emit('zoom', {
            factor: zoomFactor,
            zoom: this.view.zoom,
            center: this.mouseWorld.clone()
        });
        
        this.emit('viewchange');
    }

    onDoubleClick(e) {
        this.updateMousePosition(e);
        
        this.emit('dblclick', {
            screen: this.mouse.clone(),
            world: this.mouseWorld.clone()
        });
    }

    // Touch events
    onTouchStart(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        
        if (this.touches.length === 1) {
            const touch = this.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.set(touch.clientX - rect.left, touch.clientY - rect.top);
            this.mouseWorld = this.view.screenToWorld(this.mouse.x, this.mouse.y);
            this.dragStart.copy(this.mouse);
            this.isMouseDown = true;
            
            this.emit('mousedown', {
                screen: this.mouse.clone(),
                world: this.mouseWorld.clone(),
                button: 0,
                modifiers: { shift: false, ctrl: false, alt: false }
            });
        } else if (this.touches.length === 2) {
            // Two finger - start pinch zoom
            this.lastPinchDistance = this.getPinchDistance();
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        
        if (this.touches.length === 1) {
            const touch = this.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const prevMouse = this.mouse.clone();
            
            this.mouse.set(touch.clientX - rect.left, touch.clientY - rect.top);
            this.mouseWorld = this.view.screenToWorld(this.mouse.x, this.mouse.y);
            
            const dx = this.mouse.x - prevMouse.x;
            const dy = this.mouse.y - prevMouse.y;
            
            this.emit('mousemove', {
                screen: this.mouse.clone(),
                world: this.mouseWorld.clone(),
                delta: new Vector2(dx, dy)
            });
        } else if (this.touches.length === 2) {
            // Pinch zoom
            const newDistance = this.getPinchDistance();
            const zoomFactor = newDistance / this.lastPinchDistance;
            
            const center = this.getPinchCenter();
            const worldCenter = this.view.screenToWorld(center.x, center.y);
            
            this.view.zoomAt(worldCenter.x, worldCenter.y, zoomFactor);
            this.lastPinchDistance = newDistance;
            
            this.emit('viewchange');
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        
        if (this.touches.length === 1 && e.touches.length === 0) {
            this.emit('mouseup', {
                screen: this.mouse.clone(),
                world: this.mouseWorld.clone(),
                button: 0,
                wasDragging: this.isDragging
            });
        }
        
        this.touches = Array.from(e.touches);
        this.isMouseDown = false;
        this.isDragging = false;
    }

    getPinchDistance() {
        if (this.touches.length < 2) return 0;
        const dx = this.touches[0].clientX - this.touches[1].clientX;
        const dy = this.touches[0].clientY - this.touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getPinchCenter() {
        if (this.touches.length < 2) return this.mouse;
        const rect = this.canvas.getBoundingClientRect();
        return new Vector2(
            (this.touches[0].clientX + this.touches[1].clientX) / 2 - rect.left,
            (this.touches[0].clientY + this.touches[1].clientY) / 2 - rect.top
        );
    }

    // Keyboard events
    onKeyDown(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        this.keys[e.key] = true;
        this.updateModifiers(e);
        
        this.emit('keydown', {
            key: e.key,
            code: e.code,
            modifiers: { ...this.modifiers },
            repeat: e.repeat
        });
        
        // Prevent default for certain keys
        if (['Space', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    }

    onKeyUp(e) {
        this.keys[e.key] = false;
        this.updateModifiers(e);
        
        this.emit('keyup', {
            key: e.key,
            code: e.code,
            modifiers: { ...this.modifiers }
        });
    }

    updateModifiers(e) {
        this.modifiers.shift = e.shiftKey;
        this.modifiers.ctrl = e.ctrlKey || e.metaKey;
        this.modifiers.alt = e.altKey;
    }

    isKeyDown(key) {
        return this.keys[key] === true;
    }

    setDraggingElement(element) {
        this.draggingElement = element;
    }

    getMouseWorld() {
        return this.mouseWorld.clone();
    }

    getMouse() {
        return this.mouse.clone();
    }

    dispose() {
        this.clear();
    }
}
