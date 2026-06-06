package com.mugidev.FindIt.catalog.dto;

public record StorePhotoResponse(
        Long id,
        String filename,
        String contentType,
        String imageDataUrl
) {
}
