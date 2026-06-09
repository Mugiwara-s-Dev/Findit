// Acceso JPA para listas de compra guardadas.
package com.mugidev.FindIt.catalog.repository;

import com.mugidev.FindIt.catalog.domain.ShoppingList;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShoppingListRepository extends JpaRepository<ShoppingList, Long> {

    @EntityGraph(attributePaths = {"items"})
    List<ShoppingList> findByOwnerIdOrderByUpdatedAtDescNameAsc(Long ownerId);

    @EntityGraph(attributePaths = {"items"})
    Optional<ShoppingList> findByIdAndOwnerId(Long id, Long ownerId);
}
