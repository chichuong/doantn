import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/providers/auth_provider.dart';
import '../core/constants/app_constants.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/customer/customer_shell.dart';
import '../features/warehouse/warehouse_shell.dart';
import '../features/shipper/shipper_shell.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

String roleHome(String? roleCode) => switch (roleCode) {
      AppConstants.roleCustomer => '/customer/home',
      AppConstants.roleWarehouse => '/warehouse/orders',
      AppConstants.roleShipper => '/shipper/shipments',
      _ => '/login',
    };

GoRouter createRouter(AuthProvider auth) => GoRouter(
      navigatorKey: _rootNavigatorKey,
      refreshListenable: auth,
      initialLocation: '/login',
      redirect: (context, state) {
        if (auth.status == AuthStatus.unknown) {
          return null; // Chờ kiểm tra session
        }
        final isLoggedIn = auth.isLoggedIn;
        final path = state.matchedLocation;

        final authRoutes = ['/login', '/register'];
        final isAuthRoute = authRoutes.contains(path);

        if (!isLoggedIn && !isAuthRoute) {
          return '/login';
        }

        if (isLoggedIn && (isAuthRoute || path == '/')) {
          return roleHome(auth.user?.roleCode);
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/register',
          builder: (context, state) => const RegisterScreen(),
        ),

        // Customer shell
        ShellRoute(
          builder: (ctx, state, child) => CustomerShell(child: child),
          routes: customerRoutes,
        ),

        // Warehouse shell
        ShellRoute(
          builder: (ctx, state, child) => WarehouseShell(child: child),
          routes: warehouseRoutes,
        ),

        // Shipper shell
        ShellRoute(
          builder: (ctx, state, child) => ShipperShell(child: child),
          routes: shipperRoutes,
        ),
      ],
    );
