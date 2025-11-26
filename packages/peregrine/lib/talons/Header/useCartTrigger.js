import { useCallback, useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useHistory, useLocation } from 'react-router-dom';

import { useCartContext } from '@magento/peregrine/lib/context/cart';
import { useDropdown } from '@magento/peregrine/lib/hooks/useDropdown';

/**
 * Routes to hide the mini cart on.
 */
const DENIED_MINI_CART_ROUTES = ['/checkout'];

/**
 *
 * @param {DocumentNode} props.queries.getItemCountQuery query to get the total cart items count
 *
 * @returns {
 *      itemCount: Number,
 *      miniCartIsOpen: Boolean,
 *      handleLinkClick: Function,
 *      handleTriggerClick: Function,
 *      miniCartRef: Function,
 *      hideCartTrigger: Function,
 *      setMiniCartIsOpen: Function
 *  }
 */
export const useCartTrigger = props => {
    const {
        queries: { getItemCountQuery }
    } = props;

    const [{ cartId }] = useCartContext();
    const history = useHistory();
    const location = useLocation();
    const [isHidden, setIsHidden] = useState(() =>
        DENIED_MINI_CART_ROUTES.includes(location.pathname)
    );
    const [itemCount, setItemCount] = useState(null);

    const {
        elementRef: miniCartRef,
        expanded: miniCartIsOpen,
        setExpanded: setMiniCartIsOpen,
        triggerRef: miniCartTriggerRef
    } = useDropdown();

    const { data } = useQuery(getItemCountQuery, {
        fetchPolicy: 'cache-and-network',
        variables: {
            cartId
        },
        skip: !cartId,
        errorPolicy: 'all'
    });

    const offlineAddToCartData = localStorage.getItem('offlineAddToCart');
    const parsedOfflineAddToCartData = offlineAddToCartData && JSON.parse(offlineAddToCartData);

    useEffect(() => {
        if (parsedOfflineAddToCartData) {
            let addedOfflineItemsQty = null;

            parsedOfflineAddToCartData.map((item) => {
                addedOfflineItemsQty = addedOfflineItemsQty + item.product.quantity
            })

            setItemCount(
                addedOfflineItemsQty + data?.cart?.total_summary_quantity_including_config ||
                addedOfflineItemsQty + 0
            )
        } else {
            setItemCount(data?.cart?.total_summary_quantity_including_config || 0);
        }
    }, [data?.cart?.total_summary_quantity_including_config, parsedOfflineAddToCartData]);

    const handleTriggerClick = useCallback(() => {
        // Open the mini cart.
        setMiniCartIsOpen(isOpen => !isOpen);
    }, [setMiniCartIsOpen]);

    const handleLinkClick = useCallback(() => {
        // Send the user to the cart page.
        history.push('/cart');
    }, [history]);

    useEffect(() => {
        setIsHidden(DENIED_MINI_CART_ROUTES.includes(location.pathname));
    }, [location]);

    return {
        handleLinkClick,
        handleTriggerClick,
        itemCount,
        miniCartIsOpen,
        miniCartRef,
        hideCartTrigger: isHidden,
        setMiniCartIsOpen,
        miniCartTriggerRef
    };
};
