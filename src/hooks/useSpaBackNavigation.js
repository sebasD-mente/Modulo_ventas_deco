import { useEffect, useRef } from 'react';

const modalClosersStack = [];

function ensureHistoryGuard() {
  if (typeof window === 'undefined' || !window.history) return;
  try {
    if (!window.history.state || !window.history.state.dekoGuard) {
      window.history.pushState({ dekoGuard: true, ts: Date.now() }, '', window.location.href);
    }
  } catch (_) {}
}

/**
 * Registra una ventana emergente (modal) en la pila LIFO para que el botón "Atrás"
 * del navegador o móvil cierre primero el modal activo sin salir de la aplicación.
 */
export function useModalBackHandler(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    ensureHistoryGuard();

    const entry = {
      close: () => {
        if (typeof onCloseRef.current === 'function') {
          onCloseRef.current();
        }
      },
    };
    modalClosersStack.push(entry);

    return () => {
      const idx = modalClosersStack.lastIndexOf(entry);
      if (idx !== -1) {
        modalClosersStack.splice(idx, 1);
      }
    };
  }, [isOpen]);
}

/**
 * Intenta cerrar cualquier modal .fixed.inset-0 o drawer abierto en el DOM
 * que no haya sido registrado explícitamente en modalClosersStack.
 */
function closeTopDomOverlayIfPresent() {
  if (typeof document === 'undefined') return false;

  const modals = Array.from(document.querySelectorAll('.fixed.inset-0'));
  if (modals.length > 0) {
    const topModal = modals[modals.length - 1];
    const explicitCloseBtn = topModal.querySelector('[data-modal-close="true"]');
    if (explicitCloseBtn) {
      explicitCloseBtn.click();
      return true;
    }

    const buttons = Array.from(topModal.querySelectorAll('button'));
    const xBtn = buttons.find((btn) => btn.querySelector('svg.lucide-x'));
    if (xBtn) {
      xBtn.click();
      return true;
    }

    const cancelBtn = buttons.find((btn) => /^(cancelar|cerrar)$/i.test((btn.textContent || '').trim()));
    if (cancelBtn) {
      cancelBtn.click();
      return true;
    }
  }

  const drawerCloseBtn = document.querySelector('button[aria-label="Cerrar menú"]');
  if (drawerCloseBtn) {
    drawerCloseBtn.click();
    return true;
  }

  return false;
}

/**
 * Guardia global de navegación SPA para el botón "Atrás" (físico/navegador).
 * Prioridad al presionar "Atrás":
 * 1. Cerrar modal registrado en modalClosersStack.
 * 2. Cerrar cualquier modal .fixed.inset-0 o menú abierto en el DOM.
 * 3. Si está en una pestaña secundaria (ej. eventos, monitor, cierre), volver a homeTab ('venta').
 * 4. Si ya está en homeTab, mantener al usuario dentro de la app sin expulsarlo al sitio previo.
 */
export function useSpaBackNavigation({ activeTab, setActiveTab, homeTab = 'venta', enabled = true }) {
  const activeTabRef = useRef(activeTab);
  const homeTabRef = useRef(homeTab);
  const setActiveTabRef = useRef(setActiveTab);

  activeTabRef.current = activeTab;
  homeTabRef.current = homeTab;
  setActiveTabRef.current = setActiveTab;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    try {
      window.history.replaceState({ dekoRoot: true }, '', window.location.href);
      window.history.pushState({ dekoGuard: true, ts: Date.now() }, '', window.location.href);
    } catch (_) {}

    const handlePopState = () => {
      try {
        window.history.pushState({ dekoGuard: true, ts: Date.now() }, '', window.location.href);
      } catch (_) {}

      // 1. Cerrar modal registrado en la pila LIFO
      if (modalClosersStack.length > 0) {
        const topEntry = modalClosersStack.pop();
        if (topEntry && typeof topEntry.close === 'function') {
          topEntry.close();
          return;
        }
      }

      // 2. Cerrar cualquier otro modal .fixed.inset-0 o drawer abierto en el DOM
      if (closeTopDomOverlayIfPresent()) {
        try {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        } catch (_) {}
        return;
      }

      // 3. Si está en una pestaña secundaria, regresar a la pestaña principal (venta)
      if (activeTabRef.current !== homeTabRef.current && typeof setActiveTabRef.current === 'function') {
        setActiveTabRef.current(homeTabRef.current);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    ensureHistoryGuard();
  }, [activeTab, enabled]);
}

export default useSpaBackNavigation;
