package com.mugidev.FindIt.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "shopping_list_items")
public class ShoppingListEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shopping_list_id", nullable = false)
    private ShoppingList shoppingList;

    @Column(nullable = false)
    private int itemOrder;

    @Column(nullable = false)
    private String productQuery;

    protected ShoppingListEntry() {
    }

    public ShoppingListEntry(int itemOrder, String productQuery) {
        this.itemOrder = itemOrder;
        this.productQuery = productQuery;
    }

    void assignShoppingList(ShoppingList shoppingList) {
        this.shoppingList = shoppingList;
    }

    public Long getId() {
        return id;
    }

    public int getItemOrder() {
        return itemOrder;
    }

    public String getProductQuery() {
        return productQuery;
    }
}
