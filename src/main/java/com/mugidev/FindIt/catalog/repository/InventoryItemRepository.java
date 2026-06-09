// Acceso JPA para items de inventario.
package com.mugidev.FindIt.catalog.repository;

import com.mugidev.FindIt.catalog.domain.InventoryItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    @EntityGraph(attributePaths = {"store", "product"})
    @Query("""
            select item
            from InventoryItem item
            where lower(item.product.name) like lower(concat('%', :query, '%'))
            """)
    List<InventoryItem> searchByProductName(@Param("query") String query);
}
