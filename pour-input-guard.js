// Capture-phase safety net for the current canvas event layer.
// It prevents secondary pointers from reaching legacy handlers and converts
// lost pointer capture into a pointercancel that the page already understands.
export function bindLegacyPointerGuard(element) {
  if (!element?.addEventListener) throw new TypeError('element must support addEventListener');

  let activePointerId = null;
  let activePointerType = null;

  const stopSecondary = (event) => {
    if (activePointerId === null || event.pointerId === activePointerId) return false;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    return true;
  };

  const onDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      return;
    }
    if (activePointerId !== null) {
      stopSecondary(event);
      return;
    }
    activePointerId = event.pointerId;
    activePointerType = event.pointerType || 'unknown';
  };

  const onMove = (event) => {
    stopSecondary(event);
  };

  const releaseIfActive = (event) => {
    if (stopSecondary(event)) return;
    if (event.pointerId === activePointerId) {
      activePointerId = null;
      activePointerType = null;
    }
  };

  const dispatchCancel = (pointerId, pointerType = 'touch') => {
    let cancelEvent;
    try {
      cancelEvent = new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType,
      });
    } catch {
      cancelEvent = new Event('pointercancel', { bubbles: true, cancelable: true });
      Object.defineProperty(cancelEvent, 'pointerId', { value: pointerId });
    }
    element.dispatchEvent?.(cancelEvent);
  };

  const onLostCapture = (event) => {
    if (event.pointerId !== activePointerId) return;
    const pointerId = activePointerId;
    const pointerType = activePointerType || event.pointerType || 'touch';
    activePointerId = null;
    activePointerType = null;
    dispatchCancel(pointerId, pointerType);
  };

  element.addEventListener('pointerdown', onDown, true);
  element.addEventListener('pointermove', onMove, true);
  element.addEventListener('pointerup', releaseIfActive, true);
  element.addEventListener('pointercancel', releaseIfActive, true);
  element.addEventListener('lostpointercapture', onLostCapture, true);

  function suspend() {
    if (activePointerId === null) return false;
    const pointerId = activePointerId;
    const pointerType = activePointerType || 'touch';
    activePointerId = null;
    activePointerType = null;
    dispatchCancel(pointerId, pointerType);
    return true;
  }

  function snapshot() {
    return { activePointerId, activePointerType, active: activePointerId !== null };
  }

  function destroy() {
    element.removeEventListener('pointerdown', onDown, true);
    element.removeEventListener('pointermove', onMove, true);
    element.removeEventListener('pointerup', releaseIfActive, true);
    element.removeEventListener('pointercancel', releaseIfActive, true);
    element.removeEventListener('lostpointercapture', onLostCapture, true);
    activePointerId = null;
    activePointerType = null;
  }

  return { suspend, snapshot, destroy };
}

export function installLegacyPointerGuard(root = globalThis.document) {
  const canvas = root?.querySelector?.('canvas');
  if (!canvas || canvas.__pourInputGuard) return canvas?.__pourInputGuard || null;
  const guard = bindLegacyPointerGuard(canvas);
  const view = root.defaultView || globalThis.window;
  const onVisibility = () => { if (root.hidden) guard.suspend(); };
  const onBlur = () => guard.suspend();
  root.addEventListener?.('visibilitychange', onVisibility);
  view?.addEventListener?.('blur', onBlur);
  const destroyBase = guard.destroy;
  guard.destroy = () => {
    root.removeEventListener?.('visibilitychange', onVisibility);
    view?.removeEventListener?.('blur', onBlur);
    destroyBase();
    try { delete canvas.__pourInputGuard; } catch {}
  };
  Object.defineProperty(canvas, '__pourInputGuard', { value: guard, configurable: true });
  return guard;
}
