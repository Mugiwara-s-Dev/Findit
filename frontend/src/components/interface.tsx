"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BarcodeScannerSheet } from "./barcode-scanner-sheet";
import { parseProductCsvRows, resolveImportedProductRow } from "./findit-dashboard-csv";
import styles from "./findit-dashboard.module.css";
import { apiFetch, clearStoredSession, readStoredSession, writeStoredSession } from "@/lib/api";
import type {
  AuthSession,
  BarcodeLookupResult,
  ProductCategory,
  ProductSummary,
  SavedShoppingList,
  SearchOption,
  ShoppingPlan,
  ShoppingStop,
  StoreCategory,
  StoreDetail,
  StoreSummary,
  UserAccount,
} from "@/lib/types";

const FindItMap = dynamic(
  () => import("./findit-map").then((module) => module.FindItMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Cargando mapa...</div>,
  },
);

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const drivingRouteServiceUrl = "https://router.project-osrm.org/route/v1/driving";
const walkingRouteServiceUrl = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";

const defaultUser = {
  preferredLatitude: 1.23207,
  preferredLongitude: -77.29295,
};

const defaultSearchRadiusKm = 10;
const storeCategoryOptions: Array<{ value: StoreCategory; label: string }> = [
  { value: "MINIMARKET", label: "Minimercado" },
  { value: "GROCERY", label: "Tienda de viveres" },
  { value: "PHARMACY", label: "Drogueria" },
  { value: "HARDWARE", label: "Ferreteria" },
  { value: "BAKERY", label: "Panaderia" },
  { value: "PET_SHOP", label: "Mascotas" },
];
const productCategoryOptions: Array<{ value: ProductCategory; label: string }> = [
  { value: "FOOD", label: "Alimentos" },
  { value: "BEVERAGE", label: "Bebidas" },
  { value: "HEALTH", label: "Salud" },
  { value: "HOME", label: "Hogar" },
  { value: "PETS", label: "Mascotas" },
  { value: "PERSONAL_CARE", label: "Cuidado personal" },
];

// ## LOGIN

const emptyLogin = {
  email: "admin@findit.local",
  password: "secret123",
};

const emptySignup = {
  fullName: "",
  email: "",
  password: "",
};

const emptyStoreForm = {
  name: "",
  category: "MINIMARKET" as StoreCategory,
};

type ProductFormState = {
  name: string;
  brandName: string;
  category: ProductCategory;
  unit: string;
  barcode: string;
  price: string;
};

const emptyProductForm: ProductFormState = {
  name: "",
  brandName: "",
  category: "FOOD" as ProductCategory,
  unit: "",
  barcode: "",
  price: "",
};

type AuthMode = "login" | "signup";
type DashboardModule = "EXPLORE" | "OPEN_STORE" | "SHOPPING" | "MY_BUSINESSES";
type BusinessSection = "INVENTORY" | "MY_PRODUCTS" | "DETAILS";
type InventoryCategoryFilter = ProductCategory | "ALL";

type MapLocation = {
  latitude: number;
  longitude: number;
  source: "gps" | "saved";
};

type DraftPhoto = {
  filename: string;
  contentType: string;
  imageDataUrl: string;
};

type DraftStore = {
  latitude: number;
  longitude: number;
};

type ShoppingDraftItem = {
  id: string;
  query: string;
};

type ShoppingTravelMode = "DRIVING" | "WALKING";
type ShoppingWorkflowStep = "TRANSPORT" | "SOURCE" | "ITEMS" | "OPTIONS" | "ROUTE" | "SUMMARY";
type ShoppingListSource = "NEW" | "SAVED" | null;
type NotificationTone = "error";

type DashboardNotification = {
  id: number;
  tone: NotificationTone;
  title: string;
  message: string;
};

