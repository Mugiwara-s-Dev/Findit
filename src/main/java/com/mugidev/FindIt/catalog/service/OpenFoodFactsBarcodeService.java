package com.mugidev.FindIt.catalog.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.mugidev.FindIt.catalog.domain.ProductCategory;
import com.mugidev.FindIt.catalog.dto.BarcodeLookupResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
public class OpenFoodFactsBarcodeService implements BarcodeLookupService {

    private static final String LOOKUP_FIELDS = String.join(",",
            "product_name",
            "brands",
            "quantity",
            "product_quantity",
            "product_quantity_unit",
            "categories_tags",
            "image_front_url",
            "image_url",
            "product_type"
    );

    private final RestClient restClient;

    public OpenFoodFactsBarcodeService(RestClient.Builder restClientBuilder,
                                       @Value("${findit.integrations.open-food-facts.base-url:https://world.openfoodfacts.org}") String baseUrl,
                                       @Value("${findit.integrations.open-food-facts.user-agent:FindIt/0.1 (https://findit.local; support@findit.local)}") String userAgent) {
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .build();
    }

    @Override
    public BarcodeLookupResponse lookupByBarcode(String barcode) {
        try {
            OpenFoodFactsEnvelope envelope = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v3/product/{code}")
                            .queryParam("product_type", "all")
                            .queryParam("fields", LOOKUP_FIELDS)
                            .build(barcode))
                    .retrieve()
                    .body(OpenFoodFactsEnvelope.class);

            if (envelope == null || envelope.product() == null) {
                throw new EntityNotFoundException("No encontramos ese codigo en Open Food Facts.");
            }

            OpenFoodFactsProduct product = envelope.product();
            String productName = firstNonBlank(product.productName(), product.brands());
            if (productName == null) {
                throw new EntityNotFoundException("Open Food Facts no devolvio un nombre util para este codigo.");
            }

            return new BarcodeLookupResponse(
                    barcode,
                    productName,
                    normalizeOptional(product.brands()),
                    mapCategory(product),
                    resolveUnit(product),
                    fetchImageDataUrl(firstNonBlank(product.imageFrontUrl(), product.imageUrl())),
                    "Open Food Facts"
            );
        } catch (HttpClientErrorException.NotFound exception) {
            throw new EntityNotFoundException("No encontramos ese codigo en Open Food Facts.");
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "No pudimos consultar Open Food Facts en este momento."
            );
        }
    }

    private String fetchImageDataUrl(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }

        try {
            ResponseEntity<byte[]> imageResponse = restClient.get()
                    .uri(URI.create(imageUrl))
                    .retrieve()
                    .toEntity(byte[].class);

            byte[] imageBytes = imageResponse.getBody();
            if (imageBytes == null || imageBytes.length == 0) {
                return null;
            }

            MediaType contentType = imageResponse.getHeaders().getContentType();
            String mediaType = contentType != null ? contentType.toString() : MediaType.IMAGE_JPEG_VALUE;

            return "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(imageBytes);
        } catch (RestClientResponseException exception) {
            return null;
        }
    }

    private ProductCategory mapCategory(OpenFoodFactsProduct product) {
        String productType = normalizeOptional(product.productType());
        if ("petfood".equalsIgnoreCase(productType)) {
            return ProductCategory.PETS;
        }
        if ("beauty".equalsIgnoreCase(productType)) {
            return ProductCategory.PERSONAL_CARE;
        }

        List<String> tags = product.categoriesTags() == null ? List.of() : product.categoriesTags();
        if (matchesAnyTag(tags, "beverages", "drinks", "juices", "sodas", "waters")) {
            return ProductCategory.BEVERAGE;
        }
        if (matchesAnyTag(tags, "petfood", "pet-food", "cat-food", "dog-food")) {
            return ProductCategory.PETS;
        }
        if (matchesAnyTag(tags, "personal-care", "cosmetics", "beauty", "shampoos", "soaps")) {
            return ProductCategory.PERSONAL_CARE;
        }
        if (matchesAnyTag(tags, "home-care", "household", "cleaning-products", "detergents")) {
            return ProductCategory.HOME;
        }
        if (matchesAnyTag(tags, "health", "supplements", "vitamins", "pharmacy")) {
            return ProductCategory.HEALTH;
        }

        return ProductCategory.FOOD;
    }

    private boolean matchesAnyTag(List<String> tags, String... needles) {
        for (String tag : tags) {
            String normalizedTag = tag == null ? "" : tag.toLowerCase(Locale.ROOT);
            for (String needle : needles) {
                if (normalizedTag.contains(needle)) {
                    return true;
                }
            }
        }

        return false;
    }

    private String resolveUnit(OpenFoodFactsProduct product) {
        String quantity = normalizeOptional(product.quantity());
        if (quantity != null) {
            return quantity;
        }

        String quantityValue = normalizeOptional(product.productQuantity());
        String quantityUnit = normalizeOptional(product.productQuantityUnit());
        if (quantityValue != null && quantityUnit != null) {
            return quantityValue + " " + quantityUnit;
        }

        if (quantityValue != null) {
            return quantityValue;
        }

        return "unidad";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = normalizeOptional(value);
            if (normalized != null) {
                return normalized;
            }
        }

        return null;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private record OpenFoodFactsEnvelope(OpenFoodFactsProduct product) {
    }

    private record OpenFoodFactsProduct(
            @JsonProperty("product_name") String productName,
            String brands,
            String quantity,
            @JsonProperty("product_quantity") String productQuantity,
            @JsonProperty("product_quantity_unit") String productQuantityUnit,
            @JsonProperty("categories_tags") List<String> categoriesTags,
            @JsonProperty("image_front_url") String imageFrontUrl,
            @JsonProperty("image_url") String imageUrl,
            @JsonProperty("product_type") String productType
    ) {
    }
}
