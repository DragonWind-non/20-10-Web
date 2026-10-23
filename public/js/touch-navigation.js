export function swipeDirection(dx, dy) {
  const horizontal = Math.abs(dx) > Math.abs(dy)*1.2;
  const vertical = Math.abs(dy) > Math.abs(dx)*1.2;
  if (horizontal && Math.abs(dx) >= 48) return dx < 0 ? 1 : -1;
  if (vertical && Math.abs(dy) >= 48) return dy < 0 ? 1 : -1;
  return 0;
}

export function bindTouchNavigation(root, { onTap, onSwipe, isControlTarget }) {
  let gesture = null, lastTouch = null;
  const controls = 'button, a, input, textarea, select, [contenteditable="true"], .vinyl-dock, #season-stepper, #prop-letter, #prop-toast, #finale-ritual';
  root.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    gesture = null;
    if (!event.isPrimary) return;
    if (event.target.closest(controls)) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0,
      reading: Boolean(event.target.closest('.narrative-card, .wishes-stream-column, .wishes-stream-scroll')) };
  }, { passive: true });
  root.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    gesture.distance = Math.max(gesture.distance, Math.hypot(event.clientX-gesture.x, event.clientY-gesture.y));
  }, { passive: true });
  root.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch') return;
    lastTouch = { x: event.clientX, y: event.clientY, until: performance.now()+800 };
    if (!gesture || gesture.id !== event.pointerId) return;
    const start = gesture;
    gesture = null;
    const dx = event.clientX-start.x, dy = event.clientY-start.y;
    const distance = Math.max(start.distance, Math.hypot(dx, dy));
    if (distance <= 18) {
      if (!isControlTarget(event.target)) onTap(event.clientX, event.clientY);
      return;
    }
    const direction = swipeDirection(dx, dy);
    if (direction && (!start.reading || Math.abs(dx) > Math.abs(dy)*1.2)) onSwipe(direction);
  }, { passive: true });
  root.addEventListener('pointercancel', event => {
    if (gesture?.id === event.pointerId) gesture = null;
  }, { passive: true });
  return {
    isActive: () => gesture !== null,
    shouldIgnoreClick(event) {
      if (!lastTouch || performance.now() >= lastTouch.until || event.detail === 0) return false;
      if (event.pointerType && event.pointerType !== 'touch') return false;
      return Math.hypot(event.clientX-lastTouch.x, event.clientY-lastTouch.y) < 32;
    }
  };
}
