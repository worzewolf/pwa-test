# Test changes list

## 1. Product page hook modifications

1.1. while adding product to cart in offline mode, we store into a localStorage:
- a product mutation variable data in order to retrigger mutation after an online mode returned back
- product data required for minicart to render required data there

1.2. once an online mode returned back (we check it with default pwa-studio app state variables), we trigger default mutation to add requested product with requested quantity to cart

1.3. after product was added to cart in an online mode, localStorage keys removed

## 2. CartTrigger hook modifications

2.1. sum default minicart items qty value with an offline product qty and show it on storefront imediately
2.2. after online sync and mutation request cartTrigger totalQuantity re-updates with valid qty.

## 3. Minicart hook modification

3.1. updates in an offline mode total products qty (minicart header)
3.2. updates in an offline mode minicart total price (price's added in a not proper way, since the product page doesn't provide us with same values out from box - it requires an extra modifications on the backend first and then extend default product page queries to get that data)
3.3. updates in an offline mode minicart product list
- if such a product exists - then minicart will update only product qty value
- if such a product was not added to minicart previously, it will add it as a new product with all data (image, name, qty, price)
3.4 after sync with online mode minicart reupdates with same valid data
