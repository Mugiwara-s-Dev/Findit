package com.mugidev.FindIt.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StorePhotoRequest(
        @NotBlank @Size(max = 255) String filename,
        @NotBlank @Size(max = 120) String contentType,
        @NotBlank String imageDataUrl
) {
}
