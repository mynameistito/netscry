interface NearViewportObserver {
  observe: (element: Element) => void;
  disconnect: () => void;
}

type ObserverFactory = (
  onIntersection: (isIntersecting: boolean) => void,
  rootMargin: string
) => NearViewportObserver;

const createBrowserObserver: ObserverFactory = (onIntersection, rootMargin) =>
  new IntersectionObserver(
    ([entry]) => {
      onIntersection(entry?.isIntersecting === true);
    },
    { rootMargin }
  );

/** Observes a map frame and loads its contents near the viewport.
 * @param element - The frame whose proximity controls loading.
 * @param onVisible - The map loader to invoke after intersection.
 * @param observerFactory - Optional observer creator used by deterministic tests.
 * @returns A cleanup function that disconnects the observer.
 */
export const observeMapNearViewport = (
  element: Element,
  onVisible: () => void,
  observerFactory: ObserverFactory = createBrowserObserver
) => {
  const observer = observerFactory((isIntersecting) => {
    if (isIntersecting) {
      observer.disconnect();
      onVisible();
    }
  }, "200px 0px");

  observer.observe(element);

  return () => {
    observer.disconnect();
  };
};
