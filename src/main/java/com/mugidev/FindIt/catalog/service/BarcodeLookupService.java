// Contrato para resolver productos por codigo de barras.
package com.mugidev.FindIt.catalog.service;

import com.mugidev.FindIt.catalog.dto.BarcodeLookupResponse;

public interface BarcodeLookupService {

    BarcodeLookupResponse lookupByBarcode(String barcode);
}
