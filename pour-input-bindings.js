import { createPointerInputRuntime } from './pour-input-runtime.js';

export function bindPourPointerInput(element, {
  onStart = () => {},
  onMove = () => {},
  onStop = () => {},
  canStart = () => true,
} = {}) {
  if (!element?.addEventListener) throw new TypeError('element must support addEventListener');
  const runtime = createPointerInputRuntime();

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
    if (!result.accepted && !result.stopped) return;
    onStop(event, result.state, reason || result.reason);
  };

  const handleUp = (event) => stopWith('pointerUp', event, 'up');
  const handleCancel = (event) => stopWith('pointerCancel', event, 'cancel');
  const handleLostCapture = (event) => stopWith('lostPointerCapture', event, 'lost-capture');

  element.addEventListener('pointerdown', handleDown);
  element.addEventListener('pointermove', handleMove);
  element.addEventListener('pointerup', handleUp);
  element.addEventListener('pointercancel', handleCancel);
  element.addEventListener('lostpointercapture', handleLostCapture);

  function suspend(reason = 'suspend') {
    const result = runtime.suspend(reason);
    if (result.stopped) onStop(null, result.state, reason);
    return result;
  }

  function destroy() {
    element.removeEventListener('pointerdown', handleDown);
    element.removeEventListener('pointermove', handleMove);
    element.removeEventListener('pointerup', handleUp);
    element.removeEventListener('pointercancel', handleCancel);
    element.removeEventListener('lostpointercapture', handleLostCapture);
    suspend('destroy');
  }

  return { runtime, suspend, destroy };
}
