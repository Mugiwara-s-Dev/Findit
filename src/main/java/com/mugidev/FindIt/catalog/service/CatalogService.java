package com.mugidev.FindIt.catalog.service;

import com.mugidev.FindIt.catalog.domain.InventoryItem;
import com.mugidev.FindIt.catalog.domain.Product;
import com.mugidev.FindIt.catalog.domain.ProductCategory;
import com.mugidev.FindIt.catalog.domain.ShoppingList;
import com.mugidev.FindIt.catalog.domain.ShoppingListEntry;
import com.mugidev.FindIt.catalog.domain.Store;
import com.mugidev.FindIt.catalog.domain.StoreCategory;
import com.mugidev.FindIt.catalog.domain.StorePhoto;
import com.mugidev.FindIt.catalog.dto.AddStoreProductRequest;
import com.mugidev.FindIt.catalog.dto.CreateStoreRequest;
import com.mugidev.FindIt.catalog.dto.InventoryItemResponse;
import com.mugidev.FindIt.catalog.dto.InventoryOptionResponse;
import com.mugidev.FindIt.catalog.dto.ProductSummaryResponse;
import com.mugidev.FindIt.catalog.dto.SavedShoppingListItemResponse;
import com.mugidev.FindIt.catalog.dto.SavedShoppingListRequest;
import com.mugidev.FindIt.catalog.dto.SavedShoppingListResponse;
import com.mugidev.FindIt.catalog.dto.SearchRequest;
import com.mugidev.FindIt.catalog.dto.ShoppingOptionResponse;
import com.mugidev.FindIt.catalog.dto.ShoppingPlanItemResponse;
import com.mugidev.FindIt.catalog.dto.ShoppingPlanRequest;
import com.mugidev.FindIt.catalog.dto.ShoppingPlanResponse;
import com.mugidev.FindIt.catalog.dto.ShoppingStopItemResponse;
import com.mugidev.FindIt.catalog.dto.ShoppingStopResponse;
import com.mugidev.FindIt.catalog.dto.StoreDetailResponse;
import com.mugidev.FindIt.catalog.dto.StorePhotoRequest;
import com.mugidev.FindIt.catalog.dto.StorePhotoResponse;
import com.mugidev.FindIt.catalog.dto.StoreSummaryResponse;
import com.mugidev.FindIt.catalog.dto.UpdateStoreProductRequest;
import com.mugidev.FindIt.catalog.dto.UpdateStoreRequest;
import com.mugidev.FindIt.catalog.repository.InventoryItemRepository;
import com.mugidev.FindIt.catalog.repository.ProductRepository;
import com.mugidev.FindIt.catalog.repository.ShoppingListRepository;
import com.mugidev.FindIt.catalog.repository.StoreRepository;
import com.mugidev.FindIt.user.domain.UserAccount;
import com.mugidev.FindIt.user.domain.UserRole;
import com.mugidev.FindIt.user.repository.UserAccountRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.HashMap;
import java.util.HashSet;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final StoreRepository storeRepository;
    private final ProductRepository productRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final ShoppingListRepository shoppingListRepository;
    private final UserAccountRepository userAccountRepository;
    private final double defaultRadiusKm;

    public CatalogService(StoreRepository storeRepository,
                          ProductRepository productRepository,
                          InventoryItemRepository inventoryItemRepository,
                          ShoppingListRepository shoppingListRepository,
                          UserAccountRepository userAccountRepository,
                          @Value("${findit.search.default-radius-km:5.0}") double defaultRadiusKm) {
        this.storeRepository = storeRepository;
        this.productRepository = productRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.shoppingListRepository = shoppingListRepository;
        this.userAccountRepository = userAccountRepository;
        this.defaultRadiusKm = defaultRadiusKm;
    }

    public List<StoreSummaryResponse> listStores(Double userLatitude,
                                                 Double userLongitude,
                                                 Double radiusKm,
                                                 StoreCategory category,
                                                 String currentUserEmail) {
        double effectiveRadius = Optional.ofNullable(radiusKm).orElse(defaultRadiusKm);
        UserAccount currentUser = requireUser(currentUserEmail);
        List<Store> stores = category == null
                ? storeRepository.findAllByOrderByNameAsc()
                : storeRepository.findByCategoryOrderByNameAsc(category);

        return stores.stream()
                .map(store -> toStoreSummary(store, userLatitude, userLongitude, currentUser))
                .filter(store -> store.distanceKm() == null || store.distanceKm() <= effectiveRadius)
                .sorted(Comparator.comparing(StoreSummaryResponse::distanceKm, Comparator.nullsLast(Double::compareTo)))
                .toList();
    }

    public List<StoreSummaryResponse> listManagedStores(Double userLatitude,
                                                        Double userLongitude,
                                                        String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        List<Store> stores = currentUser.getRole() == UserRole.ADMIN
                ? storeRepository.findAllByOrderByNameAsc()
                : storeRepository.findByOwnerIdOrderByNameAsc(currentUser.getId());

        return stores.stream()
                .map(store -> toStoreSummary(store, userLatitude, userLongitude, currentUser))
                .sorted(Comparator.comparing(StoreSummaryResponse::name))
                .toList();
    }

    public StoreDetailResponse getStore(Long storeId, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        return toStoreDetail(requireStore(storeId), currentUser);
    }

    @Transactional
    public StoreDetailResponse createStore(CreateStoreRequest request, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        currentUser.promoteToStoreOwner();

        Store store = new Store(
                currentUser,
                request.name().trim(),
                request.category(),
                String.format(
                        Locale.US,
                        "Ubicacion seleccionada %.5f, %.5f",
                        request.latitude(),
                        request.longitude()
                ),
                request.latitude(),
                request.longitude(),
                5.0
        );

        store.replacePhotos(toStorePhotos(request.photos()));

        Store createdStore = storeRepository.save(store);
        return toStoreDetail(createdStore, currentUser);
    }

    @Transactional
    public StoreDetailResponse updateStore(Long storeId, UpdateStoreRequest request, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        Store store = requireStore(storeId);
        assertCanManageStore(currentUser, store);
        store.updateDetails(request.name().trim(), request.category(), request.latitude(), request.longitude());
        store.replacePhotos(toStorePhotos(request.photos()));
        return toStoreDetail(store, currentUser);
    }

    @Transactional
    public StoreDetailResponse addStoreProduct(Long storeId, AddStoreProductRequest request, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        Store store = requireStore(storeId);
        assertCanManageStore(currentUser, store);
        Product product = resolveProduct(
                request.productName().trim(),
                request.brandName(),
                request.productCategory(),
                request.unit().trim()
        );
        String barcode = normalizeOptionalText(request.barcode());
        String imageDataUrl = normalizeOptionalText(request.imageDataUrl());

        InventoryItem existingItem = findExistingInventoryItem(store, product, barcode);

        if (existingItem != null) {
            existingItem.updateListing(product, request.price(), request.quantityAvailable(), barcode, imageDataUrl);
        } else {
            store.addInventoryItem(new InventoryItem(
                    product,
                    request.price(),
                    request.quantityAvailable(),
                    null,
                    barcode,
                    imageDataUrl
            ));
        }

        storeRepository.flush();
        return toStoreDetail(requireStore(storeId), currentUser);
    }

    @Transactional
    public StoreDetailResponse updateStoreProduct(Long storeId,
                                                  Long inventoryItemId,
                                                  UpdateStoreProductRequest request,
                                                  String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        Store store = requireStore(storeId);
        assertCanManageStore(currentUser, store);

        InventoryItem item = requireInventoryItem(store, inventoryItemId);
        Product product = resolveProduct(
                request.productName().trim(),
                request.brandName(),
                request.productCategory(),
                request.unit().trim()
        );

        item.updateListing(
                product,
                request.price(),
                request.quantityAvailable(),
                normalizeOptionalText(request.barcode()),
                normalizeOptionalText(request.imageDataUrl())
        );

        storeRepository.flush();
        return toStoreDetail(requireStore(storeId), currentUser);
    }

    @Transactional
    public StoreDetailResponse deleteStoreProduct(Long storeId, Long inventoryItemId, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        Store store = requireStore(storeId);
        assertCanManageStore(currentUser, store);

        InventoryItem item = requireInventoryItem(store, inventoryItemId);
        store.getInventoryItems().remove(item);
        storeRepository.flush();
        return toStoreDetail(requireStore(storeId), currentUser);
    }

    @Transactional
    public void deleteStore(Long storeId, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        Store store = requireStore(storeId);
        assertCanManageStore(currentUser, store);
        storeRepository.delete(store);
    }

    public List<ProductSummaryResponse> listProducts(String query) {
        String effectiveQuery = query == null ? "" : query.trim();
        List<Product> allProducts = productRepository.findAll();

        if (effectiveQuery.isBlank()) {
            return allProducts.stream()
                    .sorted(Comparator.comparing(Product::getName))
                    .limit(12)
                    .map(product -> new ProductSummaryResponse(
                            product.getId(),
                            product.getName(),
                            product.getBrandName(),
                            product.getCategory(),
                            product.getUnit()
                    ))
                    .toList();
        }

        String normalizedQuery = normalizeSearchText(effectiveQuery);

        return allProducts.stream()
                .map(product -> new RankedProduct(product, scoreProductSuggestion(normalizedQuery, product)))
                .filter(result -> result.score() > 0)
                .sorted(
                        Comparator.comparing(RankedProduct::score).reversed()
                                .thenComparing(result -> result.product().getName())
                )
                .limit(8)
                .map(RankedProduct::product)
                .map(product -> new ProductSummaryResponse(
                        product.getId(),
                        product.getName(),
                        product.getBrandName(),
                        product.getCategory(),
                        product.getUnit()
                ))
                .toList();
    }

    public List<InventoryOptionResponse> searchBestOptions(SearchRequest request) {
        double maxDistance = Optional.ofNullable(request.maxDistanceKm()).orElse(defaultRadiusKm);
        double priceWeight = Optional.ofNullable(request.priceWeight()).orElse(0.45);
        double qualityWeight = Optional.ofNullable(request.qualityWeight()).orElse(0.35);
        double distanceWeight = Optional.ofNullable(request.distanceWeight()).orElse(0.20);

        List<ScoredOption> options = scoreOptions(
                request.productQuery().trim(),
                request.userLatitude(),
                request.userLongitude(),
                maxDistance,
                priceWeight,
                qualityWeight,
                distanceWeight
        );

        Comparator<InventoryOptionResponse> comparator = switch (Optional.ofNullable(request.sortBy()).orElse(SearchRequest.SortBy.BEST_MATCH)) {
            case LOWEST_PRICE -> Comparator.comparing(InventoryOptionResponse::price);
            case HIGHEST_QUALITY -> Comparator.comparing(
                    InventoryOptionResponse::qualityScore,
                    Comparator.nullsLast(Comparator.reverseOrder())
            );
            case NEAREST -> Comparator.comparing(InventoryOptionResponse::distanceKm);
            case BEST_MATCH -> Comparator.comparing(InventoryOptionResponse::recommendationScore).reversed();
        };

        return options.stream()
                .map(this::toInventoryOptionResponse)
                .sorted(comparator)
                .toList();
    }

    public ShoppingPlanResponse buildShoppingPlan(ShoppingPlanRequest request, String currentUserEmail) {
        requireUser(currentUserEmail);

        double maxDistance = Optional.ofNullable(request.maxDistanceKm()).orElse(defaultRadiusKm);

        List<ShoppingPlanItem> plannedItems = request.items().stream()
                .map(item -> new ShoppingPlanItem(
                        item.requestId().trim(),
                        item.productQuery().trim(),
                        scoreOptions(item.productQuery().trim(), request.userLatitude(), request.userLongitude(), maxDistance, 0.45, 0.35, 0.20)
                                .stream()
                                .limit(6)
                                .toList()
                ))
                .toList();

        Map<String, ScoredOption> recommendedSelections = recommendShoppingSelections(plannedItems);

        List<ShoppingPlanItemResponse> itemResponses = plannedItems.stream()
                .map(item -> new ShoppingPlanItemResponse(
                        item.requestId(),
                        item.productQuery(),
                        Optional.ofNullable(recommendedSelections.get(item.requestId()))
                                .map(option -> option.item().getId())
                                .orElse(null),
                        item.options().stream()
                                .map(this::toShoppingOptionResponse)
                                .toList()
                ))
                .toList();

        List<ShoppingStopResponse> suggestedStops = buildSuggestedStops(
                plannedItems,
                recommendedSelections,
                request.userLatitude(),
                request.userLongitude()
        );

        BigDecimal estimatedTotal = recommendedSelections.values().stream()
                .map(option -> option.item().getPrice())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double estimatedDistanceKm = suggestedStops.stream()
                .mapToDouble(ShoppingStopResponse::distanceFromPreviousKm)
                .sum();

        return new ShoppingPlanResponse(
                itemResponses,
                suggestedStops,
                estimatedTotal,
                round(estimatedDistanceKm),
                recommendedSelections.size(),
                (int) plannedItems.stream().filter(item -> item.options().isEmpty()).count()
        );
    }

    public List<SavedShoppingListResponse> listSavedShoppingLists(String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);

        return shoppingListRepository.findByOwnerIdOrderByUpdatedAtDescNameAsc(currentUser.getId()).stream()
                .map(this::toSavedShoppingListResponse)
                .toList();
    }

    @Transactional
    public SavedShoppingListResponse createSavedShoppingList(SavedShoppingListRequest request, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);

        ShoppingList shoppingList = new ShoppingList(currentUser, request.name().trim());
        shoppingList.replaceItems(normalizeSavedShoppingListItems(request));

        ShoppingList savedShoppingList = shoppingListRepository.save(shoppingList);
        shoppingListRepository.flush();
        return toSavedShoppingListResponse(savedShoppingList);
    }

    @Transactional
    public SavedShoppingListResponse updateSavedShoppingList(Long shoppingListId,
                                                             SavedShoppingListRequest request,
                                                             String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        ShoppingList shoppingList = requireShoppingList(shoppingListId, currentUser);

        shoppingList.rename(request.name().trim());
        shoppingList.replaceItems(normalizeSavedShoppingListItems(request));

        shoppingListRepository.flush();
        return toSavedShoppingListResponse(shoppingList);
    }

    @Transactional
    public void deleteSavedShoppingList(Long shoppingListId, String currentUserEmail) {
        UserAccount currentUser = requireUser(currentUserEmail);
        ShoppingList shoppingList = requireShoppingList(shoppingListId, currentUser);
        shoppingListRepository.delete(shoppingList);
    }

    public Map<String, Object> getCapabilities() {
        return Map.of(
                "service", "FindIt API",
                "features", List.of("stores-map", "inventory-search", "price-comparison", "distance-ranking", "user-accounts"),
                "nextSteps", List.of("add-authentication", "save-favorite-stores", "sync-store-inventories", "add-real-map-provider")
        );
    }

    private StoreSummaryResponse toStoreSummary(Store store,
                                                Double userLatitude,
                                                Double userLongitude,
                                                UserAccount currentUser) {
        Double distance = userLatitude != null && userLongitude != null
                ? round(distanceKm(store.getLatitude(), store.getLongitude(), userLatitude, userLongitude))
                : null;

        return new StoreSummaryResponse(
                store.getId(),
                store.getName(),
                store.getCategory(),
                store.getAddress(),
                store.getLatitude(),
                store.getLongitude(),
                store.getReputationScore(),
                distance,
                store.getOwner() != null ? store.getOwner().getFullName() : "Sin propietario",
                canManageStore(currentUser, store)
        );
    }

    private InventoryItemResponse toInventoryItemResponse(InventoryItem item) {
        return new InventoryItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getName(),
                item.getProduct().getBrandName(),
                item.getProduct().getCategory().name(),
                item.getProduct().getUnit(),
                item.getBarcode(),
                item.getPrice(),
                item.getQuantityAvailable(),
                item.getQualityScore(),
                item.getImageDataUrl()
        );
    }

    private StorePhotoResponse toStorePhotoResponse(StorePhoto photo) {
        return new StorePhotoResponse(
                photo.getId(),
                photo.getFilename(),
                photo.getContentType(),
                photo.getImageDataUrl()
        );
    }

    private StoreDetailResponse toStoreDetail(Store store, UserAccount currentUser) {
        return new StoreDetailResponse(
                store.getId(),
                store.getName(),
                store.getCategory(),
                store.getAddress(),
                store.getLatitude(),
                store.getLongitude(),
                store.getReputationScore(),
                store.getOwner() != null ? store.getOwner().getFullName() : "Sin propietario",
                canManageStore(currentUser, store),
                store.getInventoryItems().stream()
                        .map(this::toInventoryItemResponse)
                        .sorted(Comparator.comparing(InventoryItemResponse::productName))
                        .toList(),
                store.getPhotos().stream()
                        .map(this::toStorePhotoResponse)
                        .toList()
        );
    }

    private Store requireStore(Long storeId) {
        return storeRepository.findWithInventoryById(storeId)
                .orElseThrow(() -> new EntityNotFoundException("Store not found with id " + storeId));
    }

    private ShoppingList requireShoppingList(Long shoppingListId, UserAccount currentUser) {
        return shoppingListRepository.findByIdAndOwnerId(shoppingListId, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Shopping list not found with id " + shoppingListId + " for user " + currentUser.getId()
                ));
    }

    private UserAccount requireUser(String email) {
        return userAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new EntityNotFoundException("User not found with email " + email));
    }

    private void assertCanManageStore(UserAccount currentUser, Store store) {
        if (!canManageStore(currentUser, store)) {
            throw new AccessDeniedException("No tienes permiso para gestionar esta tienda.");
        }
    }

    private boolean canManageStore(UserAccount currentUser, Store store) {
        return currentUser.getRole() == UserRole.ADMIN
                || (store.getOwner() != null && store.getOwner().getId().equals(currentUser.getId()));
    }

    private List<StorePhoto> toStorePhotos(List<StorePhotoRequest> photos) {
        return photos.stream()
                .map(photo -> new StorePhoto(
                        photo.filename().trim(),
                        photo.contentType().trim(),
                        photo.imageDataUrl().trim()
                ))
                .toList();
    }

    private Product resolveProduct(String productName, ProductCategory productCategory, String unit) {
        return resolveProduct(productName, null, productCategory, unit);
    }

    private Product resolveProduct(String productName, String brandName, ProductCategory productCategory, String unit) {
        String normalizedBrandName = normalizeOptionalText(brandName);

        Optional<Product> existingProduct = normalizedBrandName != null
                ? productRepository.findByNameIgnoreCaseAndBrandNameIgnoreCaseAndCategoryAndUnitIgnoreCase(
                        productName,
                        normalizedBrandName,
                        productCategory,
                        unit
                )
                : productRepository.findByNameIgnoreCaseAndBrandNameIsNullAndCategoryAndUnitIgnoreCase(
                        productName,
                        productCategory,
                        unit
                );

        return existingProduct.orElseGet(() -> productRepository.save(new Product(
                productName,
                normalizedBrandName,
                productCategory,
                unit
        )));
    }

    private InventoryItem findExistingInventoryItem(Store store, Product product, String barcode) {
        if (barcode != null) {
            InventoryItem matchByBarcode = store.getInventoryItems().stream()
                    .filter(item -> barcode.equalsIgnoreCase(Optional.ofNullable(item.getBarcode()).orElse("")))
                    .findFirst()
                    .orElse(null);

            if (matchByBarcode != null) {
                return matchByBarcode;
            }
        }

        return store.getInventoryItems().stream()
                .filter(item -> item.getProduct().getId().equals(product.getId()))
                .findFirst()
                .orElse(null);
    }

    private InventoryItem requireInventoryItem(Store store, Long inventoryItemId) {
        return store.getInventoryItems().stream()
                .filter(item -> item.getId().equals(inventoryItemId))
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException(
                        "Inventory item not found with id " + inventoryItemId + " for store " + store.getId()
                ));
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<String> normalizeSavedShoppingListItems(SavedShoppingListRequest request) {
        return request.items().stream()
                .map(item -> item.productQuery().trim())
                .filter(item -> !item.isBlank())
                .toList();
    }

    private double scoreProductSuggestion(String normalizedQuery, Product product) {
        String normalizedName = normalizeSearchText(product.getName());

        if (normalizedQuery.isBlank() || normalizedName.isBlank()) {
            return 0;
        }

        if (normalizedName.equals(normalizedQuery)) {
            return 1.0;
        }

        if (normalizedName.startsWith(normalizedQuery)) {
            return 0.97;
        }

        if (normalizedName.contains(normalizedQuery)) {
            return 0.90;
        }

        List<String> queryTokens = tokenize(normalizedQuery);
        List<String> nameTokens = tokenize(normalizedName);
        double bestTokenScore = 0;

        for (String queryToken : queryTokens) {
            for (String nameToken : nameTokens) {
                if (nameToken.equals(queryToken)) {
                    bestTokenScore = Math.max(bestTokenScore, 0.94);
                    continue;
                }

                if (nameToken.startsWith(queryToken) || queryToken.startsWith(nameToken)) {
                    bestTokenScore = Math.max(bestTokenScore, 0.84);
                    continue;
                }

                if (nameToken.contains(queryToken) || queryToken.contains(nameToken)) {
                    bestTokenScore = Math.max(bestTokenScore, 0.76);
                    continue;
                }

                double similarity = similarity(queryToken, nameToken);
                if (similarity >= 0.58) {
                    bestTokenScore = Math.max(bestTokenScore, similarity * 0.75);
                }
            }
        }

        if (bestTokenScore > 0) {
            return round(bestTokenScore);
        }

        double fullSimilarity = similarity(normalizedQuery, normalizedName);
        return fullSimilarity >= 0.55 ? round(fullSimilarity * 0.7) : 0;
    }

    private String normalizeSearchText(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();

        return normalized;
    }

    private List<String> tokenize(String value) {
        if (value.isBlank()) {
            return List.of();
        }

        return Arrays.stream(value.split(" "))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .toList();
    }

    private double similarity(String left, String right) {
        int longestLength = Math.max(left.length(), right.length());
        if (longestLength == 0) {
            return 1.0;
        }

        int distance = levenshteinDistance(left, right);
        return 1 - ((double) distance / longestLength);
    }

    private int levenshteinDistance(String left, String right) {
        int[][] distanceMatrix = new int[left.length() + 1][right.length() + 1];

        for (int row = 0; row <= left.length(); row++) {
            distanceMatrix[row][0] = row;
        }

        for (int column = 0; column <= right.length(); column++) {
            distanceMatrix[0][column] = column;
        }

        for (int row = 1; row <= left.length(); row++) {
            for (int column = 1; column <= right.length(); column++) {
                int substitutionCost = left.charAt(row - 1) == right.charAt(column - 1) ? 0 : 1;
                distanceMatrix[row][column] = Math.min(
                        Math.min(
                                distanceMatrix[row - 1][column] + 1,
                                distanceMatrix[row][column - 1] + 1
                        ),
                        distanceMatrix[row - 1][column - 1] + substitutionCost
                );
            }
        }

        return distanceMatrix[left.length()][right.length()];
    }

    private List<ScoredOption> scoreOptions(String productQuery,
                                            double userLatitude,
                                            double userLongitude,
                                            double maxDistanceKm,
                                            double priceWeight,
                                            double qualityWeight,
                                            double distanceWeight) {
        List<Candidate> candidates = inventoryItemRepository.searchByProductName(productQuery)
                .stream()
                .map(item -> new Candidate(
                        item.getStore(),
                        item,
                        distanceKm(item.getStore().getLatitude(), item.getStore().getLongitude(), userLatitude, userLongitude)
                ))
                .filter(candidate -> candidate.distanceKm() <= maxDistanceKm)
                .toList();

        if (candidates.isEmpty()) {
            return List.of();
        }

        BigDecimal minPrice = candidates.stream().map(candidate -> candidate.item().getPrice()).min(BigDecimal::compareTo).orElse(BigDecimal.ONE);
        BigDecimal maxPrice = candidates.stream().map(candidate -> candidate.item().getPrice()).max(BigDecimal::compareTo).orElse(BigDecimal.ONE);
        double maxDistanceFound = candidates.stream().mapToDouble(Candidate::distanceKm).max().orElse(1.0);

        return candidates.stream()
                .map(candidate -> {
                    double priceScore = inverseNormalize(candidate.item().getPrice(), minPrice, maxPrice);
                    double qualityScore = candidate.item().getQualityScore() == null
                            ? 0.5
                            : normalize(candidate.item().getQualityScore(), 0, 5);
                    double distanceScore = inverseNormalize(candidate.distanceKm(), 0, maxDistanceFound);
                    double recommendationScore = round(
                            (priceScore * priceWeight)
                                    + (qualityScore * qualityWeight)
                                    + (distanceScore * distanceWeight)
                    );

                    return new ScoredOption(candidate.store(), candidate.item(), round(candidate.distanceKm()), recommendationScore);
                })
                .sorted(Comparator.comparing(ScoredOption::recommendationScore).reversed())
                .toList();
    }

    private InventoryOptionResponse toInventoryOptionResponse(ScoredOption option) {
        return new InventoryOptionResponse(
                option.store().getId(),
                option.store().getName(),
                option.item().getProduct().getName(),
                option.item().getProduct().getBrandName(),
                option.item().getPrice(),
                option.item().getProduct().getUnit(),
                option.item().getQuantityAvailable(),
                option.item().getQualityScore(),
                option.store().getReputationScore(),
                option.distanceKm(),
                option.recommendationScore()
        );
    }

    private ShoppingOptionResponse toShoppingOptionResponse(ScoredOption option) {
        return new ShoppingOptionResponse(
                option.item().getId(),
                option.store().getId(),
                option.store().getName(),
                option.store().getAddress(),
                option.store().getLatitude(),
                option.store().getLongitude(),
                option.item().getProduct().getName(),
                option.item().getProduct().getBrandName(),
                option.item().getPrice(),
                option.item().getProduct().getUnit(),
                option.item().getQualityScore(),
                option.store().getReputationScore(),
                option.distanceKm(),
                option.recommendationScore(),
                option.item().getImageDataUrl()
        );
    }

    private SavedShoppingListResponse toSavedShoppingListResponse(ShoppingList shoppingList) {
        return new SavedShoppingListResponse(
                shoppingList.getId(),
                shoppingList.getName(),
                shoppingList.getItems().stream()
                        .map(this::toSavedShoppingListItemResponse)
                        .toList(),
                shoppingList.getCreatedAt(),
                shoppingList.getUpdatedAt()
        );
    }

    private SavedShoppingListItemResponse toSavedShoppingListItemResponse(ShoppingListEntry item) {
        return new SavedShoppingListItemResponse(
                item.getId(),
                item.getItemOrder(),
                item.getProductQuery()
        );
    }

    private Map<String, ScoredOption> recommendShoppingSelections(List<ShoppingPlanItem> plannedItems) {
        Map<String, ScoredOption> selected = new LinkedHashMap<>();
        List<ShoppingPlanItem> remaining = plannedItems.stream()
                .filter(item -> !item.options().isEmpty())
                .toList();

        Set<String> resolvedIds = new HashSet<>();

        while (resolvedIds.size() < remaining.size()) {
            Map<Long, StoreCoverage> coverageByStore = new HashMap<>();

            for (ShoppingPlanItem item : remaining) {
                if (resolvedIds.contains(item.requestId())) {
                    continue;
                }

                item.options().stream()
                        .limit(4)
                        .forEach(option -> coverageByStore.compute(
                                option.store().getId(),
                                (storeId, coverage) -> coverage == null
                                        ? StoreCoverage.from(item, option)
                                        : coverage.with(item, option)
                        ));
            }

            StoreCoverage bestCoverage = coverageByStore.values().stream()
                    .max(Comparator
                            .comparingInt(StoreCoverage::coveredItems)
                            .thenComparingDouble(StoreCoverage::coverageScore)
                            .thenComparingDouble(StoreCoverage::inverseDistance))
                    .orElse(null);

            if (bestCoverage == null || bestCoverage.requestIds().isEmpty()) {
                break;
            }

            for (String requestId : bestCoverage.requestIds()) {
                if (resolvedIds.add(requestId)) {
                    selected.put(requestId, bestCoverage.optionsByRequestId().get(requestId));
                }
            }
        }

        for (ShoppingPlanItem item : remaining) {
            if (!selected.containsKey(item.requestId())) {
                selected.put(item.requestId(), item.options().get(0));
            }
        }

        return selected;
    }

    private List<ShoppingStopResponse> buildSuggestedStops(List<ShoppingPlanItem> plannedItems,
                                                           Map<String, ScoredOption> selections,
                                                           double userLatitude,
                                                           double userLongitude) {
        if (selections.isEmpty()) {
            return List.of();
        }

        Map<Long, StopAccumulator> stopAccumulators = new LinkedHashMap<>();

        for (ShoppingPlanItem item : plannedItems) {
            ScoredOption selectedOption = selections.get(item.requestId());
            if (selectedOption == null) {
                continue;
            }

            stopAccumulators.computeIfAbsent(
                    selectedOption.store().getId(),
                    ignored -> new StopAccumulator(selectedOption.store())
            ).addProduct(item, selectedOption);
        }

        List<StopAccumulator> orderedStops = orderStopsByDistance(
                new ArrayList<>(stopAccumulators.values()),
                userLatitude,
                userLongitude
        );

        List<ShoppingStopResponse> responses = new ArrayList<>();
        double previousLatitude = userLatitude;
        double previousLongitude = userLongitude;

        for (StopAccumulator stop : orderedStops) {
            double distanceFromPrevious = round(distanceKm(
                    previousLatitude,
                    previousLongitude,
                    stop.store().getLatitude(),
                    stop.store().getLongitude()
            ));

            responses.add(new ShoppingStopResponse(
                    stop.store().getId(),
                    stop.store().getName(),
                    stop.store().getAddress(),
                    stop.store().getLatitude(),
                    stop.store().getLongitude(),
                    distanceFromPrevious,
                    stop.subtotal(),
                    stop.products()
            ));

            previousLatitude = stop.store().getLatitude();
            previousLongitude = stop.store().getLongitude();
        }

        return responses;
    }

    private List<StopAccumulator> orderStopsByDistance(List<StopAccumulator> stops,
                                                       double userLatitude,
                                                       double userLongitude) {
        List<StopAccumulator> remaining = new ArrayList<>(stops);
        List<StopAccumulator> ordered = new ArrayList<>();
        double currentLatitude = userLatitude;
        double currentLongitude = userLongitude;

        while (!remaining.isEmpty()) {
            final double latitude = currentLatitude;
            final double longitude = currentLongitude;
            StopAccumulator nearest = remaining.stream()
                    .min(Comparator.comparingDouble(stop -> distanceKm(
                            latitude,
                            longitude,
                            stop.store().getLatitude(),
                            stop.store().getLongitude()
                    )))
                    .orElseThrow();

            ordered.add(nearest);
            remaining.remove(nearest);
            currentLatitude = nearest.store().getLatitude();
            currentLongitude = nearest.store().getLongitude();
        }

        return ordered;
    }

    private double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0;
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private double normalize(double value, double min, double max) {
        if (Double.compare(max, min) == 0) {
            return 1.0;
        }
        return (value - min) / (max - min);
    }

    private double inverseNormalize(double value, double min, double max) {
        if (Double.compare(max, min) == 0) {
            return 1.0;
        }
        return 1 - ((value - min) / (max - min));
    }

    private double inverseNormalize(BigDecimal value, BigDecimal min, BigDecimal max) {
        if (max.compareTo(min) == 0) {
            return 1.0;
        }

        BigDecimal range = max.subtract(min);
        BigDecimal distanceFromMin = value.subtract(min);
        BigDecimal normalized = BigDecimal.ONE.subtract(distanceFromMin.divide(range, 8, RoundingMode.HALF_UP));
        return normalized.doubleValue();
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private record Candidate(Store store, InventoryItem item, double distanceKm) {
    }

    private record ScoredOption(Store store, InventoryItem item, double distanceKm, double recommendationScore) {
    }

    private record RankedProduct(Product product, double score) {
    }

    private record ShoppingPlanItem(String requestId, String productQuery, List<ScoredOption> options) {
    }

    private record StoreCoverage(Set<String> requestIds,
                                 Map<String, ScoredOption> optionsByRequestId,
                                 double coverageScore,
                                 double inverseDistance) {

        private static StoreCoverage from(ShoppingPlanItem item, ScoredOption option) {
            Set<String> requestIds = new HashSet<>();
            requestIds.add(item.requestId());
            Map<String, ScoredOption> optionsByRequestId = new HashMap<>();
            optionsByRequestId.put(item.requestId(), option);
            return new StoreCoverage(requestIds, optionsByRequestId, option.recommendationScore(), 1 / (option.distanceKm() + 1));
        }

        private StoreCoverage with(ShoppingPlanItem item, ScoredOption option) {
            Set<String> nextRequestIds = new HashSet<>(requestIds);
            nextRequestIds.add(item.requestId());

            Map<String, ScoredOption> nextOptions = new HashMap<>(optionsByRequestId);
            nextOptions.merge(
                    item.requestId(),
                    option,
                    (current, candidate) -> candidate.recommendationScore() > current.recommendationScore() ? candidate : current
            );

            return new StoreCoverage(
                    nextRequestIds,
                    nextOptions,
                    coverageScore + option.recommendationScore(),
                    inverseDistance + (1 / (option.distanceKm() + 1))
            );
        }

        private int coveredItems() {
            return requestIds.size();
        }
    }

    private static class StopAccumulator {
        private final Store store;
        private final List<ShoppingStopItemResponse> products = new ArrayList<>();
        private BigDecimal subtotal = BigDecimal.ZERO;

        private StopAccumulator(Store store) {
            this.store = store;
        }

        private void addProduct(ShoppingPlanItem item, ScoredOption option) {
            products.add(new ShoppingStopItemResponse(
                    item.requestId(),
                    item.productQuery(),
                    option.item().getId(),
                    option.item().getProduct().getName(),
                    option.item().getProduct().getBrandName(),
                    option.item().getPrice(),
                    option.item().getProduct().getUnit()
            ));
            subtotal = subtotal.add(option.item().getPrice());
        }

        private Store store() {
            return store;
        }

        private BigDecimal subtotal() {
            return subtotal;
        }

        private List<ShoppingStopItemResponse> products() {
            return products.stream()
                    .sorted(Comparator.comparing(ShoppingStopItemResponse::productQuery))
                    .toList();
        }
    }
}
