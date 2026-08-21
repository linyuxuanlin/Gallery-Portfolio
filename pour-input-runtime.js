export function createPointerInputRuntime() {
  let activePointerId = null;
  let pointerType = null;
  let pouring = false;

  const snapshot = () => ({
    activePointerId,
    pointerType,
    pouring,
    hasActivePointer: activePointerId !== null,
  });

  function isEligibleDown(event = {}) {
    const type = event.pointerType || 'mouse';
    if (activePointerId !== null) return false;
    if (event.isPrimary === false) return false;
    if (type === 'mouse' && event.button !== undefined && event.button !== 0) return false;
    return Number.isFinite(event.pointerId);
  }

  function pointerDown(event = {}) {
    if (!isEligibleDown(event)) {
      return { accepted: false, shouldCapture: false, state: snapshot() };
    }
    activePointerId = event.pointerId;
    pointerType = event.pointerType || 'mouse';
    pouring = true;
    return {
      accepted: true,
      shouldCapture: true,
      pointerId: activePointerId,
      state: snapshot(),
    };
  }

  function pointerMove(event = {}) {
    const accepted = activePointerId !== null && event.pointerId === activePointerId;
    return { accepted, state: snapshot() };
  }

  function endPointer(event = {}, reason = 'up') {
    if (activePointerId === null || event.pointerId !== activePointerId) {
      return { accepted: false, stopped: false, reason, state: snapshot() };
    }
    const releasedPointerId = activePointerId;
    activePointerId = null;
    pointerType = null;
    pouring = false;
    return {
      accepted: true,
      stopped: true,
      reason,
      releasedPointerId,
      state: snapshot(),
    };
  }

  function pointerUp(event = {}) {
    return endPointer(event, 'up');
  }

  function pointerCancel(event = {}) {
    return endPointer(event, 'cancel');
  }

  function lostPointerCapture(event = {}) {
    return endPointer(event, 'lost-capture');
  }

  function suspend(reason = 'suspend') {
    const releasedPointerId = activePointerId;
    const stopped = pouring || activePointerId !== null;
    activePointerId = null;
    pointerType = null;
    pouring = false;
    return { stopped, reason, releasedPointerId, state: snapshot() };
  }

  function reset() {
    activePointerId = null;
    pointerType = null;
    pouring = false;
    return snapshot();
  }

  return {
    snapshot,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    lostPointerCapture,
    suspend,
    reset,
  };
}
