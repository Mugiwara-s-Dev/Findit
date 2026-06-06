package com.mugidev.FindIt.catalog.dto;

import com.mugidev.FindIt.catalog.domain.ProductCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record AddStoreProductRequest(
        @NotBlank @Size(max = 120) String productName,
        @Size(max = 120) String brandName,
        @NotNull ProductCategory productCategory,
        @NotBlank @Size(max = 40) String unit,
        @Size(max = 64) String barcode,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        @Min(0) int quantityAvailable,
        String imageDataUrl
) {
}
