import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'screens/shipments_screen.dart';
import 'screens/shipper_profile_screen.dart';

final shipperRoutes = <RouteBase>[
  GoRoute(path: '/shipper/shipments', builder: (context, state) => const ShipmentsScreen()),
  GoRoute(path: '/shipper/profile', builder: (context, state) => const ShipperProfileScreen()),
];

class ShipperShell extends StatefulWidget {
  final Widget child;
  const ShipperShell({super.key, required this.child});

  @override
  State<ShipperShell> createState() => _ShipperShellState();
}

class _ShipperShellState extends State<ShipperShell> {
  int _index = 0;
  static const _tabs = [
    '/shipper/shipments',
    '/shipper/profile',
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
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.local_shipping_outlined),
              activeIcon: Icon(Icons.local_shipping),
              label: 'Vận đơn',
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
