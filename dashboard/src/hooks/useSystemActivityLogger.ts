import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';

function safeSelector(el: Element | null): string | undefined {
  if (!el) return undefined;
  const htmlEl = el as HTMLElement;
  const id = htmlEl.id?.trim();
  if (id) return `#${id}`;
  const dataTestId = htmlEl.getAttribute('data-testid')?.trim();
  if (dataTestId) return `[data-testid="${dataTestId}"]`;
  const cls = typeof htmlEl.className === 'string' ? htmlEl.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
  const classPart = cls.length > 0 ? `.${cls.join('.')}` : '';
  return `${el.tagName.toLowerCase()}${classPart}`;
}

export function useSystemActivityLogger() {
  const location = useLocation();

  useEffect(() => {
    void api.logSystemEvent({
      event_type: 'page_load',
      page: window.location.pathname,
      message: 'Dashboard application loaded',
      details: { userAgent: navigator.userAgent },
    });
  }, []);

  useEffect(() => {
    void api.logSystemEvent({
      event_type: 'route_change',
      page: location.pathname,
      message: 'Route changed',
      details: { search: location.search || undefined },
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const selector = safeSelector(target);
      const text = target?.textContent?.trim().slice(0, 80);
      void api.logSystemEvent({
        event_type: 'click',
        page: window.location.pathname,
        message: 'Click interaction',
        details: {
          selector,
          text: text || undefined,
        },
      });
    };

    document.addEventListener('click', onClick, { passive: true });
    return () => document.removeEventListener('click', onClick);
  }, []);
}

