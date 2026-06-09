// Tipos TypeScript que reflejan requests y respuestas de la API.
export type StoreCategory =
  | "GROCERY"
  | "PHARMACY"
  | "HARDWARE"
  | "BAKERY"
  | "PET_SHOP"
  | "MINIMARKET";

export type ProductCategory =
  | "FOOD"
  | "BEVERAGE"
  | "HEALTH"
  | "HOME"
  | "PETS"
  | "PERSONAL_CARE";

export type StoreSummary = {
  id: number;
  name: string;
  category: StoreCategory;
  address: string;
  latitude: number;
  longitude: number;
  reputationScore: number;
  distanceKm: number | null;
  ownerDisplayName: string;
  canManage: boolean;
};

export type StorePhoto = {
  id: number;
  filename: string;
  contentType: string;
  imageDataUrl: string;
};

export type StoreDetail = {
  id: number;
  name: string;
  category: StoreCategory;
  address: string;
  latitude: number;
  longitude: number;
  reputationScore: number;
  ownerDisplayName: string;
  canManage: boolean;
  inventory: InventoryItem[];
  photos: StorePhoto[];
};

export type InventoryItem = {
  inventoryItemId: number;
  productId: number;
  productName: string;
  brandName: string | null;
  category: ProductCategory;
  unit: string;
  barcode: string | null;
  price: number;
  quantityAvailable: number;
  qualityScore: number | null;
  imageDataUrl: string | null;
};

export type BarcodeLookupResult = {
  barcode: string;
  productName: string;
  brandName: string | null;
  productCategory: ProductCategory;
  unit: string;
  imageDataUrl: string | null;
  source: string;
};

export type ProductSummary = {
  id: number;
  name: string;
  brandName: string | null;
  category: ProductCategory;
  unit: string;
};

export type SavedShoppingListItem = {
  id: number;
  itemOrder: number;
  productQuery: string;
};

export type SavedShoppingList = {
  id: number;
  name: string;
  items: SavedShoppingListItem[];
  createdAt: string;
  updatedAt: string;
};

export type SearchOption = {
  storeId: number;
  storeName: string;
  productName: string;
  brandName: string | null;
  price: number;
  unit: string;
  quantityAvailable: number;
  qualityScore: number | null;
  storeReputationScore: number;
  distanceKm: number;
  recommendationScore: number;
};

export type ShoppingPlanOption = {
  inventoryItemId: number;
  storeId: number;
  storeName: string;
  storeAddress: string;
  storeLatitude: number;
  storeLongitude: number;
  productName: string;
  brandName: string | null;
  price: number;
  unit: string;
  qualityScore: number | null;
  storeReputationScore: number;
  distanceKm: number;
  recommendationScore: number;
  imageDataUrl: string | null;
};

export type ShoppingPlanItem = {
  requestId: string;
  productQuery: string;
  selectedInventoryItemId: number | null;
  options: ShoppingPlanOption[];
};

export type ShoppingStopItem = {
  requestId: string;
  productQuery: string;
  inventoryItemId: number;
  productName: string;
  brandName: string | null;
  price: number;
  unit: string;
};

export type ShoppingStop = {
  storeId: number;
  storeName: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceFromPreviousKm: number;
  subtotal: number;
  products: ShoppingStopItem[];
};

export type ShoppingPlan = {
  items: ShoppingPlanItem[];
  suggestedStops: ShoppingStop[];
  estimatedTotal: number;
  estimatedDistanceKm: number;
  coveredItems: number;
  missingItems: number;
};

export type UserAccount = {
  id: number;
  fullName: string;
  email: string;
  role: "CUSTOMER" | "STORE_OWNER" | "ADMIN";
  preferredLatitude: number;
  preferredLongitude: number;
  createdAt: string;
};

export type AuthSession = {
  token: string;
  user: UserAccount;
};
