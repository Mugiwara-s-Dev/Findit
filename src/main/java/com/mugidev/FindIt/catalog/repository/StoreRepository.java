// Acceso JPA para tiendas y sus relaciones cargadas.
package com.mugidev.FindIt.catalog.repository;

import com.mugidev.FindIt.catalog.domain.Store;
import com.mugidev.FindIt.catalog.domain.StoreCategory;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StoreRepository extends JpaRepository<Store, Long> {

    Optional<Store> findByNameIgnoreCase(String name);

    @EntityGraph(attributePaths = {"inventoryItems", "inventoryItems.product", "owner"})
    List<Store> findAllByOrderByNameAsc();

    @EntityGraph(attributePaths = {"inventoryItems", "inventoryItems.product", "owner"})
    List<Store> findByCategoryOrderByNameAsc(StoreCategory category);

    @EntityGraph(attributePaths = {"inventoryItems", "inventoryItems.product", "photos", "owner"})
    @Query("select store from Store store where store.id = :id")
    Optional<Store> findWithInventoryById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"owner"})
    List<Store> findByOwnerIdOrderByNameAsc(Long ownerId);
}
