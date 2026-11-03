const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, requireModule = require) {
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 }
    }).outputText;
    const mod = { exports: {} };
    new Function('exports', 'module', 'require', compiled)(mod.exports, mod, requireModule);
    return mod.exports.default;
}
const TouchNavigation = load('src/mindmap/TouchNavigation.ts');
// Exercise the real click/selection methods without booting Obsidian or rendering.
const MindMap = load('src/mindmap/mindmap.ts', () => ({}));

function setup(scale = 100) {
    const canvas = new EventTarget();
    const window = new EventTarget();
    const captured = new Set();
    canvas.ownerDocument = { defaultView: window };
    canvas.setPointerCapture = id => captured.add(id);
    canvas.hasPointerCapture = id => captured.has(id);
    canvas.releasePointerCapture = id => captured.delete(id);
    canvas.closest = () => canvas.onNode ? {} : null;
    canvas.hasClass = () => false;
    canvas.tagName = 'DIV';
    let cancellations = 0;
    const viewport = {
        appEl: canvas, containerEL: { scrollLeft: 900, scrollTop: 700 }, mindScale: scale,
        scale(n) { this.mindScale = Math.max(20, Math.min(300, n)); }
    };
    // Nonzero pane offset and transform origin exercise midpoint compensation.
    canvas.getBoundingClientRect = () => ({
        left: 80 + 1200 * (1 - viewport.mindScale / 100) - viewport.containerEL.scrollLeft,
        top: 40 + 1000 * (1 - viewport.mindScale / 100) - viewport.containerEL.scrollTop
    });
    const controller = new TouchNavigation(viewport, () => cancellations++);
    function emit(type, id = 1, x = 200, y = 200, extra = {}) {
        const e = new Event(type, { cancelable: true });
        const pointer = type.startsWith('pointer') || type === 'lostpointercapture' || type === 'click';
        // Real DragEvents have neither pointer identity nor touch capabilities.
        const touchMouse = ['mousedown', 'mousemove', 'mouseup', 'dblclick', 'contextmenu'].includes(type);
        Object.assign(e, { clientX: x, clientY: y, detail: 1 },
            pointer ? { pointerType: 'touch', pointerId: id } : {},
            touchMouse ? { sourceCapabilities: { firesTouchEvents: true } } : {}, extra);
        canvas.dispatchEvent(e);
        return e;
    }
    return { canvas, viewport, controller, emit, captured, window, cancellations: () => cancellations };
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function beginPinch(s) { s.emit('pointerdown', 1, 200, 200); s.emit('pointerdown', 2, 400, 200); }
function anchor(s, x, y) {
    const rect = s.canvas.getBoundingClientRect(), scale = s.viewport.mindScale / 100;
    return { x: (x - rect.left) / scale, y: (y - rect.top) / scale };
}
function anchored(s, point, x, y) {
    const rect = s.canvas.getBoundingClientRect(), scale = s.viewport.mindScale / 100;
    near(rect.left + point.x * scale, x); near(rect.top + point.y * scale, y);
}

for (const movement of [0, 5]) {
    test(`canvas tap with ${movement}px movement reaches existing deselection and finish-editing handler`, () => {
        const s = setup(); let unselected = false, finished = false;
        const editor = {
            selectNode: { unSelect() { unselected = true; } },
            editNode: { data: { isEdit: true }, cancelEdit() { finished = true; } },
            _menuDom: { style: {} }, clearSelectNode: MindMap.prototype.clearSelectNode
        };
        s.canvas.addEventListener('click', e => MindMap.prototype.appClickFn.call(editor, e));
        assert.equal(s.emit('pointerdown').defaultPrevented, false);
        assert.equal(s.emit('pointermove', 1, 200 + movement, 200).defaultPrevented, false);
        assert.equal(s.emit('pointerup', 1, 200 + movement, 200).defaultPrevented, false);
        assert.equal(s.emit('click', 1, 200 + movement, 200).defaultPrevented, false);
        assert.equal(unselected, true); assert.equal(finished, true);
        assert.equal(s.cancellations(), 0); assert.equal(s.captured.size, 0);
        assert.deepEqual(s.viewport.containerEL, { scrollLeft: 900, scrollTop: 700 });
    });
}

test('6px threshold initiates pan and suppresses only the resulting touch click', () => {
    const s = setup(); s.emit('pointerdown');
    assert.equal(s.emit('pointermove', 1, 206, 200).defaultPrevented, true);
    near(s.viewport.containerEL.scrollLeft, 894);
    s.emit('pointermove', 1, 240, 230); s.emit('pointerup', 1, 240, 230);
    assert.deepEqual(s.viewport.containerEL, { scrollLeft: 860, scrollTop: 670 });
    assert.equal(s.emit('click', 1, 240, 230).defaultPrevented, true);
    assert.equal(s.cancellations(), 1);
});

test('touch compatibility mouse events cannot pan below the threshold', () => {
    const s = setup();
    const editor = { ...s.viewport, drag: false, scalePointer: [] };
    for (const [type, method] of [['mousedown', 'appMouseDown'], ['mousemove', 'appMouseMove'], ['mouseup', 'appMouseUp']]) {
        s.canvas.addEventListener(type, e => MindMap.prototype[method].call(editor, e));
    }
    s.emit('pointerdown');
    assert.equal(s.emit('mousedown', 1, 200, 200, { pageX: 200, pageY: 200 }).defaultPrevented, true);
    s.emit('pointermove', 1, 205, 200);
    assert.equal(s.emit('mousemove', 1, 205, 200, { pageX: 205, pageY: 200 }).defaultPrevented, true);
    assert.equal(editor.drag, false);
    assert.deepEqual(s.viewport.containerEL, { scrollLeft: 900, scrollTop: 700 });
    s.emit('pointerup', 1, 205, 200);
    assert.equal(s.emit('mouseup', 1, 205, 200).defaultPrevented, false);
    assert.equal(s.emit('click', 1, 205, 200).defaultPrevented, false);
    assert.equal(s.cancellations(), 0);

    s.emit('pointerdown');
    s.emit('mousedown');
    s.emit('pointermove', 1, 206, 200);
    near(s.viewport.containerEL.scrollLeft, 894);
    s.emit('pointerup', 1, 206, 200);
    assert.equal(s.emit('click', 1, 206, 200).defaultPrevented, true);
    assert.equal(s.cancellations(), 1);
});

test('node taps, node dragging, mouse and pen input pass through before navigation', () => {
    const s = setup(); s.canvas.onNode = true;
    for (const type of ['pointerdown', 'pointermove', 'dragstart', 'dragover', 'drop', 'pointerup', 'click', 'dblclick']) {
        assert.equal(s.emit(type, 1, type === 'pointermove' ? 300 : 200, 200).defaultPrevented, false);
    }
    for (const pointerType of ['mouse', 'pen']) {
        assert.equal(s.emit('pointerdown', 2, 200, 200, { pointerType }).defaultPrevented, false);
        assert.equal(s.emit('pointermove', 2, 500, 500, { pointerType }).defaultPrevented, false);
    }
    assert.equal(s.cancellations(), 0);
    assert.deepEqual(s.viewport.containerEL, { scrollLeft: 900, scrollTop: 700 });
});

test('pinch anchors the moving midpoint and reverses cleanly after upper/lower clamping', () => {
    const s = setup(); beginPinch(s); const world = anchor(s, 300, 200);
    for (const [right, expectedScale] of [[600, 200], [1200, 300], [1000, 300], [600, 200], [220, 20], [230, 20], [300, 50], [400, 100]]) {
        s.emit('pointermove', 2, right, 200);
        near(s.viewport.mindScale, expectedScale); anchored(s, world, (200 + right) / 2, 200);
    }
});

for (const scale of [20, 100, 300]) {
    for (const first of [1, 2]) {
        test(`equal translation preserves ${scale}% zoom (pointer ${first} moves first)`, () => {
            const s = setup(scale); beginPinch(s); const world = anchor(s, 300, 200);
            for (const id of [first, 3 - first]) s.emit('pointermove', id, id === 1 ? 240 : 440, 200);
            near(s.viewport.mindScale, scale); anchored(s, world, 340, 200);
            near(s.viewport.containerEL.scrollLeft, 860);
        });
    }
}

test('translation after overshooting either clamp retains zoom and the world anchor', () => {
    for (const [right, scale] of [[1200, 300], [220, 20]]) {
        const s = setup(); beginPinch(s); const world = anchor(s, 300, 200);
        s.emit('pointermove', 2, right, 200);
        s.emit('pointermove', 2, right + 40, 220); s.emit('pointermove', 1, 240, 220);
        near(s.viewport.mindScale, scale); anchored(s, world, (200 + right) / 2 + 40, 220);
    }
});

test('pinch-to-single, added fingers and replacement of the active pair rebaseline without jumps', () => {
    const s = setup(); beginPinch(s); s.emit('pointermove', 2, 600, 200);
    s.emit('pointerup', 2, 600, 200);
    const before = { ...s.viewport.containerEL };
    s.emit('pointermove', 1, 210, 210);
    near(s.viewport.containerEL.scrollLeft, before.scrollLeft - 10);
    near(s.viewport.containerEL.scrollTop, before.scrollTop - 10);
    s.emit('pointerdown', 3, 410, 210); s.emit('pointerdown', 4, 510, 210);
    const added = { ...s.viewport.containerEL };
    s.emit('pointerup', 1, 210, 210); s.emit('pointermove', 3, 410, 210);
    assert.deepEqual(s.viewport.containerEL, added); near(s.viewport.mindScale, 200);
    s.emit('pointermove', 4, 560, 210); near(s.viewport.mindScale, 300);
});

test('coincident initial pointers establish a finite pinch baseline when separated', () => {
    const s = setup(); s.emit('pointerdown', 1); s.emit('pointerdown', 2);
    s.emit('pointermove', 2, 220, 200); near(s.viewport.mindScale, 100);
    s.emit('pointermove', 2, 240, 200); near(s.viewport.mindScale, 200);
});

test('multitouch cancels pending node drag and prevents node actions through final release', () => {
    const s = setup(); s.canvas.onNode = true; beginPinch(s);
    assert.equal(s.cancellations(), 1);
    for (const type of ['dragstart', 'dragover', 'drop', 'click', 'dblclick', 'contextmenu']) {
        assert.equal(s.emit(type).defaultPrevented, true);
    }
    s.emit('pointerup', 2, 400, 200); s.emit('pointerup', 1, 200, 200);
    assert.equal(s.captured.size, 0);
    assert.equal(s.emit('click', 1).defaultPrevented, true);
    assert.equal(s.emit('click', 2, 400, 200).defaultPrevented, true);
});

test('external drag/drop and physical mouse/keyboard activation work immediately after navigation', () => {
    const s = setup(); beginPinch(s); s.emit('pointerup', 2); s.emit('pointerup', 1);
    let drops = 0; s.canvas.addEventListener('drop', () => drops++);
    for (const type of ['dragstart', 'dragover', 'drop']) {
        assert.equal(s.emit(type, 0, 200, 200, { dataTransfer: { types: ['Files'] } }).defaultPrevented, false);
    }
    assert.equal(drops, 1);
    for (const type of ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'contextmenu']) {
        assert.equal(s.emit(type, 9, 200, 200, { pointerType: 'mouse', sourceCapabilities: { firesTouchEvents: false } }).defaultPrevented, false);
    }
    assert.equal(s.emit('click', -1, 0, 0, { pointerType: '', detail: 0 }).defaultPrevented, false);
});

