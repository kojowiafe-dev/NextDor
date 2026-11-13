INSERT INTO "hero_banners" ("badge", "subtitle", "bgImageUrl", "ctaText", "ctaHref", "secondaryText", "secondaryHref", "accentCards", "sortOrder", "isActive")
SELECT
  v.badge,
  v.subtitle,
  v.bg_image_url,
  v.cta_text,
  v.cta_href,
  v.secondary_text,
  v.secondary_href,
  v.accent_cards::jsonb,
  v.sort_order,
  true
FROM (
  VALUES
    (
      'Flash Tech Event',
      'Shop laptops, smartwatches, wireless audio & accessories from verified stores.',
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1800&q=85',
      'Shop Electronics',
      '/category/electronics',
      'Today''s Deals',
      '/deals',
      '[{"label":"Pro Laptops","image":"https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80","href":"/category/electronics"},{"label":"Audio & Watches","image":"https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80","href":"/category/accessories"}]',
      1
    ),
    (
      'Home & Living Upgrade',
      '4K Smart TVs, air conditioners, refrigerators & everyday home essentials.',
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1800&q=85',
      'Explore Appliances',
      '/category/home-appliances',
      'Browse All',
      '/shop',
      '[{"label":"Kitchen & Cooling","image":"https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=600&q=80","href":"/category/home-appliances"},{"label":"Smart Entertainment","image":"https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=600&q=80","href":"/category/home-appliances"}]',
      2
    ),
    (
      'Trending Collections',
      'Discover luxury fragrances, skincare, apparel & everyday bags across Ghana.',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85',
      'Shop Beauty & Care',
      '/category/beauty-personal-care',
      'Fashion & Apparel',
      '/category/fashion-apparel',
      '[{"label":"Luxury Perfumes","image":"https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80","href":"/category/beauty-personal-care"},{"label":"Apparel & Bags","image":"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80","href":"/category/fashion-apparel"}]',
      3
    ),
    (
      'Fast Doorstep Delivery',
      'Order fresh cakes, biscuits, organic honey & pantry staples with instant MoMo.',
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=85',
      'Shop Groceries',
      '/category/bakery-groceries',
      'View Deals',
      '/deals',
      '[{"label":"Fresh Bakery","image":"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80","href":"/category/bakery-groceries"},{"label":"Organic Pantry","image":"https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=600&q=80","href":"/category/bakery-groceries"}]',
      4
    )
) AS v(badge, subtitle, bg_image_url, cta_text, cta_href, secondary_text, secondary_href, accent_cards, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "hero_banners" hb WHERE hb."badge" = v.badge
);
