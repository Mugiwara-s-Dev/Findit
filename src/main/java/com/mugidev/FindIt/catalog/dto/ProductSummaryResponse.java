package com.mugidev.FindIt.catalog.dto;

import com.mugidev.FindIt.catalog.domain.ProductCategory;

public record ProductSummaryResponse(
        Long id,
        String name,
        String brandName,
        ProductCategory category,
        String unit
) {
}
