interface TouchViewport {
    appEl: HTMLElement;
    containerEL: HTMLElement;
    mindScale: number;
    scale(num: number): void;
}

type Point = { x: number; y: number };
type Baseline = { anchor: Point; midpoint: Point; distance: number; scale: number };
type TouchMouseEvent = MouseEvent & {
    pointerType?: string;
    pointerId?: number;
    sourceCapabilities?: { firesTouchEvents: boolean };
};

const PAN_THRESHOLD = 6;
const TRAILING_EVENT_MS = 800;

/** Own only touch navigation; leave node taps and mouse/pen input to the editor. */
export default class TouchNavigation {
    private pointers = new Map<number, Point>();
    private navigating = false;
    private canPan = false;
    private baseline: Baseline | null = null;
    private trailing = new Map<number, { point: Point; expires: number }>();
    private removers: (() => void)[] = [];

    constructor(private viewport: TouchViewport, private cancelDrag: () => void) {
        const canvas = viewport.appEl;
        this.listen(canvas, 'pointerdown', this.down);
        this.listen(canvas, 'pointermove', this.move);
        this.listen(canvas, 'pointerup', this.end);
        this.listen(canvas, 'pointercancel', this.end);
        this.listen(canvas, 'lostpointercapture', this.end);
        for (const type of ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick',
            'contextmenu', 'dragstart', 'dragover', 'drop'] as const) {
            this.listen(canvas, type, this.guard);
        }
        const window = canvas.ownerDocument.defaultView;
        if (window) this.listen(window, 'blur', this.reset);
    }

    private listen<K extends keyof WindowEventMap>(target: EventTarget, type: K, listener: (event: WindowEventMap[K]) => void) {
        target.addEventListener(type, listener as EventListener, { capture: true, passive: false });
        this.removers.push(() => target.removeEventListener(type, listener as EventListener, { capture: true }));
    }

    private stop(event: Event) {
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
    }

    private down = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') return;
        // A fresh touch must not inherit suppression, even if its ID is reused.
        this.trailing.clear();
        if (!this.pointers.size) {
            const target = event.target as Element;
            this.canPan = !target.closest(
                '.mm-node, .mm-node-menu, input, textarea, button, a, [contenteditable="true"]');
        }
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.rebaseline();
        if (this.pointers.size >= 2) this.beginNavigation();
        if (this.navigating) this.stop(event);
    };

    private beginNavigation() {
        if (!this.navigating) {
            this.navigating = true;
            this.cancelDrag();
        }
        for (const id of this.pointers.keys()) this.viewport.appEl.setPointerCapture(id);
    }

    private geometry() {
        const points = Array.from(this.pointers.values());
        const a = points[0];
        const b = points[1] || a;
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            distance: Math.hypot(b.x - a.x, b.y - a.y)
        };
    }

    private rebaseline() {
        if (!this.pointers.size) {
            this.baseline = null;
            return;
        }
        const midpoint = this.geometry();
        const rect = this.viewport.appEl.getBoundingClientRect();
        const scale = this.viewport.mindScale;
        this.baseline = {
            midpoint, distance: midpoint.distance, scale,
            anchor: { x: (midpoint.x - rect.left) * 100 / scale,
                y: (midpoint.y - rect.top) * 100 / scale }
        };
    }

    private move = (event: PointerEvent) => {
        if (!this.pointers.has(event.pointerId) || !this.baseline) return;
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const midpoint = this.geometry();
        const baseline = this.baseline;
        if (!this.navigating && this.canPan && Math.hypot(
            midpoint.x - baseline.midpoint.x, midpoint.y - baseline.midpoint.y) >= PAN_THRESHOLD) {
            this.beginNavigation();
        }
        if (!this.navigating) return;
        this.stop(event);
        // scale() owns the limits; never accumulate ratios from a clamped scale.
        if (baseline.distance > 0) {
            this.viewport.scale(baseline.scale * midpoint.distance / baseline.distance);
        }
        const { appEl, containerEL } = this.viewport;
        const rect = appEl.getBoundingClientRect();
        const scale = this.viewport.mindScale / 100;
        containerEL.scrollLeft += rect.left + baseline.anchor.x * scale - midpoint.x;
        containerEL.scrollTop += rect.top + baseline.anchor.y * scale - midpoint.y;
        // Coincident fingers cannot define a ratio until they separate.
        if (this.pointers.size >= 2 && baseline.distance === 0 && midpoint.distance > 0) this.rebaseline();
    };

    private end = (event: PointerEvent) => {
        // Transferring implicit capture from a node also bubbles a lost event.
        if (event.type === 'lostpointercapture' && event.target !== this.viewport.appEl) return;
        if (!this.pointers.has(event.pointerId)) return;
        if (this.navigating) {
            this.stop(event);
            this.trailing.set(event.pointerId, {
                point: { x: event.clientX, y: event.clientY }, expires: Date.now() + TRAILING_EVENT_MS
            });
        }
        if (event.type !== 'pointerup') {
            // Cancelling one stream ends navigation for the whole gesture.
            // Retain provenance for any remaining finger's trailing activation.
            if (this.navigating) {
                for (const [id, point] of this.pointers) {
                    if (id !== event.pointerId) this.trailing.set(id, { point, expires: Date.now() + TRAILING_EVENT_MS });
                }
            }
            this.clearGesture();
            return;
        }
        this.pointers.delete(event.pointerId);
        if (this.viewport.appEl.hasPointerCapture(event.pointerId)) {
            this.viewport.appEl.releasePointerCapture(event.pointerId);
        }
        if (!this.pointers.size) this.navigating = this.canPan = false;
        // Keep navigation when a pinch becomes a single touch, with no jump.
        this.rebaseline();
    };

    private guard = (event: Event) => {
        const mouse = event as TouchMouseEvent;
        const touch = mouse.pointerType === 'touch' || mouse.sourceCapabilities?.firesTouchEvents;
        if (event.type === 'click' && mouse.detail === 0 && !touch) return;
        // OS file drags cannot originate from the node touch being cancelled.
        const transfer = (event as DragEvent).dataTransfer;
        if (transfer && Array.from(transfer.types).indexOf('Files') !== -1) return;
        if (this.navigating) {
            this.stop(event);
            return;
        }
        // External drag events are never trailing clicks from a touch gesture.
        if (!touch || ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'contextmenu'].indexOf(event.type) === -1) return;
        const now = Date.now();
        for (const [id, entry] of this.trailing) {
            if (entry.expires <= now) {
                this.trailing.delete(id);
            } else if (mouse.pointerId !== undefined ? mouse.pointerId === id :
                Math.hypot(mouse.clientX - entry.point.x, mouse.clientY - entry.point.y) <= PAN_THRESHOLD) {
                this.stop(event);
                return;
            }
        }
    };

    private clearGesture() {
        const ids = Array.from(this.pointers.keys());
        this.pointers.clear();
        this.navigating = this.canPan = false;
        this.baseline = null;
        for (const id of ids) {
            if (this.viewport.appEl.hasPointerCapture(id)) {
                this.viewport.appEl.releasePointerCapture(id);
            }
        }
    }

    private reset = () => {
        this.clearGesture();
        this.trailing.clear();
    };

    destroy() {
        this.removers.forEach(remove => remove());
        this.reset();
    }
}
