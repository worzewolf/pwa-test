import { useCallback, useEffect, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';

import { useCartContext } from '../../context/cart';
import { deriveErrorMessage } from '../../util/deriveErrorMessage';
import mergeOperations from '../../util/shallowMerge';
import DEFAULT_OPERATIONS from './miniCart.gql';
import { useEventingContext } from '../../context/eventing';

/**
 *
 * @param {Boolean} props.isOpen - True if the mini cart is open
 * @param {Function} props.setIsOpen - Function to toggle the mini cart
 * @param {DocumentNode} props.operations.miniCartQuery - Query to fetch mini cart data
 * @param {DocumentNode} props.operations.removeItemMutation - Mutation to remove an item from cart
 *
 * @returns {
 *      closeMiniCart: Function,
 *      errorMessage: String,
 *      handleEditCart: Function,
 *      handleProceedToCheckout: Function,
 *      handleRemoveItem: Function,
 *      loading: Boolean,
 *      productList: Array<>,
 *      subTotal: Number,
 *      totalQuantity: Number
 *      configurableThumbnailSource: String
 *  }
 */
export const useMiniCart = props => {
    const { isOpen, setIsOpen } = props;

    const offlineAddToCartData = localStorage.getItem('offlineAddToCart');
    const parsedOfflineAddToCartData = offlineAddToCartData && JSON.parse(offlineAddToCartData);
    const [, { dispatch }] = useEventingContext();

    const operations = mergeOperations(DEFAULT_OPERATIONS, props.operations);
    const {
        removeItemMutation,
        miniCartQuery,
        getStoreConfigQuery
    } = operations;

    const [{ cartId }] = useCartContext();
    const history = useHistory();

    const { data: miniCartData, loading: miniCartLoading } = useQuery(
        miniCartQuery,
        {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first',
            variables: { cartId },
            skip: !cartId,
            errorPolicy: 'all'
        }
    );

    const { data: storeConfigData } = useQuery(getStoreConfigQuery, {
        fetchPolicy: 'cache-and-network'
    });

    const configurableThumbnailSource = useMemo(() => {
        if (storeConfigData) {
            return storeConfigData.storeConfig.configurable_thumbnail_source;
        }
    }, [storeConfigData]);

    const storeUrlSuffix = useMemo(() => {
        if (storeConfigData) {
            return storeConfigData.storeConfig.product_url_suffix;
        }
    }, [storeConfigData]);

    const [
        removeItem,
        {
            loading: removeItemLoading,
            called: removeItemCalled,
            error: removeItemError
        }
    ] = useMutation(removeItemMutation);

    const totalQuantity = useMemo(() => {
        if (!miniCartLoading) {
            let addedOfflineItemsQty = null;
            if (parsedOfflineAddToCartData) {

                parsedOfflineAddToCartData.map((item) => {
                    addedOfflineItemsQty = addedOfflineItemsQty + item.product.quantity
                })

                return miniCartData?.cart?.total_quantity + addedOfflineItemsQty;
            } else {
                return miniCartData?.cart?.total_quantity;
            }
        }
    }, [miniCartData, miniCartLoading, parsedOfflineAddToCartData]);

    const subTotal = useMemo(() => {
        if (!miniCartLoading) {
            if (!parsedOfflineAddToCartData?.length) return miniCartData?.cart?.prices?.subtotal_excluding_tax;

            return {
                currency: miniCartData?.cart?.prices?.subtotal_excluding_tax.currency,
                value: miniCartData?.cart?.prices?.subtotal_excluding_tax.value + parsedOfflineAddToCartData[0].prices.price.value,
            }
        }
    }, [miniCartData, miniCartLoading, parsedOfflineAddToCartData]);

    const productList = useMemo(() => {
        if (!miniCartLoading) {
            const items = miniCartData?.cart?.items || [];
            const offlineItems = parsedOfflineAddToCartData || [];

            if (!offlineItems.length) return items;

            let updatedItems = [...items];

            offlineItems.forEach(offlineItem => {
                const matchIndex = updatedItems.findIndex(
                    item => item.product.uid === offlineItem.product.uid
                );
                if (matchIndex !== -1) {
                    // MATCH FOUND → sum quantity
                    updatedItems[matchIndex] = {
                        ...updatedItems[matchIndex],
                        quantity:
                            updatedItems[matchIndex].quantity +
                            offlineItem.product.quantity
                    };
                } else {
                    // NO MATCH → push offline item to minicart
                    updatedItems.push({
                        prices: offlineItem.prices,
                        uid: offlineItem.product.uid,
                        sku: offlineItem.product.sku,
                        product: offlineItem.product,
                        quantity: offlineItem.product.quantity
                    });
                }
            });

            return updatedItems;
        }
    }, [miniCartData, miniCartLoading, parsedOfflineAddToCartData]);

    const closeMiniCart = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen]);

    const handleRemoveItem = useCallback(
        async id => {
            try {
                await removeItem({
                    variables: {
                        cartId,
                        itemId: id
                    }
                });

                const [product] = productList.filter(
                    p => (p.uid || p.id) === id
                );

                const selectedOptionsLabels =
                    product.configurable_options?.map(
                        ({ option_label, value_label }) => ({
                            attribute: option_label,
                            value: value_label
                        })
                    ) || null;

                dispatch({
                    type: 'CART_REMOVE_ITEM',
                    payload: {
                        cartId,
                        sku: product.product.sku,
                        name: product.product.name,
                        priceTotal: product.prices.price.value,
                        currencyCode: product.prices.price.currency,
                        discountAmount:
                            product.prices.total_item_discount.value,
                        selectedOptions: selectedOptionsLabels,
                        quantity: product.quantity
                    }
                });
            } catch (e) {
                // Error is logged by apollo link - no need to double log.
            }
        },
        [removeItem, cartId, dispatch, productList]
    );

    const handleProceedToCheckout = useCallback(() => {
        setIsOpen(false);
        history.push('/checkout');
    }, [history, setIsOpen]);

    const handleEditCart = useCallback(() => {
        setIsOpen(false);
        history.push('/cart');
    }, [history, setIsOpen]);

    const derivedErrorMessage = useMemo(
        () => deriveErrorMessage([removeItemError]),
        [removeItemError]
    );

    useEffect(() => {
        if (isOpen) {
            dispatch({
                type: 'MINI_CART_VIEW',
                payload: {
                    cartId: cartId,
                    products: productList
                }
            });
        }
    }, [isOpen, cartId, productList, dispatch]);

    return {
        closeMiniCart,
        errorMessage: derivedErrorMessage,
        handleEditCart,
        handleProceedToCheckout,
        handleRemoveItem,
        loading: miniCartLoading || (removeItemCalled && removeItemLoading),
        productList,
        subTotal,
        totalQuantity,
        configurableThumbnailSource,
        storeUrlSuffix
    };
};
