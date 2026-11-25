import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import 'cart_provider.dart';
import 'screens/catalog_screen.dart';
import 'screens/cart_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/profile_screen.dart';

// Route definitions for GoRouter
final customerRoutes = <RouteBase>[
  GoRoute(path: '/customer/home', builder: (context, state) => const CatalogScreen()),
  GoRoute(path: '/customer/cart', builder: (context, state) => const CartScreen()),
  GoRoute(path: '/customer/orders', builder: (context, state) => const OrdersScreen()),
  GoRoute(path: '/customer/profile', builder: (context, state) => const CustomerProfileScreen()),
];

class CustomerShell extends StatefulWidget {
  final Widget child;
  const CustomerShell({super.key, required this.child});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _index = 0;
  late final CartProvider _cartProvider;

  static const _tabs = [
    '/customer/home',
    '/customer/cart',
    '/customer/orders',
    '/customer/profile',
  ];

  @override
  void initState() {
    super.initState();
    _cartProvider = CartProvider()..fetchCart();
  }

  @override
  void dispose() {
    _cartProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _cartProvider,
      child: Builder(
        builder: (innerContext) {
          final location = GoRouterState.of(innerContext).uri.toString();
          for (int i = 0; i < _tabs.length; i++) {
            if (location.startsWith(_tabs[i])) {
              _index = i;
              break;
            }
          }

          return Scaffold(
            body: widget.child,
            bottomNavigationBar: _buildNav(innerContext),
          );
        },
      ),
    );
  }

  Widget _buildNav(BuildContext context) {
    return Consumer<CartProvider>(
      builder: (context, cart, _) {
        return Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppTheme.border)),
          ),
          child: BottomNavigationBar(
            currentIndex: _index,
            onTap: (i) {
              setState(() => _index = i);
              context.go(_tabs[i]);
            },
            type: BottomNavigationBarType.fixed,
            selectedItemColor: AppTheme.primary,
            unselectedItemColor: AppTheme.textHint,
            selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.store_outlined),
                activeIcon: Icon(Icons.store),
                label: 'Sản phẩm',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: cart.totalItems > 0,
                  label: Text('${cart.totalItems}'),
                  child: const Icon(Icons.shopping_cart_outlined),
                ),
                activeIcon: Badge(
                  isLabelVisible: cart.totalItems > 0,
                  label: Text('${cart.totalItems}'),
                  child: const Icon(Icons.shopping_cart),
                ),
                label: 'Giỏ hàng',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.receipt_long_outlined),
                activeIcon: Icon(Icons.receipt_long),
                label: 'Đơn hàng',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.person_outlined),
                activeIcon: Icon(Icons.person),
                label: 'Tôi',
              ),
            ],
          ),
        );
      },
    );
  }
}
