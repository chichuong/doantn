import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'screens/warehouse_orders_screen.dart';
import 'screens/warehouse_inventory_screen.dart';
import 'screens/warehouse_documents_screen.dart';
import 'screens/warehouse_profile_screen.dart';

final warehouseRoutes = <RouteBase>[
  GoRoute(path: '/warehouse/orders', builder: (context, state) => const WarehouseOrdersScreen()),
  GoRoute(path: '/warehouse/inventory', builder: (context, state) => const WarehouseInventoryScreen()),
  GoRoute(path: '/warehouse/documents', builder: (context, state) => const WarehouseDocumentsScreen()),
  GoRoute(path: '/warehouse/profile', builder: (context, state) => const WarehouseProfileScreen()),
];

class WarehouseShell extends StatefulWidget {
  final Widget child;
  const WarehouseShell({super.key, required this.child});

  @override
  State<WarehouseShell> createState() => _WarehouseShellState();
}

class _WarehouseShellState extends State<WarehouseShell> {
  int _index = 0;
  static const _tabs = [
    '/warehouse/orders',
    '/warehouse/inventory',
    '/warehouse/documents',
    '/warehouse/profile',
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    for (int i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i])) {
        _index = i;
        break;
      }
    }

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: Container(
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
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.list_alt_outlined),
              activeIcon: Icon(Icons.list_alt),
              label: 'Đơn hàng',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.inventory_2_outlined),
              activeIcon: Icon(Icons.inventory_2),
              label: 'Tồn kho',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.assignment_outlined),
              activeIcon: Icon(Icons.assignment),
              label: 'Phiếu kho',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outlined),
              activeIcon: Icon(Icons.person),
              label: 'Tôi',
            ),
          ],
        ),
      ),
    );
  }
}