test('external file drag/drop is not mistaken for a node drag during navigation', () => {
    const s = setup(); beginPinch(s);
    for (const type of ['dragover', 'drop']) {
        assert.equal(s.emit(type, 0, 200, 200, { dataTransfer: { types: ['Files'] } }).defaultPrevented, false);
        assert.equal(s.emit(type).defaultPrevented, true);
    }
});

test('trailing suppression checks touch provenance, ID/location, expiry and fresh pointerdown', () => {
    const s = setup(); beginPinch(s); s.emit('pointerup', 2); s.emit('pointerup', 1);
    assert.equal(s.emit('click', 99).defaultPrevented, false);
    assert.equal(s.emit('dblclick', 1).defaultPrevented, true);
    assert.equal(s.emit('dblclick', 1, 400, 400).defaultPrevented, false);
    const now = Date.now;
    try {
        const expired = now() + 1000; Date.now = () => expired;
        assert.equal(s.emit('click', 1).defaultPrevented, false);
    } finally { Date.now = now; }
    s.emit('pointerdown', 1); s.emit('pointerup', 1);
    assert.equal(s.emit('click', 1).defaultPrevented, false);
});

for (const reason of ['pointercancel', 'lostpointercapture', 'blur', 'destroy']) {
    test(`${reason} clears active navigation and allows external drops`, () => {
        const s = setup(); beginPinch(s); s.emit('pointermove', 2, 600, 200);
        if (reason === 'blur') s.window.dispatchEvent(new Event('blur'));
        else if (reason === 'destroy') s.controller.destroy();
        else s.emit(reason, 2, 600, 200);
        assert.equal(s.captured.size, 0);
        const before = { ...s.viewport.containerEL };
        s.emit('pointermove', 1, 500, 500);
        assert.deepEqual(s.viewport.containerEL, before);
        assert.equal(s.emit('drop').defaultPrevented, false);
        if (reason === 'blur' || reason === 'destroy') assert.equal(s.emit('click', 2).defaultPrevented, false);
        else {
            assert.equal(s.emit('click', 1).defaultPrevented, true);
            assert.equal(s.emit('click', 2, 600, 200).defaultPrevented, true);
        }
        if (reason === 'destroy') assert.equal(s.emit('pointerdown').defaultPrevented, false);
    });
}