export function FindItDashboard() {
  const [isReady, setIsReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [areMapPanelsOpen, setAreMapPanelsOpen] = useState(false);
  const [module, setModule] = useState<DashboardModule>("EXPLORE");
  const [mapLocation, setMapLocation] = useState<MapLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [isDeletingStore, setIsDeletingStore] = useState(false);
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [login, setLogin] = useState(emptyLogin);
  const [loginMessage, setLoginMessage] = useState<string | null>("Bienvenido. Inicia sesion para continuar.");
  const [signup, setSignup] = useState(emptySignup);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [nearbyStores, setNearbyStores] = useState<StoreSummary[]>([]);
  const [managedStores, setManagedStores] = useState<StoreSummary[]>([]);
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [status, setStatus] = useState("Mapa listo.");
  const [error, setError] = useState<string | null>(null);
  const [draftStore, setDraftStore] = useState<DraftStore | null>(null);
  const [storeLocationEditTargetId, setStoreLocationEditTargetId] = useState<number | null>(null);
  const [newStoreForm, setNewStoreForm] = useState(emptyStoreForm);
  const [newStorePhotos, setNewStorePhotos] = useState<DraftPhoto[]>([]);
  const [businessForm, setBusinessForm] = useState(emptyStoreForm);
  const [businessPhotos, setBusinessPhotos] = useState<DraftPhoto[]>([]);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productImage, setProductImage] = useState<DraftPhoto | null>(null);
  const [editingInventoryItemId, setEditingInventoryItemId] = useState<number | null>(null);
  const [businessSection, setBusinessSection] = useState<BusinessSection>("INVENTORY");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<InventoryCategoryFilter>("ALL");
  const [shoppingList, setShoppingList] = useState<ShoppingDraftItem[]>([{ id: "item-1", query: "" }]);
  const [shoppingListName, setShoppingListName] = useState("");
  const [savedShoppingLists, setSavedShoppingLists] = useState<SavedShoppingList[]>([]);
  const [activeSavedShoppingListId, setActiveSavedShoppingListId] = useState<number | null>(null);
  const [shoppingSuggestions, setShoppingSuggestions] = useState<Record<string, ProductSummary[]>>({});
  const [shoppingSuggestionsLoading, setShoppingSuggestionsLoading] = useState<Record<string, boolean>>({});
  const [activeShoppingItemId, setActiveShoppingItemId] = useState<string | null>(null);
  const [shoppingTravelMode, setShoppingTravelMode] = useState<ShoppingTravelMode>("DRIVING");
  const [shoppingWorkflowStep, setShoppingWorkflowStep] = useState<ShoppingWorkflowStep>("TRANSPORT");
  const [shoppingListSource, setShoppingListSource] = useState<ShoppingListSource>(null);
  const [shoppingPlan, setShoppingPlan] = useState<ShoppingPlan | null>(null);
  const [selectedShoppingOptions, setSelectedShoppingOptions] = useState<Record<string, number | null>>({});
  const [resolvedShoppingRoute, setResolvedShoppingRoute] = useState<{
    key: string;
    coordinates: Array<[number, number]>;
  }>({
    key: "",
    coordinates: [],
  });
  const [isPlanningShopping, setIsPlanningShopping] = useState(false);
  const [isLoadingShoppingRoute, setIsLoadingShoppingRoute] = useState(false);
  const [isLoadingSavedShoppingLists, setIsLoadingSavedShoppingLists] = useState(false);
  const [isSavingSavedShoppingList, setIsSavingSavedShoppingList] = useState(false);
  const [deletingSavedShoppingListId, setDeletingSavedShoppingListId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [viewportVersion, setViewportVersion] = useState(0);
  const selectedStoreIdRef = useRef<number | null>(null);
  const shoppingItemSequenceRef = useRef(2);
  const shoppingSuggestionTimeoutsRef = useRef<Record<string, number>>({});
  const shoppingSuggestionRequestRef = useRef<Record<string, number>>({});
  const shoppingSuggestionBlurTimeoutRef = useRef<number | null>(null);
  const notificationTimersRef = useRef<Record<number, number>>({});
  const notificationSequenceRef = useRef(1);

  const selectedUser = authSession?.user ?? null;
  const activeLocation = mapLocation ?? buildSavedLocation(selectedUser);
  const mapStores = mergeStores(nearbyStores, managedStores);
  const selectedStoreSummary = mapStores.find((store) => store.id === selectedStoreId) ?? null;
  const selectedManagedStore = managedStores.find((store) => store.id === selectedStoreId) ?? null;
  const selectedOption = options.find((option) => option.storeId === selectedStoreId) ?? null;
  const shoppingRouteStops = useMemo(
    () => buildShoppingRouteStops(shoppingPlan, selectedShoppingOptions, activeLocation),
    [activeLocation, selectedShoppingOptions, shoppingPlan],
  );
  const shoppingRouteKey = useMemo(
    () =>
      shoppingRouteStops
        .map((stop) => `${stop.storeId}:${stop.products.map((product) => product.inventoryItemId).join(",")}`)
        .join("|"),
    [shoppingRouteStops],
  );
  const shoppingRouteRequestKey = `${shoppingTravelMode}:${shoppingRouteKey}`;
  const fallbackShoppingRouteCoordinates = useMemo(() => {
    if (module !== "SHOPPING" || shoppingRouteStops.length === 0) {
      return [] as Array<[number, number]>;
    }

    return [
      [activeLocation.latitude, activeLocation.longitude] as [number, number],
      ...shoppingRouteStops.map((stop) => [stop.latitude, stop.longitude] as [number, number]),
    ];
  }, [
    activeLocation.latitude,
    activeLocation.longitude,
    module,
    shoppingRouteStops,
  ]);
  const shoppingRouteCoordinates =
    resolvedShoppingRoute.key === shoppingRouteRequestKey && resolvedShoppingRoute.coordinates.length > 1
      ? resolvedShoppingRoute.coordinates
      : fallbackShoppingRouteCoordinates;
  const shoppingViewportStores = shoppingRouteStops
    .map((stop) => mapStores.find((store) => store.id === stop.storeId) ?? null)
    .filter((store): store is StoreSummary => store !== null);
  const businessesUnlocked =
    managedStores.length > 0 ||
    selectedUser?.role === "STORE_OWNER" ||
    selectedUser?.role === "ADMIN";
  const viewportStores =
    module === "SHOPPING"
      ? shoppingViewportStores.length > 0
        ? shoppingViewportStores
        : nearbyStores
      : module === "OPEN_STORE" && storeLocationEditTargetId !== null && selectedStoreSummary
      ? [selectedStoreSummary]
      : module === "MY_BUSINESSES"
      ? selectedManagedStore
        ? [selectedManagedStore]
        : managedStores.slice(0, 1)
      : nearbyStores;
  const showExplorePanels = module === "EXPLORE" && areMapPanelsOpen;
  const showOpenStorePanel = module === "OPEN_STORE" && areMapPanelsOpen && Boolean(draftStore);
  const showShoppingPanel = module === "SHOPPING";
  const isEditingStoreLocation = storeLocationEditTargetId !== null;
  const hasShoppingDraftItems = shoppingList.some((item) => item.query.trim().length > 0);
  const filteredInventory = selectedStore
    ? selectedStore.inventory.filter((item) => {
        const search = inventorySearch.trim().toLowerCase();
        const matchesSearch =
          search.length === 0 ||
          item.productName.toLowerCase().includes(search) ||
          item.unit.toLowerCase().includes(search) ||
          (item.barcode ?? "").toLowerCase().includes(search);
        const matchesCategory =
          inventoryCategoryFilter === "ALL" || item.category === inventoryCategoryFilter;

        return matchesSearch && matchesCategory;
      })
    : [];

  useEffect(() => {
    selectedStoreIdRef.current = selectedStoreId;
  }, [selectedStoreId]);

  useEffect(() => () => {
    Object.values(shoppingSuggestionTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    if (shoppingSuggestionBlurTimeoutRef.current !== null) {
      window.clearTimeout(shoppingSuggestionBlurTimeoutRef.current);
    }
    Object.values(notificationTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    pushNotification("error", "Algo salió mal", error);
  }, [error]);

  const persistSession = useCallback((
    session: AuthSession | null,
    options: { syncLocation?: boolean } = {},
  ) => {
    setAuthSession(session);

    if (typeof window !== "undefined") {
      if (session) {
        writeStoredSession(session);
      } else {
        clearStoredSession();
      }
    }

    if (options.syncLocation === false) {
      return;
    }

    if (session) {
      setMapLocation(buildSavedLocation(session.user));
      return;
    }

    setMapLocation(null);
  }, []);

  const resetWorkspace = useCallback(() => {
    setIsSidebarOpen(true);
    setAreMapPanelsOpen(false);
    setModule("EXPLORE");
    setNearbyStores([]);
    setManagedStores([]);
    setOptions([]);
    setSelectedStoreId(null);
    setSelectedStore(null);
    setDraftStore(null);
    setStoreLocationEditTargetId(null);
    setNewStoreForm(emptyStoreForm);
    setNewStorePhotos([]);
    setBusinessForm(emptyStoreForm);
    setBusinessPhotos([]);
    setProductForm(emptyProductForm);
    setProductImage(null);
    setEditingInventoryItemId(null);
    setIsScannerOpen(false);
    setBusinessSection("INVENTORY");
    setInventorySearch("");
    setInventoryCategoryFilter("ALL");
    setShoppingList([{ id: "item-1", query: "" }]);
    setShoppingListName("");
    setSavedShoppingLists([]);
    setActiveSavedShoppingListId(null);
    setShoppingSuggestions({});
    setShoppingSuggestionsLoading({});
    setActiveShoppingItemId(null);
    setShoppingTravelMode("DRIVING");
    setShoppingListSource(null);
    setShoppingWorkflowStep("TRANSPORT");
    setShoppingPlan(null);
    setSelectedShoppingOptions({});
    setResolvedShoppingRoute({
      key: "",
      coordinates: [],
    });
    setIsPlanningShopping(false);
    setIsLoadingShoppingRoute(false);
    setIsLoadingSavedShoppingLists(false);
    setIsSavingSavedShoppingList(false);
    setDeletingSavedShoppingListId(null);
    Object.values(notificationTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    notificationTimersRef.current = {};
    setNotifications([]);
    setError(null);
    setStatus("Mapa listo.");
    setViewportVersion(0);
  }, []);

  const resetShoppingResults = useCallback(() => {
    setShoppingPlan(null);
    setSelectedShoppingOptions({});
    setResolvedShoppingRoute({
      key: "",
      coordinates: [],
    });
  }, []);

  const pushNotification = useCallback((tone: NotificationTone, title: string, message: string) => {
    const id = notificationSequenceRef.current++;

    setNotifications((current) => {
      if (current.some((notification) => notification.title === title && notification.message === message)) {
        return current;
      }

      return [...current, { id, tone, title, message }].slice(-4);
    });

    notificationTimersRef.current[id] = window.setTimeout(() => {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
      delete notificationTimersRef.current[id];
    }, 10000);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    const timeoutId = notificationTimersRef.current[id];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete notificationTimersRef.current[id];
    }

    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);


  const buildDraftShoppingItems = useCallback((productQueries: string[]) => {
    const trimmedQueries = productQueries
      .map((productQuery) => productQuery.trim())
      .filter((productQuery) => productQuery.length > 0);

    if (trimmedQueries.length === 0) {
      const emptyItemId = `item-${shoppingItemSequenceRef.current}`;
      shoppingItemSequenceRef.current += 1;
      return [{ id: emptyItemId, query: "" }];
    }

    return trimmedQueries.map((productQuery) => {
      const nextId = `item-${shoppingItemSequenceRef.current}`;
      shoppingItemSequenceRef.current += 1;
      return {
        id: nextId,
        query: productQuery,
      };
    });
  }, []);

  const loadSavedShoppingLists = useCallback(async () => {
    setIsLoadingSavedShoppingLists(true);

    try {
      const response = await apiFetch<SavedShoppingList[]>("/shopping/lists");
      setSavedShoppingLists(sortSavedShoppingLists(response));
    } catch {
      setSavedShoppingLists([]);
    } finally {
      setIsLoadingSavedShoppingLists(false);
    }
  }, []);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSavedShoppingLists();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authSession, loadSavedShoppingLists]);

  const loadShoppingSuggestions = useCallback(async (itemId: string, query: string) => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setShoppingSuggestions((current) => ({
        ...current,
        [itemId]: [],
      }));
      setShoppingSuggestionsLoading((current) => ({
        ...current,
        [itemId]: false,
      }));
      return;
    }

    const nextRequestId = (shoppingSuggestionRequestRef.current[itemId] ?? 0) + 1;
    shoppingSuggestionRequestRef.current[itemId] = nextRequestId;

    setShoppingSuggestionsLoading((current) => ({
      ...current,
      [itemId]: true,
    }));

    try {
      const suggestions = await apiFetch<ProductSummary[]>(`/products?q=${encodeURIComponent(trimmedQuery)}`);

      if (shoppingSuggestionRequestRef.current[itemId] !== nextRequestId) {
        return;
      }

      setShoppingSuggestions((current) => ({
        ...current,
        [itemId]: suggestions,
      }));
    } catch {
      if (shoppingSuggestionRequestRef.current[itemId] !== nextRequestId) {
        return;
      }

      setShoppingSuggestions((current) => ({
        ...current,
        [itemId]: [],
      }));
    } finally {
      if (shoppingSuggestionRequestRef.current[itemId] === nextRequestId) {
        setShoppingSuggestionsLoading((current) => ({
          ...current,
          [itemId]: false,
        }));
      }
    }
  }, []);

  const collapseSidebarOnSmallScreens = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 980) {
      setIsSidebarOpen(false);
    }
  }, []);

  const resetBusinessWorkspace = useCallback((nextSection: BusinessSection = "INVENTORY") => {
    setEditingInventoryItemId(null);
    setProductForm(emptyProductForm);
    setProductImage(null);
    setInventorySearch("");
    setInventoryCategoryFilter("ALL");
    setBusinessSection(nextSection);
  }, []);

  const requestDeviceLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("Seguimos con tu zona guardada.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "gps",
        });
        setStatus("Usando tu ubicacion actual.");
        setError(null);
        setIsLocating(false);
      },
      () => {
        setStatus("No pudimos usar tu GPS. Seguimos con tu zona guardada.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, []);

  const loadNearbyStores = useCallback(async (location: MapLocation) => {
    const loadedStores = await apiFetch<StoreSummary[]>(
      `/stores?userLat=${location.latitude}&userLng=${location.longitude}&radiusKm=${defaultSearchRadiusKm}`,
    );

    const sortedStores = sortStores(loadedStores);
    setNearbyStores(sortedStores);

    if (!selectedStoreIdRef.current && sortedStores[0]) {
      setSelectedStoreId(sortedStores[0].id);
    }

    return sortedStores;
  }, []);

  const loadManagedStores = useCallback(async (location: MapLocation) => {
    const loadedStores = await apiFetch<StoreSummary[]>(
      `/stores/mine?userLat=${location.latitude}&userLng=${location.longitude}`,
    );

    const sortedStores = sortStores(loadedStores);
    setManagedStores(sortedStores);
    return sortedStores;
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const session = readInitialSession();

      if (session) {
        setAuthSession(session);
        setMapLocation(buildSavedLocation(session.user));
      }

      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      requestDeviceLocation();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authSession, requestDeviceLocation]);

  useEffect(() => {
    if (!authSession || !activeLocation) {
      return;
    }

    let active = true;

    const timeoutId = window.setTimeout(() => {
      void Promise.all([
        loadNearbyStores(activeLocation),
        loadManagedStores(activeLocation),
      ])
        .then(([loadedNearbyStores]) => {
          if (!active) {
            return;
          }

          setOptions([]);
          setError(null);

          if (!selectedStoreIdRef.current && loadedNearbyStores[0]) {
            setSelectedStoreId(loadedNearbyStores[0].id);
          }

          setStatus(
            loadedNearbyStores.length > 0
              ? activeLocation.source === "gps"
                ? "Mostrando negocios cerca de ti."
                : "Mostrando negocios de tu zona guardada."
              : "No encontramos negocios en esta zona.",
          );
          setViewportVersion((current) => current + 1);
        })
        .catch((loadError) => {
          if (!active) {
            return;
          }

          const message = readError(loadError);
          setError(message);
          setStatus("No pudimos cargar el mapa.");

          if (message.toLowerCase().includes("token") || message.toLowerCase().includes("unauthorized")) {
            persistSession(null);
            resetWorkspace();
            setLoginMessage("Tu sesion vencio. Vuelve a entrar.");
          }
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeLocation,
    authSession,
    loadManagedStores,
    loadNearbyStores,
    persistSession,
    resetWorkspace,
  ]);

  useEffect(() => {
    if (!authSession || !selectedStoreId) {
      return;
    }

    let active = true;

    void apiFetch<StoreDetail>(`/stores/${selectedStoreId}`)
      .then((store) => {
        if (active) {
          setSelectedStore(store);

          if (store.canManage) {
            setBusinessForm({
              name: store.name,
              category: store.category,
            });
            setBusinessPhotos(store.photos.map(toDraftPhoto));
          }
        }
      })
      .catch(() => {
        if (active) {
          setSelectedStore(null);
        }
      });

    return () => {
      active = false;
    };
  }, [authSession, selectedStoreId]);

  useEffect(() => {
    if (module !== "MY_BUSINESSES") {
      return;
    }

    if (managedStores.length === 0) {
      return;
    }

    if (!managedStores.some((store) => store.id === selectedStoreIdRef.current)) {
      resetBusinessWorkspace("INVENTORY");
      setSelectedStoreId(managedStores[0].id);
      setViewportVersion((current) => current + 1);
    }
  }, [managedStores, module, resetBusinessWorkspace]);

  useEffect(() => {
    if (module !== "SHOPPING") {
      return;
    }

    if (shoppingRouteStops.length === 0) {
      return;
    }

    if (!shoppingRouteStops.some((stop) => stop.storeId === selectedStoreIdRef.current)) {
      setSelectedStoreId(shoppingRouteStops[0].storeId);
    }
  }, [module, shoppingRouteStops]);

  useEffect(() => {
    if (module !== "SHOPPING") {
      return;
    }

    setShoppingWorkflowStep((current) => {
      if (shoppingPlan) {
        if (current === "SUMMARY" || current === "ROUTE" || current === "OPTIONS") {
          return current;
        }

        return "OPTIONS";
      }

      if (current === "SUMMARY") {
        return shoppingListSource ? "ITEMS" : "SOURCE";
      }

      if (current === "ITEMS" || current === "SOURCE" || current === "TRANSPORT") {
        return current;
      }

      return "TRANSPORT";
    });
  }, [module, shoppingListSource, shoppingPlan]);

  useEffect(() => {
    let active = true;

    if (module !== "SHOPPING" || shoppingRouteStops.length === 0) {
      return () => {
        active = false;
        setIsLoadingShoppingRoute(false);
      };
    }

    const waypointString = [
      `${activeLocation.longitude},${activeLocation.latitude}`,
      ...shoppingRouteStops.map((stop) => `${stop.longitude},${stop.latitude}`),
    ].join(";");
    const routeServiceUrl = shoppingTravelMode === "WALKING" ? walkingRouteServiceUrl : drivingRouteServiceUrl;

    queueMicrotask(() => {
      if (active) {
        setIsLoadingShoppingRoute(true);
      }
    });

    void fetch(
      `${routeServiceUrl}/${waypointString}?overview=full&geometries=geojson`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("No pudimos calcular la ruta completa.");
        }

        return response.json() as Promise<{
          routes?: Array<{
            geometry?: {
              coordinates?: Array<[number, number]>;
            };
          }>;
        }>;
      })
      .then((payload) => {
        const routeCoordinates = payload.routes?.[0]?.geometry?.coordinates;
        if (!active || !routeCoordinates || routeCoordinates.length === 0) {
          return;
        }

        setResolvedShoppingRoute({
          key: shoppingRouteRequestKey,
          coordinates: routeCoordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setIsLoadingShoppingRoute(false);
        }
      });

    return () => {
      active = false;
      setIsLoadingShoppingRoute(false);
    };
  }, [
    activeLocation.latitude,
    activeLocation.longitude,
    module,
    shoppingRouteRequestKey,
    shoppingRouteStops,
    shoppingTravelMode,
  ]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMode("login");
    setLoginMessage("Entrando...");

    try {
      const session = await apiFetch<AuthSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify(login),
      });

      persistSession(session);
      resetWorkspace();
      setLoginMessage(`Hola, ${session.user.fullName}.`);
    } catch (loginError) {
      setLoginMessage(readError(loginError));
    }
  }

  async function handlePublicSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMode("signup");
    setSignupMessage("Creando tu cuenta...");

    try {
      const created = await apiFetch<UserAccount>("/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: signup.fullName,
          email: signup.email,
          password: signup.password,
          preferredLatitude: defaultUser.preferredLatitude,
          preferredLongitude: defaultUser.preferredLongitude,
        }),
      });

      const session = await apiFetch<AuthSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: signup.email,
          password: signup.password,
        }),
      });

      persistSession(session);
      resetWorkspace();
      setSignup(emptySignup);
      setSignupMessage(`Cuenta creada para ${created.fullName}.`);
      setLoginMessage(`Hola, ${created.fullName}.`);
    } catch (signupError) {
      setSignupMessage(readError(signupError));
    }
  }

  function handleLogout() {
    persistSession(null);
    resetWorkspace();
    setAuthMode("login");
    setLoginMessage("Bienvenido. Inicia sesion para continuar.");
    setSignupMessage(null);
  }

  function handleModuleChange(nextModule: DashboardModule) {
    if (module === "OPEN_STORE" && nextModule !== "OPEN_STORE") {
      setDraftStore(null);
      setStoreLocationEditTargetId(null);
      setNewStoreForm(emptyStoreForm);
      setNewStorePhotos([]);
    }

    setModule(nextModule);

    if (nextModule === "OPEN_STORE") {
      setAreMapPanelsOpen(false);
      setStatus("Haz doble clic en el mapa para ubicar tu negocio.");
      collapseSidebarOnSmallScreens();
      return;
    }

    if (nextModule === "SHOPPING") {
      setAreMapPanelsOpen(false);
      setStatus("Arma tu lista y encuentra la mejor ruta para comprar.");
      collapseSidebarOnSmallScreens();
      return;
    }

    if (nextModule === "MY_BUSINESSES") {
      setAreMapPanelsOpen(false);
      resetBusinessWorkspace("INVENTORY");
      if (managedStores.length > 0) {
        const nextStore = managedStores.find((store) => store.id === selectedStoreId) ?? managedStores[0];
        setSelectedStoreId(nextStore.id);
        setViewportVersion((current) => current + 1);
      }

      setStatus(
        selectedUser?.role === "ADMIN"
          ? "Admin activo. Puedes gestionar cualquier tienda."
          : "Gestiona tus negocios desde este panel.",
      );
      collapseSidebarOnSmallScreens();
      return;
    }

    setAreMapPanelsOpen(false);
    setStatus("Explora negocios cercanos y compara opciones.");
    collapseSidebarOnSmallScreens();
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeLocation) {
      return;
    }

    try {
      setError(null);
      setStatus("Buscando...");

      const loadedStores = await loadNearbyStores(activeLocation);
      setViewportVersion((current) => current + 1);
      setAreMapPanelsOpen(true);

      if (!productQuery.trim()) {
        setOptions([]);
        if (!selectedStoreIdRef.current && loadedStores[0]) {
          setSelectedStoreId(loadedStores[0].id);
        }
        setStatus(
          loadedStores.length > 0
            ? "Mostrando negocios cercanos."
            : "No encontramos negocios en esta zona.",
        );
        return;
      }

      const results = await apiFetch<SearchOption[]>("/search/options", {
        method: "POST",
        body: JSON.stringify({
          productQuery,
          userLatitude: activeLocation.latitude,
          userLongitude: activeLocation.longitude,
          maxDistanceKm: defaultSearchRadiusKm,
          sortBy: "BEST_MATCH",
        }),
      });

      setOptions(results);

      const nextSelectedStoreId =
        results[0]?.storeId ??
        loadedStores[0]?.id ??
        selectedStoreIdRef.current;

      if (nextSelectedStoreId) {
        setSelectedStoreId(nextSelectedStoreId);
      }

      setStatus(
        results.length > 0
          ? `Encontramos ${results.length} opciones para ${productQuery}.`
          : "No encontramos coincidencias para esa busqueda.",
      );
    } catch (searchError) {
      setError(readError(searchError));
      setStatus("No pudimos completar la busqueda.");
    }
  }

  function handleClearSearch() {
    setProductQuery("");
    setOptions([]);
    setAreMapPanelsOpen(true);
    setStatus("Mostrando negocios cercanos.");
  }

  function handleAddShoppingItem() {
    const nextId = `item-${shoppingItemSequenceRef.current}`;
    shoppingItemSequenceRef.current += 1;
    setShoppingList((current) => [...current, { id: nextId, query: "" }]);
    setActiveShoppingItemId(nextId);
    resetShoppingResults();
  }

  function handleUpdateShoppingItem(itemId: string, query: string) {
    setShoppingList((current) =>
      current.map((item) => (item.id === itemId ? { ...item, query } : item)),
    );
    setActiveShoppingItemId(itemId);
    resetShoppingResults();

    if (shoppingSuggestionBlurTimeoutRef.current !== null) {
      window.clearTimeout(shoppingSuggestionBlurTimeoutRef.current);
      shoppingSuggestionBlurTimeoutRef.current = null;
    }

    const existingTimeoutId = shoppingSuggestionTimeoutsRef.current[itemId];
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    if (query.trim().length < 2) {
      setShoppingSuggestions((current) => ({
        ...current,
        [itemId]: [],
      }));
      setShoppingSuggestionsLoading((current) => ({
        ...current,
        [itemId]: false,
      }));
      return;
    }

    shoppingSuggestionTimeoutsRef.current[itemId] = window.setTimeout(() => {
      void loadShoppingSuggestions(itemId, query);
    }, 180);
  }

  function handleRemoveShoppingItem(itemId: string) {
    const existingTimeoutId = shoppingSuggestionTimeoutsRef.current[itemId];
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
      delete shoppingSuggestionTimeoutsRef.current[itemId];
    }

    delete shoppingSuggestionRequestRef.current[itemId];

    setShoppingList((current) => {
      const nextItems = current.filter((item) => item.id !== itemId);
      return nextItems.length > 0 ? nextItems : [{ id: "item-1", query: "" }];
    });
    setShoppingSuggestions((current) => omitRecordKey(current, itemId));
    setShoppingSuggestionsLoading((current) => omitRecordKey(current, itemId));
    setActiveShoppingItemId((current) => (current === itemId ? null : current));
    resetShoppingResults();
  }

  function handleShoppingItemFocus(itemId: string) {
    if (shoppingSuggestionBlurTimeoutRef.current !== null) {
      window.clearTimeout(shoppingSuggestionBlurTimeoutRef.current);
      shoppingSuggestionBlurTimeoutRef.current = null;
    }

    setActiveShoppingItemId(itemId);

    const currentItem = shoppingList.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const trimmedQuery = currentItem.query.trim();
    const existingSuggestions = shoppingSuggestions[itemId] ?? [];
    const isLoading = shoppingSuggestionsLoading[itemId] ?? false;

    if (trimmedQuery.length >= 2 && existingSuggestions.length === 0 && !isLoading) {
      void loadShoppingSuggestions(itemId, trimmedQuery);
    }
  }

  function handleShoppingItemBlur(itemId: string) {
    shoppingSuggestionBlurTimeoutRef.current = window.setTimeout(() => {
      setActiveShoppingItemId((current) => (current === itemId ? null : current));
      shoppingSuggestionBlurTimeoutRef.current = null;
    }, 140);
  }

  function handleShoppingSuggestionSelect(itemId: string, suggestion: ProductSummary) {
    const existingTimeoutId = shoppingSuggestionTimeoutsRef.current[itemId];
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
      delete shoppingSuggestionTimeoutsRef.current[itemId];
    }

    setShoppingList((current) =>
      current.map((item) => (item.id === itemId ? { ...item, query: suggestion.name } : item)),
    );
    setShoppingSuggestions((current) => ({
      ...current,
      [itemId]: [suggestion, ...(current[itemId] ?? []).filter((item) => item.id !== suggestion.id)],
    }));
    setActiveShoppingItemId(null);
    resetShoppingResults();
    setStatus(`${suggestion.name} agregado a tu lista.`);
  }

  function handleShoppingTravelModeChange(nextMode: ShoppingTravelMode) {
    setShoppingTravelMode(nextMode);
    setIsLoadingShoppingRoute(false);
    setStatus(
      nextMode === "WALKING"
        ? "Modo a pie activo. La ruta seguira calles y caminos peatonales."
        : "Modo vehiculo activo. La ruta sigue las vias disponibles para carro.",
    );
  }

  function handleContinueShoppingSetup() {
    setShoppingWorkflowStep("SOURCE");
    setShoppingListSource(null);
    setStatus(
      shoppingTravelMode === "WALKING"
        ? "Modo a pie confirmado. Ahora elige si quieres una lista nueva o una lista guardada."
        : "Modo vehiculo confirmado. Ahora elige si quieres una lista nueva o una lista guardada.",
    );
  }

  function handleSelectShoppingListSource(nextSource: Exclude<ShoppingListSource, null>) {
    setShoppingListSource(nextSource);

    if (nextSource === "NEW") {
      setShoppingListName("");
      setActiveSavedShoppingListId(null);
      setShoppingList(buildDraftShoppingItems([]));
      setShoppingSuggestions({});
      setShoppingSuggestionsLoading({});
      setActiveShoppingItemId(null);
      resetShoppingResults();
      setShoppingWorkflowStep("ITEMS");
      setStatus("Empezaste una lista nueva. Ahora agrega tus productos.");
      return;
    }

    setStatus("Selecciona una lista guardada para cargar sus productos.");
  }

  function handleStartFreshShoppingList() {
    setShoppingListSource("NEW");
    setShoppingListName("");
    setActiveSavedShoppingListId(null);
    setShoppingList(buildDraftShoppingItems([]));
    setShoppingSuggestions({});
    setShoppingSuggestionsLoading({});
    setActiveShoppingItemId(null);
    resetShoppingResults();
    shoppingItemSequenceRef.current = 2;
    setShoppingWorkflowStep("ITEMS");
    setStatus("Tienes una lista nueva para empezar desde cero.");
  }

  function handleUseSavedShoppingList(savedShoppingList: SavedShoppingList) {
    setShoppingListSource("SAVED");
    setShoppingListName(savedShoppingList.name);
    setActiveSavedShoppingListId(savedShoppingList.id);
    setShoppingList(buildDraftShoppingItems(savedShoppingList.items.map((item) => item.productQuery)));
    setShoppingSuggestions({});
    setShoppingSuggestionsLoading({});
    setActiveShoppingItemId(null);
    resetShoppingResults();
    setShoppingWorkflowStep("ITEMS");
    setStatus(`${savedShoppingList.name} cargada en tu lista de compra.`);
  }

  async function handleSaveShoppingList() {
    const trimmedName = shoppingListName.trim();
    const items = shoppingList
      .map((item) => item.query.trim())
      .filter((item) => item.length > 0)
      .map((productQuery) => ({ productQuery }));

    if (!trimmedName) {
      setError("Ponle un nombre a la lista para guardarla.");
      return;
    }

    if (items.length === 0) {
      setError("Agrega al menos un producto antes de guardar la lista.");
      return;
    }

    try {
      setIsSavingSavedShoppingList(true);
      setError(null);

      const savedShoppingList = activeSavedShoppingListId
        ? await apiFetch<SavedShoppingList>(`/shopping/lists/${activeSavedShoppingListId}`, {
            method: "PUT",
            body: JSON.stringify({
              name: trimmedName,
              items,
            }),
          })
        : await apiFetch<SavedShoppingList>("/shopping/lists", {
            method: "POST",
            body: JSON.stringify({
              name: trimmedName,
              items,
            }),
          });

      setSavedShoppingLists((current) => upsertSavedShoppingList(current, savedShoppingList));
      setActiveSavedShoppingListId(savedShoppingList.id);
      setShoppingListName(savedShoppingList.name);
      setStatus(
        activeSavedShoppingListId
          ? `Lista ${savedShoppingList.name} actualizada.`
          : `Lista ${savedShoppingList.name} guardada.`,
      );
    } catch (saveError) {
      setError(readError(saveError));
      setStatus("No pudimos guardar esta lista.");
    } finally {
      setIsSavingSavedShoppingList(false);
    }
  }

  async function handleDeleteSavedShoppingList(shoppingListId: number) {
    const savedShoppingList = savedShoppingLists.find((item) => item.id === shoppingListId);
    if (!savedShoppingList) {
      return;
    }

    if (typeof window !== "undefined" && !window.confirm(`Eliminar la lista ${savedShoppingList.name}?`)) {
      return;
    }

    try {
      setDeletingSavedShoppingListId(shoppingListId);
      setError(null);
      await apiFetch<void>(`/shopping/lists/${shoppingListId}`, {
        method: "DELETE",
      });

      setSavedShoppingLists((current) => current.filter((item) => item.id !== shoppingListId));

      if (activeSavedShoppingListId === shoppingListId) {
        setActiveSavedShoppingListId(null);
      }

      setStatus(`Lista ${savedShoppingList.name} eliminada.`);
    } catch (deleteError) {
      setError(readError(deleteError));
      setStatus("No pudimos eliminar la lista.");
    } finally {
      setDeletingSavedShoppingListId(null);
    }
  }

  async function handleBuildShoppingPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeLocation) {
      return;
    }

    const items = shoppingList
      .map((item) => ({
        requestId: item.id,
        productQuery: item.query.trim(),
      }))
      .filter((item) => item.productQuery.length > 0);

    if (items.length === 0) {
      setError("Agrega al menos un producto a tu lista de compra.");
      return;
    }

    try {
      setIsPlanningShopping(true);
      setError(null);
      setStatus("Buscando las mejores tiendas para tu lista...");

      const plan = await apiFetch<ShoppingPlan>("/shopping/plan", {
        method: "POST",
        body: JSON.stringify({
          userLatitude: activeLocation.latitude,
          userLongitude: activeLocation.longitude,
          maxDistanceKm: defaultSearchRadiusKm,
          items,
        }),
      });

      setShoppingPlan(plan);
      setSelectedShoppingOptions(
        Object.fromEntries(
          plan.items.map((item) => [
            item.requestId,
            item.selectedInventoryItemId ?? item.options[0]?.inventoryItemId ?? null,
          ]),
        ),
      );

      if (plan.suggestedStops[0]) {
        setSelectedStoreId(plan.suggestedStops[0].storeId);
      }

      setStatus(
        plan.coveredItems > 0
          ? `Ruta lista con ${plan.suggestedStops.length} tiendas sugeridas. Ahora elige la coincidencia exacta de cada producto.`
          : "No encontramos coincidencias para tu lista en esta zona.",
      );
      setShoppingWorkflowStep("OPTIONS");
    } catch (shoppingError) {
      setError(readError(shoppingError));
      setStatus("No pudimos armar la ruta de compra.");
    } finally {
      setIsPlanningShopping(false);
    }
  }

  function handleEditShoppingItems() {
    resetShoppingResults();
    setShoppingWorkflowStep("ITEMS");
    setStatus("Edita tus artículos y vuelve a armar la compra.");
  }

  function handleEditShoppingSource() {
    resetShoppingResults();
    setShoppingWorkflowStep("SOURCE");
    setStatus("Puedes cambiar entre una lista nueva o una guardada.");
  }

  function handleContinueShoppingSummary() {
    if (!shoppingPlan) {
      return;
    }

    setShoppingWorkflowStep("ROUTE");
    setStatus("Opciones confirmadas. Ahora revisa las tiendas ordenadas por distancia.");
  }

  function handleEditShoppingOptions() {
    if (!shoppingPlan) {
      return;
    }

    setShoppingWorkflowStep("OPTIONS");
    setStatus("Ajusta la coincidencia exacta de cada producto antes del resumen.");
  }

  function handleContinueShoppingFinalSummary() {
    if (!shoppingPlan) {
      return;
    }

    setShoppingWorkflowStep("SUMMARY");
    setStatus("Revisa el resumen final antes de finalizar la compra.");
  }

  function handleShoppingOptionSelect(requestId: string, inventoryItemId: number) {
    setSelectedShoppingOptions((current) => ({
      ...current,
      [requestId]: inventoryItemId,
    }));
    setStatus("Ruta actualizada con tu seleccion.");
  }

  function handleStoreSelect(storeId: number) {
    const store = mapStores.find((item) => item.id === storeId);

    if (module === "MY_BUSINESSES" && store && !store.canManage) {
      setStatus("Esta tienda no aparece en tus negocios.");
      return;
    }

    setSelectedStoreId(storeId);
    setError(null);
    if (module === "SHOPPING") {
      setStatus(store ? `Parada seleccionada: ${store.name}.` : "Tienda seleccionada.");
      return;
    }

    setAreMapPanelsOpen(true);
    if (module === "MY_BUSINESSES") {
      resetBusinessWorkspace("INVENTORY");
    }
    setStatus(store ? `Seleccionaste ${store.name}.` : "Tienda seleccionada.");

    if (module === "MY_BUSINESSES") {
      setViewportVersion((current) => current + 1);
    }
  }

  function handleMapDoubleClick(location: DraftStore) {
    if (module !== "OPEN_STORE") {
      return;
    }

    setDraftStore(location);
    setError(null);
    setAreMapPanelsOpen(true);
    setStatus(
      isEditingStoreLocation
        ? "Pin corregido. Guarda los cambios para actualizar tu tienda."
        : "Completa los datos para abrir tu negocio.",
    );
  }

  function handleCancelNewStore() {
    setDraftStore(null);
    setStoreLocationEditTargetId(null);
    setNewStoreForm(emptyStoreForm);
    setNewStorePhotos([]);
    setAreMapPanelsOpen(false);
    setStatus("Puedes elegir otra ubicacion cuando quieras.");
  }

  function handleCancelStoreLocationEdit() {
    setDraftStore(null);
    setStoreLocationEditTargetId(null);
    setNewStoreForm(emptyStoreForm);
    setNewStorePhotos([]);
    setAreMapPanelsOpen(false);
    setModule("MY_BUSINESSES");
    setStatus("La ubicacion de tu tienda no cambio.");
  }

  function handleCloseMapPanels() {
    if (storeLocationEditTargetId !== null) {
      handleCancelStoreLocationEdit();
      return;
    }

    if (module === "OPEN_STORE") {
      handleCancelNewStore();
      return;
    }

    setAreMapPanelsOpen(false);
  }

  function handleCloseShoppingPanel() {
    setShoppingWorkflowStep("TRANSPORT");
    setShoppingListSource(null);
    resetShoppingResults();
    shoppingItemSequenceRef.current = 2;
    setModule("EXPLORE");
    setStatus("Explora negocios cercanos y compara opciones.");
  }

  function handleFinalizeShoppingPurchase() {
    handleCloseShoppingPanel();
    setStatus("Compra finalizada. Ya puedes seguir explorando o empezar una nueva lista.");
  }

  function handleStartStoreLocationEdit() {
    if (!selectedStore?.canManage) {
      return;
    }

    setDraftStore({
      latitude: selectedStore.latitude,
      longitude: selectedStore.longitude,
    });
    setStoreLocationEditTargetId(selectedStore.id);
    setNewStoreForm(emptyStoreForm);
    setNewStorePhotos([]);
    setAreMapPanelsOpen(true);
    setModule("OPEN_STORE");
    setViewportVersion((current) => current + 1);
    setError(null);
    setStatus(`Doble clic para corregir la ubicacion de ${selectedStore.name}.`);
    collapseSidebarOnSmallScreens();
  }

  async function handleNewStorePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    if (files.length === 0) {
      return;
    }

    const loadedPhotos = await Promise.all(files.map(readFileAsDraftPhoto));
    setNewStorePhotos(loadedPhotos);
    event.target.value = "";
  }

  async function handleBusinessPhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    if (files.length === 0) {
      return;
    }

    const loadedPhotos = await Promise.all(files.map(readFileAsDraftPhoto));
    setBusinessPhotos(loadedPhotos);
    event.target.value = "";
  }

  async function handleProductImageChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }

    const loadedPhoto = await readFileAsDraftPhoto(file);
    setProductImage(loadedPhoto);
    event.target.value = "";
  }

  async function handleBarcodeLookup(nextBarcode?: string) {
    const barcode = (nextBarcode ?? productForm.barcode).trim();
    if (!barcode) {
      setError("Escribe un codigo de barras para buscarlo.");
      return;
    }

    try {
      setIsLookingUpBarcode(true);
      setError(null);
      setStatus("Consultando Open Food Facts...");

      if (nextBarcode) {
        setProductForm((current) => ({
          ...current,
          barcode,
        }));
      }

      const result = await apiFetch<BarcodeLookupResult>(`/barcodes/${encodeURIComponent(barcode)}`);

      setProductForm((current) => ({
        ...current,
        name: result.productName,
        brandName: result.brandName ?? "",
        category: result.productCategory,
        unit: result.unit,
        barcode: result.barcode,
      }));

      if (result.imageDataUrl) {
        setProductImage(toDraftPhotoFromLookup(result.productName, result.imageDataUrl));
      }

      setStatus(`Datos cargados desde ${result.source}.`);
    } catch (lookupError) {
      setError(readError(lookupError));
      setStatus("No pudimos completar la consulta del codigo.");
    } finally {
      setIsLookingUpBarcode(false);
    }
  }

  function handleBarcodeDetected(barcode: string) {
    setIsScannerOpen(false);
    void handleBarcodeLookup(barcode);
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftStore) {
      return;
    }

    if (storeLocationEditTargetId !== null) {
      if (!businessForm.name.trim()) {
        setError("Escribe el nombre de tu negocio.");
        return;
      }

      try {
        setIsSavingStore(true);
        setError(null);

        const updatedStore = await apiFetch<StoreDetail>(`/stores/${storeLocationEditTargetId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: businessForm.name.trim(),
            category: businessForm.category,
            latitude: draftStore.latitude,
            longitude: draftStore.longitude,
            photos: businessPhotos.map((photo) => ({
              filename: photo.filename,
              contentType: photo.contentType,
              imageDataUrl: photo.imageDataUrl,
            })),
          }),
        });

        const updatedSummary = toStoreSummary(updatedStore, activeLocation);
        setNearbyStores((current) => upsertStore(current, updatedSummary));
        setManagedStores((current) => upsertStore(current, updatedSummary));
        setOptions((current) =>
          current.map((option) =>
            option.storeId === updatedStore.id
              ? { ...option, storeName: updatedStore.name }
              : option,
          ),
        );
        setSelectedStoreId(updatedStore.id);
        setSelectedStore(updatedStore);
        setDraftStore(null);
        setStoreLocationEditTargetId(null);
        setModule("MY_BUSINESSES");
        setAreMapPanelsOpen(false);
        setBusinessSection("DETAILS");
        setViewportVersion((current) => current + 1);
        setStatus("Actualizamos la ubicacion de tu tienda.");
      } catch (createError) {
        setError(readError(createError));
        setStatus("No pudimos actualizar la ubicacion.");
      } finally {
        setIsSavingStore(false);
      }

      return;
    }

    if (!newStoreForm.name.trim()) {
      setError("Escribe el nombre de tu negocio.");
      return;
    }

    try {
      setIsSavingStore(true);
      setError(null);

      const createdStore = await apiFetch<StoreDetail>("/stores", {
        method: "POST",
        body: JSON.stringify({
          name: newStoreForm.name.trim(),
          category: newStoreForm.category,
          latitude: draftStore.latitude,
          longitude: draftStore.longitude,
          photos: newStorePhotos.map((photo) => ({
            filename: photo.filename,
            contentType: photo.contentType,
            imageDataUrl: photo.imageDataUrl,
          })),
        }),
      });

      const createdSummary = toStoreSummary(createdStore, activeLocation);
      setNearbyStores((current) => upsertStore(current, createdSummary));
      setManagedStores((current) => upsertStore(current, createdSummary));
      setSelectedStoreId(createdStore.id);
      setSelectedStore(createdStore);
      setDraftStore(null);
      setNewStoreForm(emptyStoreForm);
      setNewStorePhotos([]);
      resetBusinessWorkspace("INVENTORY");
      setModule("MY_BUSINESSES");
      setViewportVersion((current) => current + 1);
      setStatus("Tu negocio ya aparece en FindIt.");

      if (authSession && authSession.user.role === "CUSTOMER") {
        persistSession({
          ...authSession,
          user: {
            ...authSession.user,
            role: "STORE_OWNER",
          },
        }, { syncLocation: false });
      }
    } catch (createError) {
      setError(readError(createError));
      setStatus("No pudimos registrar tu negocio.");
    } finally {
      setIsSavingStore(false);
    }
  }

  async function handleUpdateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStoreId || !selectedStore?.canManage) {
      return;
    }

    if (!businessForm.name.trim()) {
      setError("Escribe el nombre de tu negocio.");
      return;
    }

    try {
      setIsSavingStore(true);
      setError(null);

      const updatedStore = await apiFetch<StoreDetail>(`/stores/${selectedStoreId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: businessForm.name.trim(),
          category: businessForm.category,
          photos: businessPhotos.map((photo) => ({
            filename: photo.filename,
            contentType: photo.contentType,
            imageDataUrl: photo.imageDataUrl,
          })),
        }),
      });

      const updatedSummary = toStoreSummary(updatedStore, activeLocation);
      setNearbyStores((current) => upsertStore(current, updatedSummary));
      setManagedStores((current) => upsertStore(current, updatedSummary));
      setOptions((current) =>
        current.map((option) =>
          option.storeId === updatedStore.id
            ? { ...option, storeName: updatedStore.name }
            : option,
        ),
      );
      setSelectedStore(updatedStore);
      setStatus("Guardamos los cambios de tu negocio.");
    } catch (updateError) {
      setError(readError(updateError));
      setStatus("No pudimos guardar los cambios.");
    } finally {
      setIsSavingStore(false);
    }
  }

  async function handleDeleteBusiness() {
    if (!selectedStoreId || !selectedStore?.canManage || !selectedStoreSummary) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Eliminar ${selectedStoreSummary.name} de FindIt?`);
      if (!confirmed) {
        return;
      }
    }

    try {
      setIsDeletingStore(true);
      setError(null);

      await apiFetch<void>(`/stores/${selectedStoreId}`, {
        method: "DELETE",
      });

      const nextNearbyStores = nearbyStores.filter((store) => store.id !== selectedStoreId);
      const nextManagedStores = managedStores.filter((store) => store.id !== selectedStoreId);
      const nextOptions = options.filter((option) => option.storeId !== selectedStoreId);

      setNearbyStores(nextNearbyStores);
      setManagedStores(nextManagedStores);
      setOptions(nextOptions);
      setSelectedStore(null);
      setBusinessForm(emptyStoreForm);
      setBusinessPhotos([]);
      resetBusinessWorkspace("INVENTORY");

      const nextSelectedStore =
        module === "MY_BUSINESSES"
          ? nextManagedStores[0] ?? nextNearbyStores[0] ?? null
          : nextNearbyStores[0] ?? nextManagedStores[0] ?? null;

      setSelectedStoreId(nextSelectedStore?.id ?? null);

      if (module === "MY_BUSINESSES" && nextManagedStores.length === 0) {
        setModule("OPEN_STORE");
        setStatus("Ya no tienes negocios registrados. Puedes abrir uno nuevo.");
      } else {
        setStatus("El negocio fue eliminado.");
      }

      if (nextSelectedStore) {
        setViewportVersion((current) => current + 1);
      }
    } catch (deleteError) {
      setError(readError(deleteError));
      setStatus("No pudimos eliminar el negocio.");
    } finally {
      setIsDeletingStore(false);
    }
  }

  function resetProductComposer() {
    setProductForm(emptyProductForm);
    setProductImage(null);
    setEditingInventoryItemId(null);
    setIsScannerOpen(false);
  }

  function handleEditProduct(inventoryItemId: number) {
    const item = selectedStore?.inventory.find((entry) => entry.inventoryItemId === inventoryItemId);
    if (!item) {
      return;
    }

    setEditingInventoryItemId(item.inventoryItemId);
    setBusinessSection("MY_PRODUCTS");
    setProductForm({
      name: item.productName,
      brandName: item.brandName ?? "",
      category: item.category,
      unit: item.unit,
      barcode: item.barcode ?? "",
      price: String(item.price),
    });
    setProductImage(item.imageDataUrl ? toDraftPhotoFromInventoryImage(item) : null);
    setStatus(`Editando ${item.productName}.`);
  }

  async function handleDeleteProduct(inventoryItemId: number) {
    if (!selectedStoreId || !selectedStore?.canManage) {
      return;
    }

    const item = selectedStore.inventory.find((entry) => entry.inventoryItemId === inventoryItemId);
    if (!item) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Eliminar ${item.productName} del inventario?`);
      if (!confirmed) {
        return;
      }
    }

    try {
      setIsSavingProduct(true);
      setError(null);

      const updatedStore = await apiFetch<StoreDetail>(`/stores/${selectedStoreId}/inventory/${inventoryItemId}`, {
        method: "DELETE",
      });

      setSelectedStore(updatedStore);

      if (editingInventoryItemId === inventoryItemId) {
        resetProductComposer();
      }

      setStatus(`${item.productName} fue eliminado del inventario.`);
    } catch (productError) {
      setError(readError(productError));
      setStatus("No pudimos eliminar el producto.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStoreId || !selectedStore?.canManage) {
      return;
    }

    if (!productForm.name.trim() || !productForm.unit.trim() || !productForm.price) {
      setError("Completa nombre, unidad y precio.");
      return;
    }

    try {
      setIsSavingProduct(true);
      setError(null);

      const path = editingInventoryItemId
        ? `/stores/${selectedStoreId}/inventory/${editingInventoryItemId}`
        : `/stores/${selectedStoreId}/inventory`;
      const method = editingInventoryItemId ? "PUT" : "POST";

      const updatedStore = await apiFetch<StoreDetail>(path, {
        method,
        body: JSON.stringify({
          productName: productForm.name.trim(),
          brandName: productForm.brandName.trim() || null,
          productCategory: productForm.category,
          unit: productForm.unit.trim(),
          barcode: productForm.barcode.trim() || null,
          price: Number(productForm.price),
          quantityAvailable: resolveQuantityAvailableForSave(selectedStore, editingInventoryItemId),
          imageDataUrl: productImage?.imageDataUrl ?? null,
        }),
      });

      setSelectedStore(updatedStore);
      resetProductComposer();
      setBusinessSection("INVENTORY");
      setStatus(editingInventoryItemId ? "Producto actualizado." : "Producto agregado al inventario.");
    } catch (productError) {
      setError(readError(productError));
      setStatus("No pudimos guardar el producto.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleProductCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!selectedStoreId || !selectedStore?.canManage) {
      setError("Solo puedes importar productos en una tienda que administras.");
      return;
    }

    try {
      setIsImportingProducts(true);
      setError(null);
      setStatus(`Leyendo ${file.name}...`);

      const parsedRows = parseProductCsvRows(await file.text());
      if (parsedRows.length === 0) {
        throw new Error("El CSV no contiene productos validos.");
      }

      let latestStore = selectedStore;
      let importedCount = 0;
      const failures: string[] = [];

      for (const row of parsedRows) {
        const resolvedRow = await resolveImportedProductRow(row, {
          lookupBarcode: (barcode) => apiFetch<BarcodeLookupResult>(`/barcodes/${encodeURIComponent(barcode)}`),
          productCategoryOptions,
        });

        if ("error" in resolvedRow) {
          failures.push(`Fila ${row.rowNumber}: ${resolvedRow.error}`);
          continue;
        }

        try {
          latestStore = await apiFetch<StoreDetail>(`/stores/${selectedStoreId}/inventory`, {
            method: "POST",
            body: JSON.stringify({
              productName: resolvedRow.payload.productName,
              brandName: resolvedRow.payload.brandName,
              productCategory: resolvedRow.payload.productCategory,
              unit: resolvedRow.payload.unit,
              barcode: resolvedRow.payload.barcode,
              price: resolvedRow.payload.price,
              quantityAvailable: resolvedRow.payload.quantityAvailable,
              imageDataUrl: resolvedRow.payload.imageDataUrl,
            }),
          });
          importedCount += 1;
        } catch (importError) {
          failures.push(`Fila ${row.rowNumber}: ${readError(importError)}`);
        }
      }

      if (latestStore) {
        setSelectedStore(latestStore);
      }

      if (importedCount === 0) {
        throw new Error(failures[0] ?? "No pudimos importar productos desde el CSV.");
      }

      resetProductComposer();
      setBusinessSection("INVENTORY");

      if (failures.length > 0) {
        const preview = failures.slice(0, 3).join(" | ");
        const suffix = failures.length > 3 ? ` | ...y ${failures.length - 3} mas` : "";
        setError(`Importamos ${importedCount} productos, pero ${failures.length} filas fallaron. ${preview}${suffix}`);
        setStatus("La importacion quedo parcial.");
      } else {
        setStatus(`Importamos ${importedCount} productos desde el CSV.`);
      }
    } catch (importError) {
      setError(readError(importError));
      setStatus("No pudimos importar el CSV.");
    } finally {
      setIsImportingProducts(false);
    }
  }

  function handleOpenSelectedBusiness() {
    if (!selectedStoreSummary?.canManage) {
      return;
    }

    setModule("MY_BUSINESSES");
    resetBusinessWorkspace("INVENTORY");
    setViewportVersion((current) => current + 1);
    setStatus("Gestiona este negocio desde tu panel.");
    collapseSidebarOnSmallScreens();
  }

  function handleCloseBusinessOverlay() {
    setModule("EXPLORE");
    setStatus("Explora negocios cercanos y compara opciones.");
  }

  if (!isReady) {
    return (
      <main className={styles.page}>
        <div className={styles.bootSplash}>Preparando FindIt...</div>
      </main>
    );
  }

  if (!authSession) {
    return (
      <main className={styles.page}>
        <div className={styles.authBackdrop}>
          <div className={styles.authGlowA} />
          <div className={styles.authGlowB} />
          <div className={styles.authGrid} />
        </div>

        <div className={styles.authShell}>
          <section className={styles.authCopy}>
            <span className={styles.eyebrow}>FindIt</span>
            <h1 className={styles.title}>Bienvenido</h1>
            <p className={styles.lead}>
              Inicia sesion para explorar negocios cercanos, abrir tu tienda y gestionar tu inventario desde un solo lugar.
            </p>
          </section>

          <section className={styles.authCard}>
            {authMode === "login" ? (
              <form className={styles.stack} onSubmit={handleLogin}>
                <div>
                  <label className={styles.fieldLabel}>Correo</label>
                  <input
                    className={styles.input}
                    type="email"
                    value={login.email}
                    onChange={(event) =>
                      setLogin((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Contrasena</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={login.password}
                    onChange={(event) =>
                      setLogin((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>

                {loginMessage ? <div className={styles.status}>{loginMessage}</div> : null}

                <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit">
                  Iniciar sesion
                </button>

                <button
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.authSwitch}`}
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setSignupMessage(null);
                  }}
                >
                  Registrarme con correo
                </button>
              </form>
            ) : (
              <form className={styles.stack} onSubmit={handlePublicSignup}>
                <div>
                  <label className={styles.fieldLabel}>Nombre</label>
                  <input
                    className={styles.input}
                    value={signup.fullName}
                    onChange={(event) =>
                      setSignup((current) => ({ ...current, fullName: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Correo</label>
                  <input
                    className={styles.input}
                    type="email"
                    value={signup.email}
                    onChange={(event) =>
                      setSignup((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Contrasena</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={signup.password}
                    onChange={(event) =>
                      setSignup((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>

                {signupMessage ? <div className={styles.status}>{signupMessage}</div> : null}

                <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit">
                  Crear cuenta
                </button>

                <button
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.authSwitch}`}
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setLoginMessage("Bienvenido. Inicia sesion para continuar.");
                  }}
                >
                  Ya tengo cuenta
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={buildWorkspaceClass(styles, isSidebarOpen)}>
      <aside className={styles.sidebar}>
        <button
          className={`${styles.button} ${styles.buttonSecondary} ${styles.sidebarToggleButton}`}
          type="button"
          onClick={() => setIsSidebarOpen(false)}
        >
          Ocultar
        </button>

        <nav className={styles.moduleNav}>
          <button
            className={buildModuleButtonClass(styles, module === "EXPLORE")}
            type="button"
            onClick={() => handleModuleChange("EXPLORE")}
          >
            Explorar
          </button>

          <button
            className={buildModuleButtonClass(styles, module === "OPEN_STORE")}
            type="button"
            onClick={() => handleModuleChange("OPEN_STORE")}
          >
            Abrir tienda
          </button>

          <button
            className={buildModuleButtonClass(styles, module === "SHOPPING")}
            type="button"
            onClick={() => handleModuleChange("SHOPPING")}
          >
            Ir de compras
          </button>

          {businessesUnlocked ? (
            <button
              className={buildModuleButtonClass(styles, module === "MY_BUSINESSES")}
              type="button"
              onClick={() => handleModuleChange("MY_BUSINESSES")}
            >
              Tus negocios
            </button>
          ) : null}
        </nav>
      </aside>

      <section className={styles.mapStage}>
        <div className={styles.mapCanvas}>
          <FindItMap
            center={activeLocation}
            centerLabel={activeLocation.source === "gps" ? "Tu ubicacion" : authSession.user.fullName}
            stores={mapStores}
            viewportStores={viewportStores}
            selectedStoreId={selectedStoreId}
            viewportVersion={viewportVersion}
            onSelectStore={handleStoreSelect}
            draftLocation={draftStore}
            allowDraftPlacement={module === "OPEN_STORE"}
            onMapDoubleClick={handleMapDoubleClick}
            shoppingRouteCoordinates={shoppingRouteCoordinates}
            shoppingTravelMode={shoppingTravelMode}
            shoppingStops={shoppingRouteStops}
          />
        </div>

        <div className={styles.overlayLayer}>
          {!isSidebarOpen ? (
            <div className={styles.leftEdgeActions}>
              <button
                aria-label="Mostrar menu"
                className={`${styles.button} ${styles.buttonSecondary} ${styles.floatingActionButton}`}
                type="button"
                onClick={() => setIsSidebarOpen(true)}
              >
                <span className={styles.buttonIcon} aria-hidden="true">
                  <MenuIcon />
                </span>
                <span className={styles.buttonLabel}>Menu</span>
              </button>
            </div>
          ) : null}

          {module === "EXPLORE" ? (
            <form
              className={buildSearchBarClass(styles, isSidebarOpen)}
              onSubmit={handleSearchSubmit}
            >
              <input
                className={styles.searchInput}
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Busca un producto"
              />

              <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit">
                Buscar
              </button>

              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                type="button"
                onClick={handleClearSearch}
              >
                Limpiar
              </button>
            </form>
          ) : (
            <div className={buildModeBannerClass(styles, isSidebarOpen)}>
              {module === "OPEN_STORE"
                ? "Doble clic en el mapa para fijar la ubicacion de tu negocio."
              : module === "SHOPPING"
                  ? "Prepara tu lista y deja que FindIt te arme la ruta."
                  : "Selecciona una de tus tiendas para editarla y actualizar su inventario."}
            </div>
          )}

          {showExplorePanels ? (
            <div className={styles.mapPanelDock}>
              <div className={styles.panelDockActions}>
                <button
                  aria-label="Cerrar paneles"
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.panelCloseButton}`}
                  type="button"
                  onClick={handleCloseMapPanels}
                >
                  <span className={styles.buttonIcon} aria-hidden="true">
                    <CloseIcon />
                  </span>
                </button>
              </div>

              <section className={`${styles.panelCard} ${styles.mapPanel}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Explorar</h2>
                    <p>Busca productos o revisa negocios cercanos.</p>
                  </div>
                </div>

                {selectedStore ? (
                  <div className={styles.stack}>
                    <div>
                      <strong className={styles.panelTitle}>{selectedStore.name}</strong>
                      <p className={styles.panelMeta}>
                        {formatStoreCategory(selectedStore.category)}
                        {selectedStoreSummary?.distanceKm !== null && selectedStoreSummary?.distanceKm !== undefined
                          ? ` - ${selectedStoreSummary.distanceKm.toFixed(1)} km`
                          : ""}
                      </p>
                      <p className={styles.panelMeta}>Propietario: {selectedStore.ownerDisplayName}</p>
                    </div>

                    {selectedStore.photos.length > 0 ? (
                      <div className={styles.photoRow}>
                        {selectedStore.photos.slice(0, 3).map((photo) => (
                          <Image
                            key={photo.id}
                            className={styles.photoStripImage}
                            src={photo.imageDataUrl}
                            alt={photo.filename}
                            width={240}
                            height={180}
                            unoptimized
                          />
                        ))}
                      </div>
                    ) : null}

                    {selectedStore.inventory.length > 0 ? (
                      <div className={styles.inventoryList}>
                        {selectedStore.inventory.slice(0, 6).map((item) => (
                          <article key={item.inventoryItemId} className={styles.inventoryItem}>
                            <div>
                              <strong>{item.productName}</strong>
                              <p>{formatProductCategory(item.category)} - {item.unit}</p>
                            </div>
                            <span>{formatCurrency(item.price)}</span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.emptyHint}>Todavia no hay productos publicados en esta tienda.</div>
                    )}

                    {selectedStore.canManage ? (
                      <button
                        className={`${styles.button} ${styles.buttonPrimary}`}
                        type="button"
                        onClick={handleOpenSelectedBusiness}
                      >
                        Gestionar este negocio
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className={styles.emptyHint}>Selecciona una tienda en el mapa para ver sus detalles.</div>
                )}
              </section>

              <section className={`${styles.panelCard} ${styles.mapPanel}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>{options.length > 0 ? "Resultados" : "Tiendas"}</h2>
                    <p>
                      {options.length > 0
                        ? "Estas son las mejores coincidencias de tu busqueda."
                        : "Negocios disponibles alrededor de tu ubicacion."}
                    </p>
                  </div>
                </div>

                <div className={styles.listStack}>
                  {options.length > 0 ? (
                    options.map((option) => (
                      <button
                        key={`${option.storeId}-${option.productName}-${option.brandName ?? ""}`}
                        className={buildListButtonClass(styles, selectedStoreId === option.storeId)}
                        type="button"
                        onClick={() => handleStoreSelect(option.storeId)}
                      >
                        <strong>{option.productName}</strong>
                        <span>{option.brandName ? `Marca: ${option.brandName}` : "Sin marca"}</span>
                        <span>{option.storeName}</span>
                        <div className={styles.listRowMeta}>
                          <small>{formatCurrency(option.price)}</small>
                        </div>
                      </button>
                    ))
                  ) : nearbyStores.length > 0 ? (
                    nearbyStores.map((store) => (
                      <button
                        key={store.id}
                        className={buildListButtonClass(styles, selectedStoreId === store.id)}
                        type="button"
                        onClick={() => handleStoreSelect(store.id)}
                      >
                        <strong>{store.name}</strong>
                        <span>{formatStoreCategory(store.category)}</span>
                        <div className={styles.listRowMeta}>
                          <small>{store.ownerDisplayName}</small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className={styles.emptyHint}>No encontramos negocios cercanos por ahora.</div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {showShoppingPanel ? (
            <div className={`${styles.mapPanelDock} ${styles.shoppingPanelDock}`}>
              <div className={styles.panelDockActions}>
                <button
                  aria-label="Cerrar compras"
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.panelCloseButton}`}
                  type="button"
                  onClick={handleCloseShoppingPanel}
                >
                  <span className={styles.buttonIcon} aria-hidden="true">
                    <CloseIcon />
                  </span>
                </button>
              </div>

              <section className={`${styles.panelCard} ${styles.mapPanel} ${styles.shoppingMapPanel}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Lista de compra</h2>
                    <p>Escribe lo que necesitas y deja que FindIt te sugiera la mejor vuelta.</p>
                  </div>
                </div>

                {shoppingWorkflowStep === "TRANSPORT" ? (
                  <div className={styles.shoppingWizardCard}>
                    <div className={styles.shoppingWizardBadge}>Paso 1 de 6</div>
                    <p className={styles.shoppingWizardTitle}>Primero cuentanos como te vas a desplazar.</p>

                    <div className={styles.shoppingTravelModeBar}>
                      <div className={styles.shoppingTravelModeButtons}>
                        <button
                          className={buildShoppingTravelModeButtonClass(styles, shoppingTravelMode === "DRIVING")}
                          type="button"
                          onClick={() => handleShoppingTravelModeChange("DRIVING")}
                        >
                          Vehiculo
                        </button>
                        <button
                          className={buildShoppingTravelModeButtonClass(styles, shoppingTravelMode === "WALKING")}
                          type="button"
                          onClick={() => handleShoppingTravelModeChange("WALKING")}
                        >
                          A pie
                        </button>
                      </div>
                      <p className={styles.shoppingTravelModeHint}>
                        {shoppingTravelMode === "WALKING"
                          ? "A pie usamos una ruta peatonal por calles, senderos y pasos disponibles."
                          : "En vehiculo trazamos la ruta siguiendo las vias disponibles."}
                      </p>
                    </div>

                    <button
                      className={`${styles.button} ${styles.buttonPrimary} ${styles.shoppingWizardContinue}`}
                      type="button"
                      onClick={handleContinueShoppingSetup}
                    >
                      Continuar
                    </button>
                  </div>
                ) : shoppingWorkflowStep === "SOURCE" ? (
                  <div className={styles.shoppingWizardCard}>
                    <div className={styles.shoppingWizardBadge}>Paso 2 de 6</div>
                    <p className={styles.shoppingWizardTitle}>Elige si vas a empezar con productos nuevos o con una lista guardada.</p>

                    <div className={styles.shoppingSourceChoiceGrid}>
                      <button
                        className={styles.shoppingSourceChoiceCard}
                        type="button"
                        onClick={() => handleSelectShoppingListSource("NEW")}
                      >
                        <strong>Lista nueva</strong>
                        <span>Empieza desde cero y agrega tus productos.</span>
                      </button>

                      <button
                        className={`${styles.shoppingSourceChoiceCard} ${shoppingListSource === "SAVED" ? styles.shoppingSourceChoiceCardActive : ""}`}
                        type="button"
                        onClick={() => handleSelectShoppingListSource("SAVED")}
                      >
                        <strong>Lista guardada</strong>
                        <span>Usa una de tus listas ya guardadas.</span>
                      </button>
                    </div>

                    {shoppingListSource === "SAVED" ? (
                      <div className={styles.shoppingSourceChoicePanel}>
                        <div className={styles.shoppingLibraryHeader}>
                          <div>
                            <strong>Tus listas guardadas</strong>
                            <p>Elige una lista para cargar sus productos y seguir al resumen.</p>
                          </div>
                        </div>

                        {isLoadingSavedShoppingLists ? (
                          <div className={styles.emptyHint}>Cargando tus listas guardadas...</div>
                        ) : savedShoppingLists.length > 0 ? (
                          <div className={styles.shoppingSavedListGrid}>
                            {savedShoppingLists.map((savedShoppingList) => (
                              <div key={savedShoppingList.id} className={styles.shoppingSavedListRow}>
                                <button
                                  className={buildSavedShoppingListCardClass(
                                    styles,
                                    activeSavedShoppingListId === savedShoppingList.id,
                                  )}
                                  type="button"
                                  onClick={() => handleUseSavedShoppingList(savedShoppingList)}
                                >
                                  <strong>{savedShoppingList.name}</strong>
                                  <span>{savedShoppingList.items.length} productos guardados</span>
                                </button>

                                <button
                                  className={`${styles.button} ${styles.buttonSecondary} ${styles.shoppingSavedListDelete}`}
                                  type="button"
                                  onClick={() => handleDeleteSavedShoppingList(savedShoppingList.id)}
                                  disabled={deletingSavedShoppingListId === savedShoppingList.id}
                                >
                                  {deletingSavedShoppingListId === savedShoppingList.id ? "..." : "Borrar"}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.emptyHint}>
                            Guarda una lista una vez y luego podras cargarla aqui con un toque.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={styles.shoppingSourceChoicePanel}>
                        <p className={styles.shoppingTravelModeHint}>
                          Si quieres, tambien puedes guardar una lista nueva una vez que termines de agregar productos.
                        </p>
                      </div>
                    )}
                  </div>
                ) : shoppingWorkflowStep === "ITEMS" ? (
                  <form className={styles.stack} onSubmit={handleBuildShoppingPlan}>
                    <div className={styles.shoppingWizardToolbar}>
                      <div>
                        <div className={styles.shoppingWizardBadge}>Paso 3 de 6</div>
                        <strong>Agrega y ajusta tus productos</strong>
                        <p className={styles.panelMeta}>
                          {shoppingListSource === "SAVED"
                            ? "La lista guardada ya esta cargada. Puedes editar sus productos antes de continuar."
                            : "Empieza a escribir los productos que quieres comprar."}
                        </p>
                      </div>

                      <div className={styles.shoppingWizardActions}>
                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={handleEditShoppingSource}
                        >
                          Cambiar origen
                        </button>

                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={() => {
                            setShoppingWorkflowStep("TRANSPORT");
                            setStatus("Vuelve a elegir como te desplazaras.");
                          }}
                        >
                          Cambiar medio
                        </button>
                      </div>
                    </div>

                    <div className={styles.shoppingLibraryCard}>
                      <div className={styles.shoppingLibraryHeader}>
                        <div>
                          <strong>Nombre de la lista</strong>
                          <p>Este nombre te ayuda a guardar y volver a usar tus compras frecuentes.</p>
                        </div>
                      </div>

                      <div className={styles.shoppingLibraryComposer}>
                        <input
                          className={styles.input}
                          value={shoppingListName}
                          onChange={(event) => setShoppingListName(event.target.value)}
                          placeholder="Nombre de la lista"
                        />

                        <div className={styles.shoppingLibraryActions}>
                          <button
                            className={`${styles.button} ${styles.buttonSecondary}`}
                            type="button"
                            onClick={handleStartFreshShoppingList}
                          >
                            Nueva lista
                          </button>

                          <button
                            className={`${styles.button} ${styles.buttonPrimary}`}
                            type="button"
                            onClick={handleSaveShoppingList}
                            disabled={isSavingSavedShoppingList || !hasShoppingDraftItems}
                          >
                            {isSavingSavedShoppingList
                              ? "Guardando..."
                              : activeSavedShoppingListId
                                ? "Actualizar lista"
                                : "Guardar lista"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.shoppingListStack}>
                      {shoppingList.map((item, index) => {
                        const suggestions = shoppingSuggestions[item.id] ?? [];
                        const isLoadingSuggestions = shoppingSuggestionsLoading[item.id] ?? false;
                        const shouldShowSuggestions =
                          activeShoppingItemId === item.id && item.query.trim().length >= 2;

                        return (
                          <div key={item.id} className={styles.shoppingListEntry}>
                            <div className={styles.shoppingListRow}>
                              <span className={styles.shoppingListIndex}>{index + 1}</span>
                              <input
                                className={styles.input}
                                value={item.query}
                                onBlur={() => handleShoppingItemBlur(item.id)}
                                onChange={(event) => handleUpdateShoppingItem(item.id, event.target.value)}
                                onFocus={() => handleShoppingItemFocus(item.id)}
                                placeholder="Ej. arroz, leche, jabon..."
                                autoComplete="off"
                              />
                              <button
                                className={`${styles.button} ${styles.buttonSecondary} ${styles.shoppingListRemove}`}
                                type="button"
                                onClick={() => handleRemoveShoppingItem(item.id)}
                                disabled={shoppingList.length === 1}
                              >
                                Quitar
                              </button>
                            </div>

                            {shouldShowSuggestions ? (
                              <div className={styles.shoppingSuggestionPanel}>
                                {isLoadingSuggestions ? (
                                  <span className={styles.shoppingSuggestionHint}>Buscando sugerencias...</span>
                                ) : suggestions.length > 0 ? (
                              suggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    className={styles.shoppingSuggestionButton}
                                    type="button"
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        handleShoppingSuggestionSelect(item.id, suggestion);
                                      }}
                                  >
                                    <strong>{suggestion.name}</strong>
                                    <span>
                                      {formatProductCategory(suggestion.category)} - {suggestion.unit}
                                    </span>
                                    <span>{suggestion.brandName ? `Marca: ${suggestion.brandName}` : "Sin marca"}</span>
                                  </button>
                                ))
                                ) : (
                                  <span className={styles.shoppingSuggestionHint}>
                                    No encontramos coincidencias. Prueba con otra palabra.
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.shoppingListActions}>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        type="button"
                        onClick={handleAddShoppingItem}
                      >
                        Agregar producto
                      </button>

                      <button
                        className={`${styles.button} ${styles.buttonPrimary}`}
                        type="submit"
                        disabled={isPlanningShopping}
                      >
                        {isPlanningShopping ? "Armando ruta..." : "Ir de compras"}
                      </button>
                    </div>
                  </form>
                ) : shoppingWorkflowStep === "OPTIONS" && shoppingPlan ? (
                  <div className={styles.shoppingSummaryStack}>
                    <div className={styles.shoppingWizardToolbar}>
                      <div>
                        <div className={styles.shoppingWizardBadge}>Paso 4 de 6</div>
                        <strong>Elige la coincidencia exacta</strong>
                        <p className={styles.panelMeta}>
                          Buscamos varios productos por cada artículo. Escoge el que realmente quieres comprar, aunque la tienda lo nombre distinto.
                        </p>
                      </div>

                      <div className={styles.shoppingWizardActions}>
                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={handleEditShoppingItems}
                        >
                          Editar lista
                        </button>
                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={handleEditShoppingOptions}
                        >
                          Cambiar opciones
                        </button>
                        <button
                          className={`${styles.button} ${styles.buttonPrimary}`}
                          type="button"
                          onClick={handleContinueShoppingSummary}
                        >
                          Ver ruta
                        </button>
                      </div>
                    </div>

                    <div className={styles.shoppingSelectionStack}>
                      {shoppingPlan.items.map((item) => {
                        const selectedInventoryItemId =
                          selectedShoppingOptions[item.requestId]
                          ?? item.selectedInventoryItemId
                          ?? item.options[0]?.inventoryItemId
                          ?? null;

                        return (
                          <article key={item.requestId} className={styles.shoppingSummaryItemCard}>
                            <div className={styles.shoppingSummaryItemHeader}>
                              <strong>{item.productQuery}</strong>
                            </div>

                            {item.options.length > 0 ? (
                              <div className={styles.shoppingOptionList}>
                                {item.options.map((option) => {
                                  const isActive = option.inventoryItemId === selectedInventoryItemId;

                                  return (
                                    <button
                                      key={option.inventoryItemId}
                                      className={buildShoppingOptionCardClass(styles, isActive)}
                                      type="button"
                                      onClick={() => handleShoppingOptionSelect(item.requestId, option.inventoryItemId)}
                                    >
                                      <div className={styles.shoppingOptionContent}>
                                        {option.imageDataUrl ? (
                                          <Image
                                            className={styles.shoppingOptionThumb}
                                            src={option.imageDataUrl}
                                            alt={option.productName}
                                            width={72}
                                            height={72}
                                            unoptimized
                                          />
                                        ) : (
                                          <div className={styles.shoppingOptionThumbPlaceholder}>
                                            Sin imagen
                                          </div>
                                        )}

                                        <div className={styles.shoppingOptionBody}>
                                          <strong>{option.productName}</strong>
                                          <span>{option.brandName ? `Marca: ${option.brandName}` : "Sin marca"}</span>
                                          <span>{option.storeName}</span>
                                          <small>
                                            {option.unit} · {formatDistance(option.distanceKm)} de distancia
                                          </small>
                                        </div>
                                      </div>

                                      <strong className={styles.shoppingOptionPrice}>
                                        {formatCurrency(option.price)}
                                      </strong>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className={styles.emptyHint}>No encontramos coincidencias para este producto.</div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : shoppingWorkflowStep === "ROUTE" && shoppingPlan ? (
                  <div className={styles.shoppingSummaryStack}>
                    <div className={styles.shoppingWizardToolbar}>
                      <div>
                        <div className={styles.shoppingWizardBadge}>Paso 5 de 6</div>
                        <strong>Tiendas y ruta</strong>
                        <p className={styles.panelMeta}>
                          Aqui ves las tiendas ordenadas por distancia y los productos que debes comprar en cada una.
                        </p>
                      </div>

                      <div className={styles.shoppingWizardActions}>
                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={handleEditShoppingOptions}
                        >
                          Editar opciones
                        </button>

                        <button
                          className={`${styles.button} ${styles.buttonPrimary}`}
                          type="button"
                          onClick={handleContinueShoppingFinalSummary}
                        >
                          Ver resumen
                        </button>
                      </div>
                    </div>

                    <div className={styles.shoppingSummaryStops}>
                      {shoppingRouteStops.length > 0 ? (
                        shoppingRouteStops.map((stop, index) => (
                          <article key={stop.storeId} className={styles.shoppingSummaryStopCard}>
                            <div className={styles.shoppingSummaryStopHeader}>
                              <strong>{index + 1}. {stop.storeName}</strong>
                              <span>{formatDistance(stop.distanceFromPreviousKm)} de recorrido</span>
                            </div>
                            <p>{stop.address}</p>
                            <div className={styles.shoppingSummaryStopProducts}>
                              <span>Debes comprar aqui</span>
                              <ul>
                                {stop.products.map((product) => (
                                  <li key={product.inventoryItemId} className={styles.shoppingSummaryStopProduct}>
                                    <strong>{product.productName}</strong>
                                    <span>
                                      {product.brandName ? `${product.brandName} · ` : ""}
                                      {product.unit} · {formatCurrency(product.price)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className={styles.shoppingSummaryStopMeta}>
                              <span>{stop.products.length} productos</span>
                              <strong>{formatCurrency(stop.subtotal)}</strong>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className={styles.emptyHint}>No encontramos paradas sugeridas para esta compra.</div>
                      )}
                    </div>
                  </div>
                ) : shoppingPlan ? (
                  <div className={styles.shoppingSummaryStack}>
                    <div className={styles.shoppingWizardToolbar}>
                      <div>
                        <div className={styles.shoppingWizardBadge}>Paso 6 de 6</div>
                        <strong>Resumen de tu compra</strong>
                        <p className={styles.panelMeta}>Aqui solo ves el resumen final de la ruta y los totales.</p>
                      </div>

                      <div className={styles.shoppingWizardActions}>
                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={handleEditShoppingItems}
                        >
                          Editar productos
                        </button>

                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
                          type="button"
                          onClick={handleEditShoppingSource}
                        >
                          Cambiar origen
                        </button>
                      </div>
                    </div>

                    <div className={styles.shoppingSummaryGrid}>
                      <article>
                        <span>Productos</span>
                        <strong>{shoppingPlan.items.length}</strong>
                      </article>
                      <article>
                        <span>Cubiertos</span>
                        <strong>{shoppingPlan.coveredItems}</strong>
                      </article>
                      <article>
                        <span>Tiendas</span>
                        <strong>{shoppingRouteStops.length}</strong>
                      </article>
                      <article>
                        <span>Total</span>
                        <strong>{formatCurrency(shoppingRouteStops.reduce((total, stop) => total + stop.subtotal, 0))}</strong>
                      </article>
                    </div>

                    <div className={styles.shoppingSummaryItems}>
                      {shoppingPlan.items.map((item) => {
                        const selectedInventoryItemId =
                          selectedShoppingOptions[item.requestId]
                          ?? item.selectedInventoryItemId
                          ?? item.options[0]?.inventoryItemId
                          ?? null;
                        const selectedOption =
                          item.options.find((option) => option.inventoryItemId === selectedInventoryItemId)
                          ?? item.options[0]
                          ?? null;

                        return (
                          <article key={item.requestId} className={styles.shoppingSummaryItemCard}>
                            <div className={styles.shoppingSummaryItemHeader}>
                              <strong>{item.productQuery}</strong>
                              <span>
                                {selectedOption
                                  ? `${selectedOption.storeName} · ${formatCurrency(selectedOption.price)}`
                                  : "Sin coincidencias"}
                              </span>
                            </div>
                            {selectedOption ? (
                              <p>
                                Compra <strong>{selectedOption.productName}</strong>
                                {selectedOption.brandName ? ` de ${selectedOption.brandName}` : ""}
                                {" "}en {selectedOption.storeName}.
                              </p>
                            ) : (
                              <p>No encontramos una tienda para este producto en tu zona.</p>
                            )}
                          </article>
                        );
                      })}
                    </div>

                    <button
                      className={`${styles.button} ${styles.buttonPrimary}`}
                      type="button"
                      onClick={handleFinalizeShoppingPurchase}
                    >
                      Finalizar compra
                    </button>
                  </div>
                ) : (
                  <div className={styles.emptyHint}>
                    Agrega tus productos y pulsa Ir de compras para ver el resumen.
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {showOpenStorePanel ? (
            <div className={styles.mapPanelDock}>
              <div className={styles.panelDockActions}>
                <button
                  aria-label="Cerrar formulario"
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.panelCloseButton}`}
                  type="button"
                  onClick={handleCloseMapPanels}
                >
                  <span className={styles.buttonIcon} aria-hidden="true">
                    <CloseIcon />
                  </span>
                </button>
              </div>

              <section className={`${styles.panelCard} ${styles.mapPanel}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>
                      {isEditingStoreLocation ? "Corregir ubicación" : "Abrir tienda"}
                    </h2>
                    <p>
                      {isEditingStoreLocation
                        ? `Haz doble clic en el mapa para mover la ubicación de ${selectedStore?.name ?? "tu tienda"}.`
                        : "Haz doble clic en el mapa para colocar tu pin y empezar."}
                    </p>
                  </div>
                </div>

                {!draftStore ? (
                  <div className={styles.emptyHint}>
                    {isEditingStoreLocation
                      ? "Busca el punto exacto de tu negocio y haz doble clic para corregirlo en el mapa."
                      : "Busca el punto exacto de tu negocio y haz doble clic para fijarlo en el mapa."}
                  </div>
                ) : isEditingStoreLocation ? (
                  <form className={styles.stack} onSubmit={handleCreateStore}>
                    <div className={styles.coordinateBadge}>
                      La dirección se calculará automáticamente al guardar
                    </div>

                    <div className={styles.emptyHint}>
                      Se guardará la ubicación junto con el nombre, tipo y fotos actuales de tu tienda.
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.button} ${styles.buttonPrimary}`}
                        type="submit"
                        disabled={isSavingStore}
                      >
                        {isSavingStore ? "Guardando..." : "Guardar ubicación"}
                      </button>

                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        type="button"
                        onClick={handleCancelStoreLocationEdit}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className={styles.stack} onSubmit={handleCreateStore}>
                    <div className={styles.coordinateBadge}>
                      La dirección se calculará automáticamente al guardar
                    </div>

                    <div>
                      <label className={styles.fieldLabel}>Nombre de la tienda</label>
                      <input
                        className={styles.input}
                        value={newStoreForm.name}
                        onChange={(event) =>
                          setNewStoreForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Ej. Panaderia del barrio"
                      />
                    </div>

                    <div>
                      <label className={styles.fieldLabel}>Tipo de tienda</label>
                      <select
                        className={styles.select}
                        value={newStoreForm.category}
                        onChange={(event) =>
                          setNewStoreForm((current) => ({
                            ...current,
                            category: event.target.value as StoreCategory,
                          }))
                        }
                      >
                        {storeCategoryOptions.map((categoryOption) => (
                          <option key={categoryOption.value} value={categoryOption.value}>
                            {categoryOption.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={styles.fieldLabel}>Fotos</label>
                      <input
                        className={styles.fileInput}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleNewStorePhotosChange}
                      />
                    </div>

                    {newStorePhotos.length > 0 ? (
                      <div className={styles.photoGrid}>
                        {newStorePhotos.map((photo) => (
                          <article key={`${photo.filename}-${photo.imageDataUrl.slice(0, 24)}`} className={styles.photoCard}>
                            <Image
                              className={styles.photoPreview}
                              src={photo.imageDataUrl}
                              alt={photo.filename}
                              width={320}
                              height={320}
                              unoptimized
                            />
                            <span>{photo.filename}</span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.emptyHint}>Sube algunas fotos para presentar mejor tu negocio.</div>
                    )}

                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.button} ${styles.buttonPrimary}`}
                        type="submit"
                        disabled={isSavingStore}
                      >
                        {isSavingStore ? "Guardando..." : "Publicar tienda"}
                      </button>

                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        type="button"
                        onClick={handleCancelNewStore}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          ) : null}

          <div className={styles.topActions}>
            <button
              className={`${styles.button} ${styles.buttonSecondary} ${styles.floatingActionButton}`}
              type="button"
              onClick={requestDeviceLocation}
              disabled={isLocating}
            >
              <span
                className={`${styles.buttonIcon} ${
                  activeLocation.source === "gps" ? styles.buttonIconActive : ""
                }`}
                aria-hidden="true"
              >
                <GpsIcon />
              </span>
              <span className={styles.buttonLabel}>{isLocating ? "Ubicando..." : "GPS"}</span>
            </button>

            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              type="button"
              onClick={handleLogout}
            >
              Cerrar sesion
            </button>
          </div>
        </div>

      </section>

      {module === "MY_BUSINESSES" ? (
        <section className={styles.businessOverlay}>
          <div className={styles.businessWindow}>
            <header className={styles.businessWindowHeader}>
              <div>
                <span className={styles.eyebrow}>Tus negocios</span>
                <h2 className={styles.businessWindowTitle}>
                  {selectedUser?.role === "ADMIN"
                    ? "Panel admin de negocios"
                    : "Gestiona tus negocios"}
                </h2>
                <p className={styles.businessWindowLead}>
                  {selectedUser?.role === "ADMIN"
                    ? "Puedes revisar, editar y actualizar cualquier tienda."
                    : "Aqui puedes editar datos de tus tiendas y administrar el inventario."}
                </p>
              </div>

              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                type="button"
                onClick={handleCloseBusinessOverlay}
              >
                Cerrar
              </button>
            </header>

            {managedStores.length > 0 ? (
              <div className={styles.businessWindowBody}>
                <aside className={styles.businessDirectory}>
                  <div className={styles.businessDirectoryHeader}>
                    <h3>Negocios</h3>
                    <p>Selecciona una tienda para trabajar en ella.</p>
                  </div>

                  <div className={styles.listStack}>
                    {managedStores.map((store) => (
                      <button
                        key={store.id}
                        className={buildListButtonClass(styles, selectedStoreId === store.id)}
                        type="button"
                        onClick={() => handleStoreSelect(store.id)}
                      >
                        <strong>{store.name}</strong>
                        <span>{formatStoreCategory(store.category)}</span>
                        <div className={styles.listRowMeta}>
                          <small>{store.ownerDisplayName}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className={styles.businessContent}>
                  {selectedStore?.canManage ? (
                    <>
                      <section className={`${styles.panelCard} ${styles.businessHeroCard}`}>
                        <div className={styles.panelHeader}>
                          <div>
                            <h2>{selectedStore.name}</h2>
                            <p>{selectedStore.address}</p>
                          </div>

                          <span className={styles.userRoleBadge}>
                            {selectedUser?.role === "ADMIN" ? "Admin" : "Propietario"}
                          </span>
                        </div>

                        <div className={styles.inventorySummaryGrid}>
                          <article>
                            <span>Productos</span>
                            <strong>{selectedStore.inventory.length}</strong>
                          </article>
                          <article>
                            <span>Con codigo</span>
                            <strong>{selectedStore.inventory.filter((item) => item.barcode).length}</strong>
                          </article>
                          <article>
                            <span>Con imagen</span>
                            <strong>{selectedStore.inventory.filter((item) => item.imageDataUrl).length}</strong>
                          </article>
                          <article>
                            <span>Fotos</span>
                            <strong>{selectedStore.photos.length}</strong>
                          </article>
                        </div>
                      </section>

                      <nav className={styles.businessSectionNav}>
                        <button
                          className={buildBusinessSectionButtonClass(styles, businessSection === "INVENTORY")}
                          type="button"
                          onClick={() => setBusinessSection("INVENTORY")}
                        >
                          Mi inventario
                        </button>
                        <button
                          className={buildBusinessSectionButtonClass(styles, businessSection === "MY_PRODUCTS")}
                          type="button"
                          onClick={() => {
                            resetProductComposer();
                            setBusinessSection("MY_PRODUCTS");
                          }}
                        >
                          Mis productos
                        </button>
                        <button
                          className={buildBusinessSectionButtonClass(styles, businessSection === "DETAILS")}
                          type="button"
                          onClick={() => setBusinessSection("DETAILS")}
                        >
                          Editar mi negocio
                        </button>
                      </nav>

                      {businessSection === "INVENTORY" ? (
                        <section className={styles.panelCard}>
                          <div className={styles.panelHeader}>
                            <div>
                              <h2>Mi inventario</h2>
                              <p>Busca, filtra y organiza mejor todo lo que vendes.</p>
                            </div>

                            <button
                              className={`${styles.button} ${styles.buttonPrimary}`}
                              type="button"
                              onClick={() => {
                                resetProductComposer();
                                setBusinessSection("MY_PRODUCTS");
                              }}
                            >
                              Agregar producto
                            </button>
                          </div>

                          <div className={styles.inventoryToolbar}>
                            <input
                              className={styles.input}
                              value={inventorySearch}
                              onChange={(event) => setInventorySearch(event.target.value)}
                              placeholder="Busca por nombre, unidad o codigo de barras"
                            />

                            <select
                              className={styles.select}
                              value={inventoryCategoryFilter}
                              onChange={(event) =>
                                setInventoryCategoryFilter(event.target.value as InventoryCategoryFilter)
                              }
                            >
                              <option value="ALL">Todas las categorias</option>
                              {productCategoryOptions.map((categoryOption) => (
                                <option key={categoryOption.value} value={categoryOption.value}>
                                  {categoryOption.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {filteredInventory.length > 0 ? (
                            <div className={styles.inventoryCatalog}>
                              {filteredInventory.map((item) => (
                                <article key={item.inventoryItemId} className={styles.inventoryCard}>
                                  <div className={styles.inventoryCardMedia}>
                                    {item.imageDataUrl ? (
                                    <Image
                                      className={styles.inventoryCardImage}
                                      src={item.imageDataUrl}
                                      alt={item.productName}
                                      width={220}
                                      height={220}
                                      unoptimized
                                    />
                                    ) : (
                                    <div className={styles.inventoryCardPlaceholder}>Sin imagen</div>
                                    )}
                                  </div>

                                  <div className={styles.inventoryCardBody}>
                                    <div className={styles.inventoryCardHeader}>
                                      <div>
                                        <strong>{item.productName}</strong>
                                        <p className={styles.inventoryCardMeta}>{item.brandName ? `Marca: ${item.brandName}` : "Sin marca"}</p>
                                      </div>
                                      <span className={styles.inventoryPriceTag}>{formatCurrency(item.price)}</span>
                                    </div>

                                    <p className={styles.inventoryCardMeta}>{formatProductCategory(item.category)} - {item.unit}</p>

                                    <p className={styles.inventoryCardMetaHidden}>
                                      {formatProductCategory(item.category)} · {item.unit}
                                    </p>

                                    <div className={styles.inventoryTagRow}>
                                      <span className={styles.barcodePill}>
                                        {item.barcode ? `Cod. ${item.barcode}` : "Sin codigo"}
                                      </span>
                                      <span className={styles.inventoryStatPill}>
                                        {formatQualityScore(item.qualityScore)}
                                      </span>
                                    </div>

                                    <div className={styles.inventoryActionRow}>
                                      <span className={styles.inventoryProductHint}>
                                        {item.imageDataUrl ? "Con foto lista para mostrar." : "Agrega una foto para que destaque mas."}
                                      </span>
                                      <button
                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                        type="button"
                                        onClick={() => handleEditProduct(item.inventoryItemId)}
                                      >
                                        Editar
                                      </button>

                                      <button
                                        className={`${styles.button} ${styles.buttonDanger}`}
                                        type="button"
                                        onClick={() => handleDeleteProduct(item.inventoryItemId)}
                                        disabled={isSavingProduct}
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.emptyHint}>
                              {selectedStore.inventory.length > 0
                                ? "No encontramos productos con esos filtros."
                                : "Aun no has agregado productos a esta tienda."}
                            </div>
                          )}
                        </section>
                      ) : null}

                      {businessSection === "MY_PRODUCTS" ? (
                        <section className={styles.panelCard}>
                          <div className={styles.panelHeader}>
                            <div>
                              <h2>{editingInventoryItemId ? "Editar producto" : "Mis productos"}</h2>
                              <p>
                                Empieza por el codigo de barras y completa solo lo necesario para que tu catalogo quede claro.
                              </p>
                            </div>
                          </div>

                          <div className={styles.csvImportCard}>
                            <div className={styles.csvImportCopy}>
                              <strong>Importar desde CSV</strong>
                              <p>
                                Puedes subir varias filas a la vez. Soportamos columnas como barcode, nombre,
                                categoria, unidad, precio y cantidad disponible. Si el barcode existe en la API, se
                                completan nombre, categoria y unidad automaticamente y solo necesitas el precio.
                              </p>
                            </div>

                            <input
                              className={styles.fileInput}
                              type="file"
                              accept=".csv,text/csv"
                              onChange={handleProductCsvImport}
                              disabled={isImportingProducts || isSavingProduct}
                            />

                            {isImportingProducts ? (
                              <p className={styles.productComposerHint}>Importando productos, espera un momento...</p>
                            ) : null}
                          </div>

                          <form className={`${styles.stack} ${styles.productComposer}`} onSubmit={handleAddProduct}>
                            <div>
                              <label className={styles.fieldLabel}>Codigo de barras</label>
                              <div className={styles.fieldActionRow}>
                                <input
                                  className={styles.input}
                                  value={productForm.barcode}
                                  onChange={(event) =>
                                    setProductForm((current) => ({ ...current, barcode: event.target.value }))
                                  }
                                  placeholder="Ej. 7701234567890"
                                />

                                <button
                                  className={`${styles.button} ${styles.buttonSecondary} ${styles.inlineFieldAction}`}
                                  type="button"
                                  onClick={() => {
                                    void handleBarcodeLookup();
                                  }}
                                  disabled={isLookingUpBarcode || !productForm.barcode.trim()}
                                >
                                  {isLookingUpBarcode ? "Buscando..." : "Buscar"}
                                </button>

                                <button
                                  className={`${styles.button} ${styles.buttonSecondary} ${styles.inlineFieldAction}`}
                                  type="button"
                                  onClick={() => {
                                    setIsScannerOpen(true);
                                    setError(null);
                                    setStatus("Apunta la camara al codigo del producto.");
                                  }}
                                >
                                  Escanear
                                </button>
                              </div>
                              <p className={styles.productComposerHint}>
                                Si lo tienes, empieza por aqui y FindIt te ayuda a completar el resto.
                              </p>
                            </div>

                            <div>
                              <label className={styles.fieldLabel}>Nombre del producto</label>
                              <input
                                className={styles.input}
                                value={productForm.name}
                                onChange={(event) =>
                                  setProductForm((current) => ({ ...current, name: event.target.value }))
                                }
                                placeholder="Ej. Shampoo Suave 400ml"
                              />
                            </div>

                            <div>
                              <label className={styles.fieldLabel}>Marca</label>
                              <input
                                className={styles.input}
                                value={productForm.brandName}
                                onChange={(event) =>
                                  setProductForm((current) => ({ ...current, brandName: event.target.value }))
                                }
                                placeholder="Ej. Suave, Diana, Nescafe"
                              />
                              <p className={styles.productComposerHint}>
                                Si escaneas un codigo, FindIt intentara completar la marca automaticamente.
                              </p>
                            </div>

                            <div className={styles.formColumns}>
                              <div>
                                <label className={styles.fieldLabel}>Precio</label>
                              <input
                                className={styles.input}
                                type="number"
                                min="0.01"
                                step="any"
                                value={productForm.price}
                                onWheel={(event) => {
                                  // Evita cambios accidentales del precio con la rueda del mouse.
                                  event.currentTarget.blur();
                                }}
                                onChange={(event) =>
                                  setProductForm((current) => ({ ...current, price: event.target.value }))
                                }
                                placeholder="12900"
                              />
                              </div>

                              <div>
                                <label className={styles.fieldLabel}>Categoria</label>
                                <select
                                  className={styles.select}
                                  value={productForm.category}
                                  onChange={(event) =>
                                    setProductForm((current) => ({
                                      ...current,
                                      category: event.target.value as ProductCategory,
                                    }))
                                  }
                                >
                                  {productCategoryOptions.map((categoryOption) => (
                                    <option key={categoryOption.value} value={categoryOption.value}>
                                      {categoryOption.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className={styles.formColumns}>
                              <div>
                                <label className={styles.fieldLabel}>Unidad o presentacion</label>
                                <input
                                  className={styles.input}
                                  value={productForm.unit}
                                  onChange={(event) =>
                                    setProductForm((current) => ({ ...current, unit: event.target.value }))
                                  }
                                  placeholder="Ej. 400 ml"
                                />
                              </div>

                              <div>
                                <label className={styles.fieldLabel}>Imagen del producto</label>
                                <input
                                  className={styles.fileInput}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleProductImageChange}
                                />
                              </div>
                            </div>

                            {productImage ? (
                              <div className={styles.productImageCard}>
                                <Image
                                  className={styles.productImagePreview}
                                  src={productImage.imageDataUrl}
                                  alt={productImage.filename}
                                  width={240}
                                  height={240}
                                  unoptimized
                                />
                                <div className={styles.productImageMeta}>
                                  <strong>{productImage.filename}</strong>
                                  <button
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    type="button"
                                    onClick={() => setProductImage(null)}
                                  >
                                    Quitar imagen
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={styles.emptyHint}>
                                Agrega una imagen para reconocer el producto mas rapido.
                              </div>
                            )}

                            <div className={styles.cardActions}>
                              <button
                                className={`${styles.button} ${styles.buttonPrimary}`}
                                type="submit"
                                disabled={isSavingProduct}
                              >
                                {isSavingProduct
                                  ? "Guardando..."
                                  : editingInventoryItemId
                                    ? "Guardar producto"
                                    : "Agregar producto"}
                              </button>

                              <button
                                className={`${styles.button} ${styles.buttonSecondary}`}
                                type="button"
                                onClick={() => {
                                  resetProductComposer();
                                  setBusinessSection("INVENTORY");
                                }}
                              >
                                {editingInventoryItemId ? "Cancelar" : "Ver inventario"}
                              </button>
                            </div>
                          </form>
                        </section>
                      ) : null}

                      {businessSection === "DETAILS" ? (
                        <section className={styles.panelCard}>
                          <div className={styles.panelHeader}>
                            <div>
                              <h2>Editar mi negocio</h2>
                              <p>{selectedStore.address}</p>
                            </div>
                          </div>

                          <form className={styles.stack} onSubmit={handleUpdateBusiness}>
                            <div className={styles.stack}>
                              <div className={styles.coordinateBadge}>
                                Dirección actual: {selectedStore.address}
                              </div>

                              <button
                                className={`${styles.button} ${styles.buttonSecondary}`}
                                type="button"
                                onClick={handleStartStoreLocationEdit}
                              >
                                Corregir ubicación
                              </button>
                            </div>

                            <div>
                              <label className={styles.fieldLabel}>Nombre de la tienda</label>
                              <input
                                className={styles.input}
                                value={businessForm.name}
                                onChange={(event) =>
                                  setBusinessForm((current) => ({ ...current, name: event.target.value }))
                                }
                              />
                            </div>

                            <div>
                              <label className={styles.fieldLabel}>Tipo de tienda</label>
                              <select
                                className={styles.select}
                                value={businessForm.category}
                                onChange={(event) =>
                                  setBusinessForm((current) => ({
                                    ...current,
                                    category: event.target.value as StoreCategory,
                                  }))
                                }
                              >
                                {storeCategoryOptions.map((categoryOption) => (
                                  <option key={categoryOption.value} value={categoryOption.value}>
                                    {categoryOption.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className={styles.fieldLabel}>Fotos del negocio</label>
                              <input
                                className={styles.fileInput}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleBusinessPhotosChange}
                              />
                            </div>

                            {businessPhotos.length > 0 ? (
                              <>
                                <div className={styles.photoGrid}>
                                  {businessPhotos.map((photo) => (
                                    <article key={`${photo.filename}-${photo.imageDataUrl.slice(0, 24)}`} className={styles.photoCard}>
                                      <Image
                                        className={styles.photoPreview}
                                        src={photo.imageDataUrl}
                                        alt={photo.filename}
                                        width={320}
                                        height={320}
                                        unoptimized
                                      />
                                      <span>{photo.filename}</span>
                                    </article>
                                  ))}
                                </div>

                                <button
                                  className={`${styles.button} ${styles.buttonSecondary}`}
                                  type="button"
                                  onClick={() => setBusinessPhotos([])}
                                >
                                  Quitar fotos
                                </button>
                              </>
                            ) : (
                              <div className={styles.emptyHint}>Puedes guardar tu negocio con o sin fotos.</div>
                            )}

                            <div className={styles.cardActions}>
                              <button
                                className={`${styles.button} ${styles.buttonPrimary}`}
                                type="submit"
                                disabled={isSavingStore}
                              >
                                {isSavingStore ? "Guardando..." : "Guardar cambios"}
                              </button>

                              <button
                                className={`${styles.button} ${styles.buttonDanger}`}
                                type="button"
                                onClick={handleDeleteBusiness}
                                disabled={isDeletingStore}
                              >
                                {isDeletingStore ? "Eliminando..." : "Eliminar tienda"}
                              </button>
                            </div>
                          </form>
                        </section>
                      ) : null}
                    </>
                  ) : (
                    <section className={styles.panelCard}>
                      <div className={styles.emptyHint}>Selecciona uno de tus negocios para empezar a gestionarlo.</div>
                    </section>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.businessEmptyState}>
                <div className={styles.panelCard}>
                  <div className={styles.emptyHint}>
                    Todavia no tienes negocios registrados.
                    <button
                      className={`${styles.button} ${styles.buttonPrimary} ${styles.inlineAction}`}
                      type="button"
                      onClick={() => handleModuleChange("OPEN_STORE")}
                    >
                      Abrir mi tienda
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {notifications.length > 0 ? (
        <div className={styles.notificationStack} aria-live="polite" aria-relevant="additions removals">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`${styles.notificationCard} ${
                notification.tone === "error"
                  ? styles.notificationCardError
                  : notification.tone === "success"
                    ? styles.notificationCardSuccess
                    : styles.notificationCardInfo
              }`}
              role={notification.tone === "error" ? "alert" : "status"}
            >
              <div className={styles.notificationCardHeader}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>

                <button
                  aria-label="Cerrar notificacion"
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.notificationCloseButton}`}
                  type="button"
                  onClick={() => dismissNotification(notification.id)}
                >
                  <span className={styles.buttonIcon} aria-hidden="true">
                    <CloseIcon />
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <BarcodeScannerSheet
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setStatus("Escaner cerrado.");
        }}
        onDetected={handleBarcodeDetected}
      />
    </main>
  );
}

function readInitialSession() {
  const stored = readStoredSession() as Partial<AuthSession> | null;

  if (!stored?.token || !stored.user) {
    return null;
  }

  return stored as AuthSession;
}

function buildSavedLocation(user: UserAccount | null): MapLocation {
  return {
    latitude: user?.preferredLatitude ?? defaultUser.preferredLatitude,
    longitude: user?.preferredLongitude ?? defaultUser.preferredLongitude,
    source: "saved",
  };
}

function readError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Ocurrio un error inesperado.";
  }

  try {
    const parsed = JSON.parse(error.message) as {
      detail?: string;
      message?: string;
      title?: string;
    };

    return parsed.detail ?? parsed.message ?? parsed.title ?? error.message;
  } catch {
    return error.message;
  }
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDistance(value: number) {
  if (value < 1) {
    return `${Math.round(value * 1000)} m`;
  }

  return `${value.toFixed(1)} km`;
}

function formatQualityScore(value: number | null) {
  if (value === null) {
    return "Sin calificaciones";
  }

  return value.toFixed(1);
}

function formatProductCategory(category: ProductCategory) {
  return productCategoryOptions.find((option) => option.value === category)?.label ?? category;
}

function formatStoreCategory(category: StoreCategory) {
  return storeCategoryOptions.find((option) => option.value === category)?.label ?? category;
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function buildWorkspaceClass(moduleStyles: typeof styles, isSidebarOpen: boolean) {
  return isSidebarOpen
    ? `${moduleStyles.workspace} ${moduleStyles.workspaceSidebarOpen}`
    : `${moduleStyles.workspace} ${moduleStyles.workspaceSidebarClosed}`;
}

function buildSearchBarClass(moduleStyles: typeof styles, isSidebarOpen: boolean) {
  return isSidebarOpen
    ? moduleStyles.searchBar
    : `${moduleStyles.searchBar} ${moduleStyles.searchBarShifted}`;
}

function buildModeBannerClass(moduleStyles: typeof styles, isSidebarOpen: boolean) {
  return isSidebarOpen
    ? moduleStyles.modeBanner
    : `${moduleStyles.modeBanner} ${moduleStyles.modeBannerShifted}`;
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v3" />
      <path d="M12 18.5v3" />
      <path d="M2.5 12h3" />
      <path d="M18.5 12h3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}

function buildModuleButtonClass(moduleStyles: typeof styles, isActive: boolean) {
  return isActive
    ? `${moduleStyles.moduleButton} ${moduleStyles.moduleButtonActive}`
    : moduleStyles.moduleButton;
}

function buildListButtonClass(moduleStyles: typeof styles, isActive: boolean) {
  return isActive
    ? `${moduleStyles.listButton} ${moduleStyles.listButtonActive}`
    : moduleStyles.listButton;
}

function buildBusinessSectionButtonClass(moduleStyles: typeof styles, isActive: boolean) {
  return isActive
    ? `${moduleStyles.businessSectionButton} ${moduleStyles.businessSectionButtonActive}`
    : moduleStyles.businessSectionButton;
}

function buildShoppingOptionCardClass(moduleStyles: typeof styles, isActive: boolean) {
  return isActive
    ? `${moduleStyles.shoppingOptionCard} ${moduleStyles.shoppingOptionCardActive}`
    : moduleStyles.shoppingOptionCard;
}

function buildShoppingTravelModeButtonClass(moduleStyles: typeof styles, isActive: boolean) {
  return isActive
    ? `${moduleStyles.shoppingTravelModeButton} ${moduleStyles.shoppingTravelModeButtonActive}`
    : moduleStyles.shoppingTravelModeButton;
}

function buildSavedShoppingListCardClass(moduleStyles: typeof styles, isActive: boolean) {
  return isActive
    ? `${moduleStyles.shoppingSavedListCard} ${moduleStyles.shoppingSavedListCardActive}`
    : moduleStyles.shoppingSavedListCard;
}

function sortStores(stores: StoreSummary[]) {
  return [...stores].sort((left, right) => {
    if (left.distanceKm === null && right.distanceKm === null) {
      return left.name.localeCompare(right.name);
    }

    if (left.distanceKm === null) {
      return 1;
    }

    if (right.distanceKm === null) {
      return -1;
    }

    return left.distanceKm - right.distanceKm;
  });
}

function mergeStores(...collections: StoreSummary[][]) {
  const storeMap = new Map<number, StoreSummary>();

  collections.flat().forEach((store) => {
    storeMap.set(store.id, store);
  });

  return sortStores(Array.from(storeMap.values()));
}

function omitRecordKey<T>(record: Record<string, T>, keyToOmit: string) {
  const nextRecord = { ...record };
  delete nextRecord[keyToOmit];
  return nextRecord;
}

function sortSavedShoppingLists(savedShoppingLists: SavedShoppingList[]) {
  return [...savedShoppingLists].sort((left, right) => {
    const updatedAtComparison = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedAtComparison !== 0) {
      return updatedAtComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function upsertSavedShoppingList(currentSavedShoppingLists: SavedShoppingList[], nextSavedShoppingList: SavedShoppingList) {
  return sortSavedShoppingLists([
    ...currentSavedShoppingLists.filter((item) => item.id !== nextSavedShoppingList.id),
    nextSavedShoppingList,
  ]);
}

function resolveQuantityAvailableForSave(store: StoreDetail | null, editingInventoryItemId: number | null) {
  if (!store || editingInventoryItemId === null) {
    return 0;
  }

  return store.inventory.find((item) => item.inventoryItemId === editingInventoryItemId)?.quantityAvailable ?? 0;
}

function buildShoppingRouteStops(
  plan: ShoppingPlan | null,
  selectedOptions: Record<string, number | null>,
  origin: MapLocation,
): ShoppingStop[] {
  if (!plan) {
    return [];
  }

  const groupedStops = new Map<number, ShoppingStop>();

  plan.items.forEach((item) => {
    const selectedInventoryItemId =
      selectedOptions[item.requestId]
      ?? item.selectedInventoryItemId
      ?? item.options[0]?.inventoryItemId
      ?? null;

    const selectedOption = item.options.find((option) => option.inventoryItemId === selectedInventoryItemId)
      ?? item.options[0]
      ?? null;

    if (!selectedOption) {
      return;
    }

    const currentStop = groupedStops.get(selectedOption.storeId) ?? {
      storeId: selectedOption.storeId,
      storeName: selectedOption.storeName,
      address: selectedOption.storeAddress,
      latitude: selectedOption.storeLatitude,
      longitude: selectedOption.storeLongitude,
      distanceFromPreviousKm: 0,
      subtotal: 0,
      products: [],
    };

    currentStop.products = [
      ...currentStop.products,
      {
        requestId: item.requestId,
        productQuery: item.productQuery,
        inventoryItemId: selectedOption.inventoryItemId,
        productName: selectedOption.productName,
        brandName: selectedOption.brandName,
        price: selectedOption.price,
        unit: selectedOption.unit,
      },
    ];
    currentStop.subtotal += selectedOption.price;

    groupedStops.set(selectedOption.storeId, currentStop);
  });

  const remainingStops = Array.from(groupedStops.values());
  const orderedStops: ShoppingStop[] = [];
  let currentLatitude = origin.latitude;
  let currentLongitude = origin.longitude;

  while (remainingStops.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remainingStops.forEach((stop, index) => {
      const nextDistance = distanceKm(
        currentLatitude,
        currentLongitude,
        stop.latitude,
        stop.longitude,
      );

      if (nextDistance < nearestDistance) {
        nearestDistance = nextDistance;
        nearestIndex = index;
      }
    });

    const [nextStop] = remainingStops.splice(nearestIndex, 1);
    orderedStops.push({
      ...nextStop,
      subtotal: round(nextStop.subtotal),
      distanceFromPreviousKm: round(nearestDistance),
      products: [...nextStop.products].sort((left, right) =>
        left.productQuery.localeCompare(right.productQuery),
      ),
    });

    currentLatitude = nextStop.latitude;
    currentLongitude = nextStop.longitude;
  }

  return orderedStops;
}

function upsertStore(currentStores: StoreSummary[], nextStore: StoreSummary) {
  return sortStores([
    ...currentStores.filter((store) => store.id !== nextStore.id),
    nextStore,
  ]);
}

function toStoreSummary(store: StoreDetail, activeLocation: MapLocation): StoreSummary {
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    address: store.address,
    latitude: store.latitude,
    longitude: store.longitude,
    reputationScore: store.reputationScore,
    distanceKm: round(distanceKm(
      store.latitude,
      store.longitude,
      activeLocation.latitude,
      activeLocation.longitude,
    )),
    ownerDisplayName: store.ownerDisplayName,
    canManage: store.canManage,
  };
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(lat2 - lat1);
  const lonDistance = toRadians(lon2 - lon1);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(lonDistance / 2) *
      Math.sin(lonDistance / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function toDraftPhoto(photo: StoreDetail["photos"][number]): DraftPhoto {
  return {
    filename: photo.filename,
    contentType: photo.contentType,
    imageDataUrl: photo.imageDataUrl,
  };
}

function toDraftPhotoFromInventoryImage(item: StoreDetail["inventory"][number]): DraftPhoto {
  return {
    filename: `${item.productName.replace(/\s+/g, "-").toLowerCase() || "producto"}.png`,
    contentType: readContentTypeFromDataUrl(item.imageDataUrl) ?? "image/png",
    imageDataUrl: item.imageDataUrl ?? "",
  };
}

function toDraftPhotoFromLookup(productName: string, imageDataUrl: string): DraftPhoto {
  return {
    filename: `${productName.replace(/\s+/g, "-").toLowerCase() || "producto"}.png`,
    contentType: readContentTypeFromDataUrl(imageDataUrl) ?? "image/png",
    imageDataUrl,
  };
}

function readContentTypeFromDataUrl(imageDataUrl: string | null) {
  if (!imageDataUrl) {
    return null;
  }

  const match = imageDataUrl.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? null;
}

async function readFileAsDraftPhoto(file: File): Promise<DraftPhoto> {
  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pudimos leer una de las fotos."));
    reader.readAsDataURL(file);
  });

  return {
    filename: file.name,
    contentType: file.type || "image/jpeg",
    imageDataUrl,
  };
}
