UPDATE "hero_banners"
SET "accentCards" = '[{"label":"Fresh Bakery","image":"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80","href":"/category/bakery-groceries"},{"label":"Organic Pantry","image":"https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=600&q=80","href":"/category/bakery-groceries"}]'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "badge" = 'Fast Doorstep Delivery';

