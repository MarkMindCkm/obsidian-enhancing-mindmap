# Touchscreen navigation validation

The mindmap renders HTML nodes and SVG.js edges. Touch navigation reuses
MindMap.scale() (20–300%) and containerEL scroll offsets. It does not change
Markdown serialization, editing commands, history, or file formats.

Run with Node.js and the repository dependencies installed:

    npm run build
    npx tsc --noEmit
    npx tsc --noEmit --strict --target es2015 --moduleResolution node --lib dom,es2015 src/mindmap/TouchNavigation.ts
    node --test tests/touch-navigation.cjs

The regression tests use a simulated viewport plus the existing click/selection
methods; they do not replace hardware tests. There are 37 cases covering taps,
the 6 CSS-pixel pan threshold, both zoom limits and pointer event orders,
midpoint anchoring, finger-count transitions, cancellation, trailing touch
activation, external drops, and disposal. Wheel integration cases run the real
MindMap.initEvent/removeEvent, mouse/wheel handlers, setScale and scale alongside
TouchNavigation. They cover Ctrl/Cmd-wheel direction, fixed steps, anchors,
touchpad-sized deltas, plain scrolling, view isolation, touch/mouse transitions,
shared limits, and cancellation. Node EventTarget does not provide a DOM tree;
the harness explicitly forwards bubbling events to the container and body.
Native capture, layout/scroll bounds,
Obsidian editing, and native drag-and-drop still require the checks below.

The wheel handler uses standard `wheel`/`deltaY`, replacing the inherited
body-level legacy `mousewheel`/`wheelDelta` listener. It is non-passive and scoped
to the view container. Only nonzero vertical Ctrl/Cmd-wheel zoom prevents the
browser default; propagation and plain scrolling remain available. All zoom
uses the original 10-point setScale step, 20–300% clamp, and scalePointer origin.
Ctrl-marked touchpad pinch wheel events use that same path; unmodified touchpad
scrolling does not zoom. Touchscreen pinch remains in TouchNavigation.

## Packaged plugin bundle

`package.json` declares `main.js` as the plugin entrypoint. Although it is listed
in `.gitignore`, the file remains tracked and must be rebuilt and included with
source changes so checkouts and releases contain touchscreen navigation.

Run `npm run build` after changing the source and include the resulting `main.js`.
The rebuild also picks up existing upstream zoom commands, formatting differences,
and JSZip 3.10.2 instead of the previously bundled 3.10.1. The existing `^3.7.1`
dependency range permits both versions; no dependency manifest or lockfile change
is required.

Touch-origin compatibility mouse events are suppressed during a pending canvas
pan so the existing mouse handlers cannot bypass the 6 CSS-pixel threshold.
Below-threshold touches still deliver their click for deselection and editing.

Post-gesture suppression is limited to touch-origin activation/compatibility
events for 800 ms, matching pointer IDs or, for legacy mouse events, the release
position. Fresh touches clear it. Mouse, keyboard and external drop events do
not inherit it. Cancellation ends all active navigation; blur/disposal also
clear trailing-event records.

## Manual checks in a disposable Obsidian test vault

1. Open a copy of an existing mindmap. Drag empty canvas with one finger in all
   directions. Release outside the pane; the next gesture should work normally.
   Tap without moving, and with less than 6 pixels of jitter: selection should
   clear and edited text should finish saving. Dragging must not trigger that tap.
2. Pinch at the center and near each corner, including after mouse zoom. The map
   point under the midpoint should stay there. Check the 20% and 300% limits.
3. Translate two fingers together, then combine translation and pinch. Lift either
   finger and continue dragging; add it again. Check there are no sudden jumps.
   Repeat at 20% and 300%, and after pinching beyond either limit. Equal finger
   translation should retain the original zoom when both fingers have moved.
4. Start with one finger on a selected node, then add another. Pan/pinch over nodes,
   collapse buttons and links. Release both fingers: no move, copy, collapse,
   link opening, or edit should occur. Repeat with a third finger.
5. Tap nodes, double-click to edit, edit text, and drag/drop with the mouse. Check
   Ctrl-drag copying, undo/redo, keyboard shortcuts, wheel zoom and blank-canvas
   mouse panning. Check the existing single-touch node interactions too.
6. While a node is being edited, pinch and return to editing. Verify text and
   selection survive. Switch windows during a gesture, then return. Close/reopen
   the view and try gestures again.
7. Test in split panes and a pop-out window. Swipe in the sidebar and other views;
   their gestures should work as before. A touch starting outside the mindmap
   must not participate in its pinch gesture.
8. Compare Markdown before/after navigation alone: it must be unchanged. Edit a
   node, verify Markdown synchronization, reopen the file, and verify the edit.
9. Immediately after a pan/pinch, drag an XMind file from outside Obsidian onto
   empty canvas. Repeat after switching windows mid-gesture. Import should work
   without first clicking the canvas. Verify mouse and keyboard activation too.

Native HTML drag-and-drop may cancel the touch pointer stream once the OS has
already started a drag. Test adding a second finger both before and after a
long-press drag starts on the Z13; synthetic tests cannot establish OS behavior.
