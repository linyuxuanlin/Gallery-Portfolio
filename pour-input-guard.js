// Capture-phase safety net for the current canvas event layer.
// It prevents secondary pointers from reaching legacy handlers, converts
// capture loss into pointercancel, and catches releases that land off-canvas.
export function bindLegacyPointerGuard(element, { view = globalThis.window } = {}) {
  if (!element?.addEventListener) throw new TypeError('element must support addEventListener');

  let activePointerId = null;
  let activePointerType = null;

  const stopEvent = (event) => {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  };

  const stopSecondary = (event) => {
    if (activePointerId === null || event.pointerId === activePointerId) return false;
    stopEvent(event);
    return true;
  };

  const onDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      stopEvent(event);
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
      Object.defineProperty(cancelEvent, 'pointerType', { value: pointerType });
    }
    element.dispatchEvent?.(cancelEvent);
  };

  const releaseCapture = (pointerId) => {
    if (typeof element.hasPointerCapture !== 'function' || typeof element.releasePointerCapture !== 'function') return;
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    } catch {}
  };

  const cancelActive = () => {
    if (activePointerId === null) return false;
    const pointerId = activePointerId;
    const pointerType = activePointerType || 'touch';
    // Clear first so a synchronous lostpointercapture caused by release does not
    // recursively dispatch a second synthetic cancel.
    activePointerId = null;
    activePointerType = null;
    releaseCapture(pointerId);
    dispatchCancel(pointerId, pointerType);
    return true;
  };

  const onLostCapture = (event) => {
    if (event.pointerId !== activePointerId) return;
    cancelActive();
  };

  const eventReachedCanvas = (event) => {
    if (event.target === element) return true;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : null;
    return Array.isArray(path) && path.includes(element);
  };

  // Some mobile browsers can deliver the final pointerup/cancel to window
  // when capture is interrupted by browser chrome or a system gesture.
  // Window capture runs before canvas capture, so ignore releases whose event
  // path already includes the canvas; those are normal releases, not fallbacks.
  const onWindowRelease = (event) => {
    if (event.pointerId !== activePointerId || eventReachedCanvas(event)) return;
    cancelActive();
  };

  // If capture never became active, leaving the canvas should not leave the
  // legacy page in a permanent pouring state. Mouse hover is intentionally
  // ignored because desktop users can leave/re-enter while holding capture.
  const onPointerLeave = (event) => {
    if (event.pointerId !== activePointerId || event.pointerType === 'mouse') return;
    const hasCapture = typeof element.hasPointerCapture === 'function'
      ? element.hasPointerCapture(event.pointerId)
      : false;
    if (!hasCapture) cancelActive();
  };

  const preventGesture = (event) => {
    // Canvas is an interaction surface, not selectable/draggable content.
    event.preventDefault?.();
  };

  element.addEventListener('pointerdown', onDown, true);
  element.addEventListener('pointermove', onMove, true);
  element.addEventListener('pointerup', releaseIfActive, true);
  element.addEventListener('pointercancel', releaseIfActive, true);
  element.addEventListener('lostpointercapture', onLostCapture, true);
  element.addEventListener('pointerleave', onPointerLeave, true);
  element.addEventListener('contextmenu', preventGesture, true);
  element.addEventListener('dragstart', preventGesture, true);
  element.addEventListener('selectstart', preventGesture, true);
  view?.addEventListener?.('pointerup', onWindowRelease, true);
  view?.addEventListener?.('pointercancel', onWindowRelease, true);

  function suspend() {
    return cancelActive();
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
    element.removeEventListener('pointerleave', onPointerLeave, true);
    element.removeEventListener('contextmenu', preventGesture, true);
    element.removeEventListener('dragstart', preventGesture, true);
    element.removeEventListener('selectstart', preventGesture, true);
    view?.removeEventListener?.('pointerup', onWindowRelease, true);
    view?.removeEventListener?.('pointercancel', onWindowRelease, true);
    if (activePointerId !== null) releaseCapture(activePointerId);
    activePointerId = null;
    activePointerType = null;
  }

  return { suspend, snapshot, destroy };
}

export function installLegacyPointerGuard(root = globalThis.document) {
  const canvas = root?.querySelector?.('canvas');
  if (!canvas || canvas.__pourInputGuard) return canvas?.__pourInputGuard || null;
  const view = root.defaultView || globalThis.window;
  const guard = bindLegacyPointerGuard(canvas, { view });
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
