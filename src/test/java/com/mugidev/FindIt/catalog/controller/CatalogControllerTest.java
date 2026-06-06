package com.mugidev.FindIt.catalog.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mugidev.FindIt.catalog.domain.ProductCategory;
import com.mugidev.FindIt.catalog.dto.BarcodeLookupResponse;
import com.mugidev.FindIt.catalog.service.BarcodeLookupService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class CatalogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BarcodeLookupService barcodeLookupService;

    @Test
    void shouldListStores() throws Exception {
        mockMvc.perform(get("/api/v1/stores")
                        .header("Authorization", bearerToken())
                        .param("userLat", "1.23207")
                        .param("userLng", "-77.29295")
                        .param("radiusKm", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").exists())
                .andExpect(jsonPath("$[0].canManage").exists());
    }

    @Test
    void shouldSearchBestOptions() throws Exception {
        mockMvc.perform(post("/api/v1/search/options")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productQuery": "arroz",
                                  "userLatitude": 1.23207,
                                  "userLongitude": -77.29295,
                                  "maxDistanceKm": 30,
                                  "sortBy": "BEST_MATCH"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productName").value("Arroz Diana 500g"))
                .andExpect(jsonPath("$[0].recommendationScore").exists());
    }

    @Test
    void shouldSuggestProductsEvenWithTypos() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .header("Authorization", bearerToken())
                        .param("q", "aroz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Arroz Diana 500g"));
    }

    @Test
    void shouldBuildShoppingPlan() throws Exception {
        mockMvc.perform(post("/api/v1/shopping/plan")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "userLatitude": 1.23207,
                                  "userLongitude": -77.29295,
                                  "maxDistanceKm": 30,
                                  "items": [
                                    {
                                      "requestId": "item-1",
                                      "productQuery": "arroz"
                                    },
                                    {
                                      "requestId": "item-2",
                                      "productQuery": "leche"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].requestId").value("item-1"))
                .andExpect(jsonPath("$.items[0].options[0].inventoryItemId").exists())
                .andExpect(jsonPath("$.suggestedStops[0].storeName").exists())
                .andExpect(jsonPath("$.estimatedTotal").exists())
                .andExpect(jsonPath("$.coveredItems").value(2));
    }

    @Test
    void shouldCreateAndListSavedShoppingLists() throws Exception {
        long shoppingListId = createSavedShoppingList("Mercado semanal");

        mockMvc.perform(get("/api/v1/shopping/lists")
                        .header("Authorization", bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(shoppingListId))
                .andExpect(jsonPath("$[0].name").value("Mercado semanal"))
                .andExpect(jsonPath("$[0].items[0].productQuery").value("Arroz Diana 500g"))
                .andExpect(jsonPath("$[0].items[1].productQuery").value("Leche Entera 1L"));
    }

    @Test
    void shouldUpdateSavedShoppingList() throws Exception {
        long shoppingListId = createSavedShoppingList("Mercado semanal");

        mockMvc.perform(put("/api/v1/shopping/lists/{shoppingListId}", shoppingListId)
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Mercado ajustado",
                                  "items": [
                                    { "productQuery": "Huevos AA x12" },
                                    { "productQuery": "Detergente 1kg" }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Mercado ajustado"))
                .andExpect(jsonPath("$.items[0].productQuery").value("Huevos AA x12"))
                .andExpect(jsonPath("$.items[1].productQuery").value("Detergente 1kg"));
    }

    @Test
    void shouldDeleteSavedShoppingList() throws Exception {
        long shoppingListId = createSavedShoppingList("Lista para borrar");

        mockMvc.perform(delete("/api/v1/shopping/lists/{shoppingListId}", shoppingListId)
                        .header("Authorization", bearerToken()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/shopping/lists")
                        .header("Authorization", bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %s)]".formatted(shoppingListId)).isEmpty());
    }

    @Test
    void shouldGetStoreDetail() throws Exception {
        mockMvc.perform(get("/api/v1/stores/1")
                        .header("Authorization", bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.canManage").value(false))
                .andExpect(jsonPath("$.inventory[0].productName").exists());
    }

    @Test
    void shouldLookupBarcodeWithOpenFoodFacts() throws Exception {
        when(barcodeLookupService.lookupByBarcode("7701234567890"))
                .thenReturn(new BarcodeLookupResponse(
                        "7701234567890",
                        "Avena en hojuelas",
                        "Marca Demo",
                        ProductCategory.FOOD,
                        "500 g",
                        "data:image/png;base64,AAAA",
                        "Open Food Facts"
                ));

        mockMvc.perform(get("/api/v1/barcodes/7701234567890")
                        .header("Authorization", bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.barcode").value("7701234567890"))
                .andExpect(jsonPath("$.productName").value("Avena en hojuelas"))
                .andExpect(jsonPath("$.productCategory").value("FOOD"))
                .andExpect(jsonPath("$.unit").value("500 g"))
                .andExpect(jsonPath("$.source").value("Open Food Facts"));
    }

    @Test
    void shouldCreateStoreWithPhotos() throws Exception {
        mockMvc.perform(post("/api/v1/stores")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Panaderia La Esquina",
                                  "category": "BAKERY",
                                  "latitude": 1.2318,
                                  "longitude": -77.2922,
                                  "photos": [
                                    {
                                      "filename": "fachada.png",
                                      "contentType": "image/png",
                                      "imageDataUrl": "data:image/png;base64,AAAA"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Panaderia La Esquina"))
                .andExpect(jsonPath("$.category").value("BAKERY"))
                .andExpect(jsonPath("$.canManage").value(true))
                .andExpect(jsonPath("$.photos[0].filename").value("fachada.png"));
    }

    @Test
    void shouldUpdateStore() throws Exception {
        long storeId = createStore("Papeleria Centro");

        mockMvc.perform(put("/api/v1/stores/{storeId}", storeId)
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Papeleria Centro Plus",
                                  "category": "MINIMARKET",
                                  "latitude": 1.2318,
                                  "longitude": -77.2922,
                                  "photos": [
                                    {
                                      "filename": "interior.png",
                                      "contentType": "image/png",
                                      "imageDataUrl": "data:image/png;base64,BBBB"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Papeleria Centro Plus"))
                .andExpect(jsonPath("$.category").value("MINIMARKET"))
                .andExpect(jsonPath("$.photos[0].filename").value("interior.png"));
    }

    @Test
    void shouldAddProductToOwnedStore() throws Exception {
        long storeId = createStore("Tienda Inventario");

        mockMvc.perform(post("/api/v1/stores/{storeId}/inventory", storeId)
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productName": "Shampoo Suave 400ml",
                                  "productCategory": "PERSONAL_CARE",
                                  "unit": "400 ml",
                                  "barcode": "7701234567890",
                                  "price": 12900,
                                  "quantityAvailable": 9,
                                  "imageDataUrl": "data:image/png;base64,CCCC"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inventory[*].productName").value(hasItem("Shampoo Suave 400ml")))
                .andExpect(jsonPath("$.inventory[*].unit").value(hasItem("400 ml")))
                .andExpect(jsonPath("$.inventory[*].barcode").value(hasItem("7701234567890")));
    }

    @Test
    void shouldUpdateOwnedStoreProduct() throws Exception {
        long storeId = createStore("Tienda Editar Producto");
        long inventoryItemId = createInventoryItem(storeId, "Cafe molido 500g");

        mockMvc.perform(put("/api/v1/stores/{storeId}/inventory/{inventoryItemId}", storeId, inventoryItemId)
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productName": "Cafe molido premium 500g",
                                  "productCategory": "FOOD",
                                  "unit": "500 g",
                                  "barcode": "7709876543210",
                                  "price": 18500,
                                  "quantityAvailable": 14,
                                  "imageDataUrl": "data:image/png;base64,DDDD"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inventory[?(@.inventoryItemId == %s)].productName".formatted(inventoryItemId)).value(hasItem("Cafe molido premium 500g")))
                .andExpect(jsonPath("$.inventory[?(@.inventoryItemId == %s)].barcode".formatted(inventoryItemId)).value(hasItem("7709876543210")));
    }

    @Test
    void shouldDeleteOwnedStoreProduct() throws Exception {
        long storeId = createStore("Tienda Borrar Producto");
        long inventoryItemId = createInventoryItem(storeId, "Galletas de avena");

        mockMvc.perform(delete("/api/v1/stores/{storeId}/inventory/{inventoryItemId}", storeId, inventoryItemId)
                        .header("Authorization", bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inventory[?(@.inventoryItemId == %s)]".formatted(inventoryItemId)).isEmpty());
    }

    @Test
    void shouldListManagedStoresForOwner() throws Exception {
        mockMvc.perform(get("/api/v1/stores/mine")
                        .header("Authorization", bearerToken("pedro@findit.local")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].canManage").value(true))
                .andExpect(jsonPath("$[0].ownerDisplayName").value("Pedro Gomez"));
    }

    @Test
    void shouldForbidCustomerUpdatingForeignStore() throws Exception {
        mockMvc.perform(put("/api/v1/stores/1")
                        .header("Authorization", bearerToken("laura@findit.local"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Cambio no permitido",
                                  "category": "MINIMARKET",
                                  "latitude": 1.2318,
                                  "longitude": -77.2922,
                                  "photos": []
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldAllowAdminUpdatingAnyStore() throws Exception {
        long storeId = createStore("Negocio para admin");

        mockMvc.perform(put("/api/v1/stores/{storeId}", storeId)
                        .header("Authorization", bearerToken("admin@findit.local"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Negocio revisado por admin",
                                  "category": "MINIMARKET",
                                  "latitude": 1.2318,
                                  "longitude": -77.2922,
                                  "photos": []
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManage").value(true))
                .andExpect(jsonPath("$.name").value("Negocio revisado por admin"));
    }

    @Test
    void shouldDeleteStore() throws Exception {
        long storeId = createStore("Cafe del Parque");

        mockMvc.perform(delete("/api/v1/stores/{storeId}", storeId)
                        .header("Authorization", bearerToken()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/stores/{storeId}", storeId)
                        .header("Authorization", bearerToken()))
                .andExpect(status().isNotFound());
    }

    private long createStore(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/stores")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "category": "BAKERY",
                                  "latitude": 1.2318,
                                  "longitude": -77.2922,
                                  "photos": [
                                    {
                                      "filename": "fachada.png",
                                      "contentType": "image/png",
                                      "imageDataUrl": "data:image/png;base64,AAAA"
                                    }
                                  ]
                                }
                                """.formatted(name)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode createdStore = objectMapper.readTree(result.getResponse().getContentAsString());
        return createdStore.path("id").asLong();
    }

    private long createInventoryItem(long storeId, String productName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/stores/{storeId}/inventory", storeId)
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productName": "%s",
                                  "productCategory": "FOOD",
                                  "unit": "500 g",
                                  "barcode": "7700000000000",
                                  "price": 9200,
                                  "quantityAvailable": 8,
                                  "imageDataUrl": "data:image/png;base64,EEEE"
                                }
                                """.formatted(productName)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode updatedStore = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode item : updatedStore.path("inventory")) {
            if (productName.equals(item.path("productName").asText())) {
                return item.path("inventoryItemId").asLong();
            }
        }

        throw new IllegalStateException("No se pudo encontrar el producto creado en la respuesta.");
    }

    private long createSavedShoppingList(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/shopping/lists")
                        .header("Authorization", bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "items": [
                                    { "productQuery": "Arroz Diana 500g" },
                                    { "productQuery": "Leche Entera 1L" }
                                  ]
                                }
                                """.formatted(name)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode savedShoppingList = objectMapper.readTree(result.getResponse().getContentAsString());
        return savedShoppingList.path("id").asLong();
    }

    private String bearerToken() throws Exception {
        return bearerToken("laura@findit.local");
    }

    private String bearerToken(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123"
                                }
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        String token = response.split("\"token\":\"")[1].split("\"")[0];
        return "Bearer " + token;
    }
}
