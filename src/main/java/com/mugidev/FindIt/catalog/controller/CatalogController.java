// Expone la API del catalogo, tiendas, inventario y compras.
package com.mugidev.FindIt.catalog.controller;

import com.mugidev.FindIt.catalog.domain.StoreCategory;
import com.mugidev.FindIt.catalog.dto.AddStoreProductRequest;
import com.mugidev.FindIt.catalog.dto.BarcodeLookupResponse;
import com.mugidev.FindIt.catalog.dto.CreateStoreRequest;
import com.mugidev.FindIt.catalog.dto.InventoryOptionResponse;
import com.mugidev.FindIt.catalog.dto.ProductSummaryResponse;
import com.mugidev.FindIt.catalog.dto.SavedShoppingListRequest;
import com.mugidev.FindIt.catalog.dto.SavedShoppingListResponse;
import com.mugidev.FindIt.catalog.dto.SearchRequest;
import com.mugidev.FindIt.catalog.dto.ShoppingPlanRequest;
import com.mugidev.FindIt.catalog.dto.ShoppingPlanResponse;
import com.mugidev.FindIt.catalog.dto.StoreDetailResponse;
import com.mugidev.FindIt.catalog.dto.StoreSummaryResponse;
import com.mugidev.FindIt.catalog.dto.UpdateStoreProductRequest;
import com.mugidev.FindIt.catalog.dto.UpdateStoreRequest;
import com.mugidev.FindIt.catalog.service.BarcodeLookupService;
import com.mugidev.FindIt.catalog.service.CatalogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private final CatalogService catalogService;
    private final BarcodeLookupService barcodeLookupService;

    public CatalogController(CatalogService catalogService,
                             BarcodeLookupService barcodeLookupService) {
        this.catalogService = catalogService;
        this.barcodeLookupService = barcodeLookupService;
    }

    @GetMapping
    public Map<String, Object> apiInfo() {
        return catalogService.getCapabilities();
    }

    @GetMapping("/stores")
    public List<StoreSummaryResponse> listStores(@RequestParam(required = false) Double userLat,
                                                 @RequestParam(required = false) Double userLng,
                                                 @RequestParam(required = false) Double radiusKm,
                                                 @RequestParam(required = false) StoreCategory category,
                                                 Authentication authentication) {
        return catalogService.listStores(userLat, userLng, radiusKm, category, authentication.getName());
    }

    @GetMapping("/stores/mine")
    public List<StoreSummaryResponse> listManagedStores(@RequestParam(required = false) Double userLat,
                                                        @RequestParam(required = false) Double userLng,
                                                        Authentication authentication) {
        return catalogService.listManagedStores(userLat, userLng, authentication.getName());
    }

    @GetMapping("/stores/{storeId}")
    public StoreDetailResponse getStore(@PathVariable Long storeId, Authentication authentication) {
        return catalogService.getStore(storeId, authentication.getName());
    }

    @GetMapping("/barcodes/{barcode}")
    public BarcodeLookupResponse lookupBarcode(@PathVariable
                                               @Pattern(regexp = "\\d{8,14}", message = "El codigo debe tener entre 8 y 14 digitos.")
                                               String barcode) {
        return barcodeLookupService.lookupByBarcode(barcode);
    }

    @PostMapping("/stores")
    @ResponseStatus(HttpStatus.CREATED)
    public StoreDetailResponse createStore(@Valid @RequestBody CreateStoreRequest request,
                                           Authentication authentication) {
        return catalogService.createStore(request, authentication.getName());
    }

    @PutMapping("/stores/{storeId}")
    public StoreDetailResponse updateStore(@PathVariable Long storeId,
                                           @Valid @RequestBody UpdateStoreRequest request,
                                           Authentication authentication) {
        return catalogService.updateStore(storeId, request, authentication.getName());
    }

    @PostMapping("/stores/{storeId}/inventory")
    public StoreDetailResponse addStoreProduct(@PathVariable Long storeId,
                                               @Valid @RequestBody AddStoreProductRequest request,
                                               Authentication authentication) {
        return catalogService.addStoreProduct(storeId, request, authentication.getName());
    }

    @PutMapping("/stores/{storeId}/inventory/{inventoryItemId}")
    public StoreDetailResponse updateStoreProduct(@PathVariable Long storeId,
                                                  @PathVariable Long inventoryItemId,
                                                  @Valid @RequestBody UpdateStoreProductRequest request,
                                                  Authentication authentication) {
        return catalogService.updateStoreProduct(storeId, inventoryItemId, request, authentication.getName());
    }

    @DeleteMapping("/stores/{storeId}/inventory/{inventoryItemId}")
    public StoreDetailResponse deleteStoreProduct(@PathVariable Long storeId,
                                                  @PathVariable Long inventoryItemId,
                                                  Authentication authentication) {
        return catalogService.deleteStoreProduct(storeId, inventoryItemId, authentication.getName());
    }

    @DeleteMapping("/stores/{storeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStore(@PathVariable Long storeId, Authentication authentication) {
        catalogService.deleteStore(storeId, authentication.getName());
    }

    @GetMapping("/products")
    public List<ProductSummaryResponse> listProducts(@RequestParam(required = false) String q) {
        return catalogService.listProducts(q);
    }

    @PostMapping("/search/options")
    @ResponseStatus(HttpStatus.OK)
    public List<InventoryOptionResponse> searchOptions(@Valid @RequestBody SearchRequest request) {
        return catalogService.searchBestOptions(request);
    }

    @PostMapping("/shopping/plan")
    @ResponseStatus(HttpStatus.OK)
    public ShoppingPlanResponse buildShoppingPlan(@Valid @RequestBody ShoppingPlanRequest request,
                                                  Authentication authentication) {
        return catalogService.buildShoppingPlan(request, authentication.getName());
    }

    @GetMapping("/shopping/lists")
    public List<SavedShoppingListResponse> listSavedShoppingLists(Authentication authentication) {
        return catalogService.listSavedShoppingLists(authentication.getName());
    }

    @PostMapping("/shopping/lists")
    @ResponseStatus(HttpStatus.CREATED)
    public SavedShoppingListResponse createSavedShoppingList(@Valid @RequestBody SavedShoppingListRequest request,
                                                             Authentication authentication) {
        return catalogService.createSavedShoppingList(request, authentication.getName());
    }

    @PutMapping("/shopping/lists/{shoppingListId}")
    public SavedShoppingListResponse updateSavedShoppingList(@PathVariable Long shoppingListId,
                                                             @Valid @RequestBody SavedShoppingListRequest request,
                                                             Authentication authentication) {
        return catalogService.updateSavedShoppingList(shoppingListId, request, authentication.getName());
    }

    @DeleteMapping("/shopping/lists/{shoppingListId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSavedShoppingList(@PathVariable Long shoppingListId, Authentication authentication) {
        catalogService.deleteSavedShoppingList(shoppingListId, authentication.getName());
    }
}
