# Touchscreen navigation validation

The mindmap renders HTML nodes and SVG.js edges. Touch navigation reuses
MindMap.scale() (20–300%) and containerEL scroll offsets. It does not change
Markdown serialization, editing commands, history, or file formats.

Run with Node.js and the repository dependencies installed:

    npm run build
    npx tsc --noEmit
    node --test tests/touch-navigation.cjs

The regression tests use a simulated viewport plus the existing click/selection
methods; they do not replace hardware tests. There are 22 cases covering taps,
the 6 CSS-pixel pan threshold, both zoom limits and pointer event orders,
midpoint anchoring, finger-count transitions, cancellation, trailing touch
activation, external drops, and disposal. Native capture, layout/scroll bounds,
Obsidian editing, and native drag-and-drop still require the checks below.

## Source-only PR and build output

Upstream has mixed history: older PRs included `main.js`, but the latest merged
zoom-shortcut change (`7b37041`, merged by `1f5b100` / PR #174) changed only source
and README files. `main.js` is also listed in `.gitignore`, although an older
copy remains tracked. This patch follows that source-only precedent.

`npm run build` overwrites the repository bundle. It picks up existing upstream
zoom commands missing from that old bundle, whitespace differences, and JSZip
3.10.2 instead of the previously bundled 3.10.1. The existing `^3.7.1` dependency
range permits both versions; no dependency manifest change caused this update.
Do not include those generated differences in the touch-navigation PR. No
dependency downgrade or lockfile rewrite is required. Build output was checked,
then the working-tree bundle was restored to upstream; any previously staged
bundle must still be unstaged before committing.

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
