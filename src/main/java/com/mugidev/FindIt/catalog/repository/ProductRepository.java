package com.mugidev.FindIt.catalog.repository;

import com.mugidev.FindIt.catalog.domain.Product;
import com.mugidev.FindIt.catalog.domain.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByNameIgnoreCaseAndCategoryAndUnitIgnoreCase(String name,
                                                                       ProductCategory category,
                                                                       String unit);

    Optional<Product> findByNameIgnoreCaseAndBrandNameIgnoreCaseAndCategoryAndUnitIgnoreCase(String name,
                                                                                            String brandName,
                                                                                            ProductCategory category,
                                                                                            String unit);

    Optional<Product> findByNameIgnoreCaseAndBrandNameIsNullAndCategoryAndUnitIgnoreCase(String name,
                                                                                         ProductCategory category,
                                                                                         String unit);

    List<Product> findByNameContainingIgnoreCaseOrderByNameAsc(String name);
}
