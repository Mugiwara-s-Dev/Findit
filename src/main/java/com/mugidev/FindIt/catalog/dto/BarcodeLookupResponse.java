package com.mugidev.FindIt.catalog.dto;

import com.mugidev.FindIt.catalog.domain.ProductCategory;

public record BarcodeLookupResponse(
        String barcode,
        String productName,
        String brandName,
        ProductCategory productCategory,
        String unit,
        String imageDataUrl,
        String source
) {
}
