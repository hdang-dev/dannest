package com.dannest.common;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * A stable, framework-independent page envelope for list endpoints.
 *
 * <p>We map from Spring Data's {@link Page} rather than returning it directly, so the
 * JSON shape stays under our control instead of following the internal {@code PageImpl}.
 */
public record PagedResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last) {

    /** Wrap a {@link Page} of entities, mapping each element to a response DTO. */
    public static <E, T> PagedResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PagedResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast());
    }
}
