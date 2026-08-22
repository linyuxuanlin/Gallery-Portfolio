import { createPointerInputRuntime } from './pour-input-runtime.js';

export function bindPourPointerInput(element, {
  onStart = () => {},
  onMove = () => {},
  onStop = () => {},
  canStart = () => true,
  windowTarget = globalThis.window,
} = {}) {
  if (!element?.addEventListener) throw new TypeError('element must support addEventListener');
  const runtime = createPointerInputRuntime();

  const releaseCapture = (pointerId) => {
    if (!Number.isFinite(pointerId) || !element.releasePointerCapture) return;
    try {
      if (!element.hasPointerCapture || element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch {}
  };

  const handleDown = (event) => {
    if (!canStart(event)) return;
    const result = runtime.pointerDown(event);
    if (!result.accepted) return;
    if (result.shouldCapture && element.setPointerCapture) {
      try { element.setPointerCapture(result.pointerId); } catch {}
    }
    onStart(event, result.state);
  };

  const handleMove = (event) => {
    const result = runtime.pointerMove(event);
    if (!result.accepted) return;
    onMove(event, result.state);
  };

  const stopWith = (method, event, reason) => {
    const result = runtime[method](event);
    if (!result.accepted && !result.stopped) return result;
    releaseCapture(result.releasedPointerId);
    onStop(event, result.state, reason || result.reason);
    return result;
  };

  const handleUp = (event) => stopWith('pointerUp', event, 'up');
  const handleCancel = (event) => stopWith('pointerCancel', event, 'cancel');
  const handleLostCapture = (event) => stopWith('lostPointerCapture', event, 'lost-capture');
  const handleWindowEnd = (event) => {
    if (event?.target === element || event?.composedPath?.().includes?.(element)) return;
    const state = runtime.snapshot();
    if (!state.hasActivePointer || event?.pointerId !== state.activePointerId) return;
    stopWith('pointerCancel', event, 'off-canvas');
  };

  element.addEventListener('pointerdown', handleDown);
  element.addEventListener('pointermove', handleMove);
  element.addEventListener('pointerup', handleUp);
  element.addEventListener('pointercancel', handleCancel);
  element.addEventListener('lostpointercapture', handleLostCapture);
  windowTarget?.addEventListener?.('pointerup', handleWindowEnd, true);
  windowTarget?.addEventListener?.('pointercancel', handleWindowEnd, true);

  function suspend(reason = 'suspend') {
    const result = runtime.suspend(reason);
    releaseCapture(result.releasedPointerId);
    if (result.stopped) onStop(null, result.state, reason);
    return result;
  }

  function destroy() {
    element.removeEventListener('pointerdown', handleDown);
    element.removeEventListener('pointermove', handleMove);
    element.removeEventListener('pointerup', handleUp);
    element.removeEventListener('pointercancel', handleCancel);
    element.removeEventListener('lostpointercapture', handleLostCapture);
    windowTarget?.removeEventListener?.('pointerup', handleWindowEnd, true);
    windowTarget?.removeEventListener?.('pointercancel', handleWindowEnd, true);
    suspend('destroy');
  }

  return { runtime, suspend, destroy };
}
