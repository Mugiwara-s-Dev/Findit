package com.mugidev.FindIt.catalog.service;

import com.mugidev.FindIt.catalog.dto.BarcodeLookupResponse;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OpenFoodFactsBarcodeServiceTest {

    private MockRestServiceServer server;
    private OpenFoodFactsBarcodeService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        service = new OpenFoodFactsBarcodeService(
                builder,
                "https://world.openfoodfacts.org",
                "FindIt-Test/1.0 (https://findit.local; support@findit.local)"
        );
    }

    @Test
    void shouldMapOpenFoodFactsProductIntoLookupResponse() {
        server.expect(once(), requestTo(containsString("/api/v3/product/7701234567890")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "product": {
                            "product_name": "Avena en hojuelas",
                            "brands": "Marca Demo",
                            "quantity": "500 g",
                            "categories_tags": ["en:breakfast-cereals", "en:foods"],
                            "image_front_url": "https://images.findit.test/avena.png",
                            "product_type": "food"
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        server.expect(once(), requestTo("https://images.findit.test/avena.png"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("png-demo".getBytes(StandardCharsets.UTF_8), MediaType.IMAGE_PNG));

        BarcodeLookupResponse result = service.lookupByBarcode("7701234567890");

        assertThat(result.barcode()).isEqualTo("7701234567890");
        assertThat(result.productName()).isEqualTo("Avena en hojuelas");
        assertThat(result.brandName()).isEqualTo("Marca Demo");
        assertThat(result.productCategory().name()).isEqualTo("FOOD");
        assertThat(result.unit()).isEqualTo("500 g");
        assertThat(result.imageDataUrl()).startsWith("data:image/png;base64,");
        assertThat(result.source()).isEqualTo("Open Food Facts");

        server.verify();
    }

    @Test
    void shouldThrowNotFoundWhenOpenFoodFactsHasNoProduct() {
        server.expect(once(), requestTo(containsString("/api/v3/product/0000000000000")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withStatus(org.springframework.http.HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.lookupByBarcode("0000000000000"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Open Food Facts");

        server.verify();
    }
}
