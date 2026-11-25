import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/providers/auth_provider.dart';
import 'core/theme/app_theme.dart';
import 'router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(const KaratApp());
}

class KaratApp extends StatefulWidget {
  const KaratApp({super.key});

  @override
  State<KaratApp> createState() => _KaratAppState();
}

class _KaratAppState extends State<KaratApp> {
  late final AuthProvider _authProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider();
    _router = createRouter(_authProvider);
  }

  @override
  void dispose() {
    _authProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _authProvider,
      child: MaterialApp.router(
        title: 'Karat Retail',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        routerConfig: _router,
        builder: (context, child) {
          return Consumer<AuthProvider>(
            builder: (context, auth, _) {
              if (auth.status == AuthStatus.unknown) {
                return const Scaffold(
                  backgroundColor: AppTheme.background,
                  body: Center(
                    child: CircularProgressIndicator(color: AppTheme.primary),
                  ),
                );
              }
              return child ?? const SizedBox.shrink();
            },
          );
        },
      ),
    );
  }
}
