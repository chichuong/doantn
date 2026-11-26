/* quirc -- QR-code recognition library
 * Copyright (C) 2010-2012 Daniel Beer <dlbeer@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include "quirc_internal.h"
#include <Arduino.h>
#include <esp_heap_caps.h>

const char *quirc_version(void)
{
	return "1.0";
}

// Cấp phát an toàn ưu tiên bộ nhớ ngoài PSRAM (8MB trên ESP32-S3 WROOM N16R8)
static inline void *safe_ps_malloc(size_t size)
{
	void *ptr = heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
	if (ptr) return ptr;
	return malloc(size);
}

static inline void *safe_ps_calloc(size_t n, size_t size)
{
	void *ptr = heap_caps_calloc(n, size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
	if (ptr) return ptr;
	return calloc(n, size);
}

// Ưu tiên cấp phát bộ đệm pixels trên Internal SRAM tốc độ cao nếu còn dư > 140KB cho Wi-Fi/HTTP
static inline void *fast_sram_or_ps_calloc(size_t n, size_t size)
{
	size_t total = n * size;
	size_t free_internal = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
	if (total <= 81920 && free_internal > (total + 140 * 1024)) {
		void *ptr = heap_caps_calloc(n, size, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
		if (ptr) return ptr;
	}
	return safe_ps_calloc(n, size);
}

struct quirc *quirc_new(void)
{
	struct quirc *q = (struct quirc *)safe_ps_malloc(sizeof(*q));
	if (!q)
		return NULL;

	memset(q, 0, sizeof(*q));
	return q;
}

void quirc_destroy(struct quirc *q)
{
	if (!q)
		return;

	if (q->image)
		free(q->image);
	if (q->pixels && q->pixels != (quirc_pixel_t *)q->image)
		free(q->pixels);
	if (q->flood_fill_vars)
		free(q->flood_fill_vars);
	free(q);
}

int quirc_resize(struct quirc *q, int w, int h)
{
	if (!q || w <= 0 || h <= 0)
		return -1;

	size_t newdim = (size_t)w * (size_t)h;
	uint8_t *image = (uint8_t *)safe_ps_calloc(w, h);
	if (!image)
		return -1;

	// Cấp phát buffer độc lập cho pixels (ưu tiên Internal SRAM tốc độ cao nếu đủ chỗ, fallback PSRAM)
	quirc_pixel_t *pixels = (quirc_pixel_t *)fast_sram_or_ps_calloc(newdim, sizeof(quirc_pixel_t));
	if (!pixels) {
		free(image);
		return -1;
	}

	size_t num_vars = (size_t)h * 2 / 3;
	if (num_vars < 160)
		num_vars = 160;
	size_t vars_byte_size = sizeof(struct quirc_flood_fill_vars) * num_vars;
	struct quirc_flood_fill_vars *vars = (struct quirc_flood_fill_vars *)safe_ps_malloc(vars_byte_size);
	if (!vars) {
		free(image);
		free(pixels);
		return -1;
	}

	// Giải phóng các vùng nhớ cũ an toàn
	if (q->image)
		free(q->image);
	if (q->pixels && q->pixels != (quirc_pixel_t *)q->image)
		free(q->pixels);
	if (q->flood_fill_vars)
		free(q->flood_fill_vars);

	q->w = w;
	q->h = h;
	q->image = image;
	q->pixels = pixels;
	q->flood_fill_vars = vars;
	q->num_flood_fill_vars = num_vars;

	return 0;
}

int quirc_count(const struct quirc *q)
{
	if (!q)
		return 0;
	return q->num_grids;
}

static const char *const error_table[] = {
	[QUIRC_SUCCESS] = "Success",
	[QUIRC_ERROR_INVALID_GRID_SIZE] = "Invalid grid size",
	[QUIRC_ERROR_INVALID_VERSION] = "Invalid version",
	[QUIRC_ERROR_FORMAT_ECC] = "Format data ECC failure",
	[QUIRC_ERROR_DATA_ECC] = "ECC failure",
	[QUIRC_ERROR_UNKNOWN_DATA_TYPE] = "Unknown data type",
	[QUIRC_ERROR_DATA_OVERFLOW] = "Data overflow",
	[QUIRC_ERROR_DATA_UNDERFLOW] = "Data underflow"
};

const char *quirc_strerror(quirc_decode_error_t err)
{
	if (err >= 0 && err < (quirc_decode_error_t)(sizeof(error_table) / sizeof(error_table[0])))
		return error_table[err];

	return "Unknown error";
}
