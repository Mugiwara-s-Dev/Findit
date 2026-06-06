"use client";

import { useEffect, useRef } from "react";
import { Icon, LatLngBounds } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import styles from "./findit-dashboard.module.css";
import storePin from "@/assets/Pin_tienda.png";
import storePinBlue from "@/assets/pin_tienda_azul.png";
import type { ShoppingStop, StoreSummary } from "@/lib/types";

type FindItMapProps = {
  center: {
    latitude: number;
    longitude: number;
  };
  centerLabel: string;
  stores: StoreSummary[];
  viewportStores: StoreSummary[];
  selectedStoreId: number | null;
  viewportVersion: number;
  onSelectStore: (storeId: number) => void;
  draftLocation: {
    latitude: number;
    longitude: number;
  } | null;
  allowDraftPlacement: boolean;
  onMapDoubleClick: (location: { latitude: number; longitude: number }) => void;
  shoppingRouteCoordinates: Array<[number, number]>;
  shoppingTravelMode: "DRIVING" | "WALKING";
  shoppingStops: ShoppingStop[];
};

const fallbackCenter: [number, number] = [1.23207, -77.29295];
const cartoAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const storeMarkerIcon = new Icon({
  iconUrl: storePinBlue.src,
  iconSize: [30, 42],
  iconAnchor: [15, 40],
  popupAnchor: [0, -34],
  className: "findit-store-pin",
});
const selectedStoreMarkerIcon = new Icon({
  iconUrl: storePin.src,
  iconSize: [36, 50],
  iconAnchor: [18, 48],
  popupAnchor: [0, -40],
  className: "findit-store-pin findit-store-pin-selected",
});
const draftStoreIcon = new Icon({
  iconUrl: storePin.src,
  iconSize: [38, 52],
  iconAnchor: [19, 50],
  popupAnchor: [0, -44],
  className: "findit-store-pin findit-store-pin-draft",
});

export function FindItMap({
  center,
  centerLabel,
  stores,
  viewportStores,
  selectedStoreId,
  viewportVersion,
  onSelectStore,
  draftLocation,
  allowDraftPlacement,
  onMapDoubleClick,
  shoppingRouteCoordinates,
  shoppingTravelMode,
  shoppingStops,
}: FindItMapProps) {
  const activeCenter: [number, number] = center
    ? [center.latitude, center.longitude]
    : fallbackCenter;

  return (
    <MapContainer
      center={activeCenter}
      zoom={13}
      className={styles.leafletMap}
      scrollWheelZoom
      doubleClickZoom={false}
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution={cartoAttribution}
        subdomains="abcd"
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
      />
      <TileLayer
        attribution={cartoAttribution}
        subdomains="abcd"
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
      />
      <MapViewport center={activeCenter} stores={viewportStores} viewportVersion={viewportVersion} />
      <MapDoubleClickHandler
        allowDraftPlacement={allowDraftPlacement}
        onMapDoubleClick={onMapDoubleClick}
      />

      <CircleMarker
        center={activeCenter}
        radius={10}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#0f766e",
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>
          <strong>{centerLabel}</strong>
          <br />
          Centro actual para buscar tiendas cercanas.
        </Popup>
      </CircleMarker>

      {draftLocation ? (
        <Marker
          position={[draftLocation.latitude, draftLocation.longitude]}
          icon={draftStoreIcon}
        >
          <Popup>
            <strong>Abre tu negocio en FindIt</strong>
            <br />
            Completa el formulario para registrar esta tienda.
          </Popup>
        </Marker>
      ) : null}

      {shoppingRouteCoordinates.length > 1 ? (
        <Polyline
          positions={shoppingRouteCoordinates}
          pathOptions={{
            color: shoppingTravelMode === "WALKING" ? "#0f766e" : "#ea580c",
            weight: 5,
            opacity: 0.85,
            dashArray: shoppingTravelMode === "WALKING" ? "12 10" : undefined,
          }}
        />
      ) : null}

      {shoppingStops.map((stop, index) => (
        <CircleMarker
          key={`shopping-stop-${stop.storeId}`}
          center={[stop.latitude, stop.longitude]}
          radius={12}
          pathOptions={{
            color: "#fff7ed",
            fillColor: "#ea580c",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            <strong>{`Parada ${index + 1}: ${stop.storeName}`}</strong>
            <br />
            {stop.products.length} productos en esta tienda.
          </Popup>
        </CircleMarker>
      ))}

      {stores.map((store) => {
        const isSelected = store.id === selectedStoreId;

        return (
          <Marker
            key={store.id}
            position={[store.latitude, store.longitude]}
            icon={isSelected ? selectedStoreMarkerIcon : storeMarkerIcon}
            eventHandlers={{ click: () => onSelectStore(store.id) }}
          >
            <Popup>
              <strong>{store.name}</strong>
              <br />
              {store.category}
              <br />
              {store.address}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function MapViewport({
  center,
  stores,
  viewportVersion,
}: {
  center: [number, number];
  stores: StoreSummary[];
  viewportVersion: number;
}) {
  const map = useMap();
  const lastViewportVersionRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastViewportVersionRef.current === viewportVersion) {
      return;
    }

    lastViewportVersionRef.current = viewportVersion;

    if (stores.length === 0) {
      map.setView(center, 13, { animate: true });
      return;
    }

    const bounds = new LatLngBounds(center, center);
    stores.forEach((store) => {
      bounds.extend([store.latitude, store.longitude]);
    });

    map.fitBounds(bounds.pad(0.18), {
      animate: true,
      padding: [24, 24],
    });
  }, [center, map, stores, viewportVersion]);

  return null;
}

function MapDoubleClickHandler({
  allowDraftPlacement,
  onMapDoubleClick,
}: Pick<FindItMapProps, "allowDraftPlacement" | "onMapDoubleClick">) {
  const map = useMapEvents({
    dblclick(event) {
      if (!allowDraftPlacement) {
        return;
      }

      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
      onMapDoubleClick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  useEffect(() => {
    map.doubleClickZoom.disable();
  }, [map]);

  return null;
}
