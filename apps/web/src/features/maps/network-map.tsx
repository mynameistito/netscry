// oxlint-disable react/todo -- This browser-only dynamic import keeps MapLibre out of the server render.
import { EmptyState } from "@netscry/ui/components/empty-state";
import { ErrorState } from "@netscry/ui/components/error-state";
import { LoadingState } from "@netscry/ui/components/loading-state";
import type {
  MapControlsProps,
  MapMarkerProps,
  MapProps,
  MarkerContentProps,
  MarkerLabelProps,
} from "@netscry/ui/components/map";
import { MapPin } from "@netscry/ui/lib/icons";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface MapComponents {
  Map: ComponentType<MapProps>;
  MapControls: ComponentType<MapControlsProps>;
  MapMarker: ComponentType<MapMarkerProps>;
  MarkerContent: ComponentType<MarkerContentProps>;
  MarkerLabel: ComponentType<MarkerLabelProps>;
}

/** Coordinates and marker label for a location supported by a trusted source. */
export interface NetworkLocation {
  longitude: number;
  latitude: number;
  label: string;
}

interface LoadedMapProps {
  location: NetworkLocation;
}

interface NetworkMapProps {
  location: NetworkLocation | null;
  mapLabel?: string;
  caption?: ReactNode;
  emptyDescription?: string;
  screenReaderDescription?: string;
}

const mapStyles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const isValidLongitude = (longitude: number) =>
  Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

const isValidLatitude = (latitude: number) =>
  Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;

const isValidLocation = ({ longitude, latitude }: NetworkLocation) =>
  isValidLongitude(longitude) && isValidLatitude(latitude);

const LoadedNetworkMap = ({
  location,
  mapLabel,
  caption,
  screenReaderDescription,
}: LoadedMapProps & {
  mapLabel: string;
  caption: ReactNode;
  screenReaderDescription: string;
}) => {
  const [components, setComponents] = useState<MapComponents>();
  const [loadFailed, setLoadFailed] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mapContainerRef.current;

    let cancelled = false;

    const loadMap = () => {
      void import("@netscry/ui/components/map")
        .then((loadedComponents) => {
          if (!cancelled) {
            setComponents(loadedComponents);
          }

          return loadedComponents;
        })
        .catch(() => {
          if (!cancelled) {
            setLoadFailed(true);
          }
        });
    };

    let observer: IntersectionObserver | undefined;

    if (container && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting === true) {
            observer?.disconnect();
            loadMap();
          }
        },
        { rootMargin: "200px 0px" }
      );

      observer.observe(container);
    } else if (container) {
      loadMap();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  if (loadFailed) {
    return (
      <ErrorState
        description="The map could not load. Check the connection and reload this page to try again."
        title="Map unavailable"
      />
    );
  }

  if (components === undefined) {
    return (
      <div className="space-y-2" ref={mapContainerRef}>
        <LoadingState
          label="Loading approximate network location map"
          rows={2}
        />
      </div>
    );
  }

  const {
    Map: MapView,
    MapControls,
    MapMarker,
    MarkerContent,
    MarkerLabel,
  } = components;

  return (
    <div className="space-y-2" ref={mapContainerRef}>
      <section
        aria-label={mapLabel}
        className="border-border relative h-64 min-h-60 w-full overflow-hidden rounded-lg border sm:h-80"
      >
        <MapView
          attributionControl={false}
          center={[location.longitude, location.latitude]}
          dragRotate={false}
          styles={mapStyles}
          touchPitch={false}
          zoom={5}
        >
          <MapMarker
            anchor="bottom"
            latitude={location.latitude}
            longitude={location.longitude}
          >
            <MarkerContent>
              <details className="group relative">
                <summary
                  aria-label={`Show location details for ${location.label}`}
                  className="focus-visible:outline-ring bg-primary outline-primary/30 block size-5 cursor-pointer list-none rounded-full border-2 border-white outline outline-2 focus-visible:outline-4 [&::-webkit-details-marker]:hidden"
                />
                <div className="bg-background text-foreground absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 space-y-1 rounded-md border p-3 text-left shadow-md group-open:block">
                  <p className="text-sm font-medium">{location.label}</p>
                  <p className="text-muted-foreground text-xs leading-5">
                    {screenReaderDescription}
                  </p>
                </div>
              </details>
            </MarkerContent>
            <MarkerLabel>{location.label}</MarkerLabel>
          </MapMarker>
          <MapControls position="top-right" showCompass showZoom />
        </MapView>
        <div className="bg-background/90 text-muted-foreground absolute bottom-2 left-2 z-10 rounded px-2 py-1 text-xs backdrop-blur-xs">
          <a href="https://openfreemap.org/" rel="noreferrer" target="_blank">
            OpenFreeMap
          </a>{" "}
          © OpenMapTiles · Data from{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            OpenStreetMap
          </a>
        </div>
        <p className="sr-only">{screenReaderDescription}</p>
      </section>
      <p className="text-muted-foreground text-xs">{caption}</p>
    </div>
  );
};

/**
 * Renders an approximate network location only when real coordinates exist.
 * @returns A map, loading, empty, or invalid-data state.
 */
export const NetworkMap = ({
  location,
  mapLabel = "Approximate network location map",
  caption = "The map shows an approximate network location, not a device location. Your browser requests map tiles directly from OpenFreeMap.",
  emptyDescription = "A map appears when a supported source provides approximate network coordinates. NetScry does not use device location.",
  screenReaderDescription = "This is an approximate network location, not a device location.",
}: NetworkMapProps) => {
  if (location === null) {
    return (
      <EmptyState
        description={emptyDescription}
        icon={<MapPin aria-hidden="true" size={18} />}
        title="Location data unavailable"
      />
    );
  }

  if (!isValidLocation(location)) {
    return (
      <ErrorState
        description="The location source returned coordinates outside valid latitude or longitude bounds."
        title="Location could not be mapped"
      />
    );
  }

  return (
    <LoadedNetworkMap
      caption={caption}
      location={location}
      mapLabel={mapLabel}
      screenReaderDescription={screenReaderDescription}
    />
  );
};
