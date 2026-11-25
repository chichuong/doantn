import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Badge hiển thị trạng thái
class StatusBadge extends StatelessWidget {
  final String? label;
  final Color? color;
  final String? status;

  const StatusBadge({
    super.key,
    this.label,
    this.color,
    this.status,
  });

  @override
  Widget build(BuildContext context) {
    String resolvedLabel = label ?? '';
    Color resolvedColor = color ?? AppTheme.textHint;

    if (status != null && status!.isNotEmpty) {
      final orderLabel = status!.orderStatusLabel;
      final shipmentLabel = status!.shipmentStatusLabel;
      final docLabel = status!.warehouseDocStatusLabel;

      resolvedLabel = label ?? (docLabel != status ? docLabel : (orderLabel != status ? orderLabel : shipmentLabel));
      final docColor = status!.warehouseDocStatusColor;
      resolvedColor = color ?? (docColor != AppTheme.textHint ? docColor : (status!.orderStatusColor != AppTheme.textHint ? status!.orderStatusColor : status!.shipmentStatusColor));
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: resolvedColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: resolvedColor.withValues(alpha: 0.35)),
      ),
      child: Text(
        resolvedLabel,
        style: TextStyle(color: resolvedColor, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// Loading indicator
class FullScreenLoader extends StatelessWidget {
  final String? message;
  const FullScreenLoader({super.key, this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppTheme.primary),
            if (message != null) ...[
              const SizedBox(height: 16),
              Text(message!, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
            ],
          ],
        ),
      );
}

class LoadingWidget extends StatelessWidget {
  final String? message;
  const LoadingWidget({super.key, this.message});

  @override
  Widget build(BuildContext context) => FullScreenLoader(message: message);
}

/// Empty state
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, this.subtitle, this.action});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceVariant,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 44, color: AppTheme.textHint),
              ),
              const SizedBox(height: 16),
              Text(title, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
              if (subtitle != null) ...[
                const SizedBox(height: 8),
                Text(subtitle!, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
              ],
              if (action != null) ...[const SizedBox(height: 20), action!],
            ],
          ),
        ),
      );
}

class EmptyStateWidget extends StatelessWidget {
  final IconData icon;
  final String message;
  final Widget? action;

  const EmptyStateWidget({
    super.key,
    this.icon = Icons.inbox_outlined,
    required this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) => EmptyState(icon: icon, title: message, action: action);
}

/// Error state
class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorState({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(color: AppTheme.errorLight, shape: BoxShape.circle),
                child: const Icon(Icons.error_outline, size: 40, color: AppTheme.error),
              ),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
              if (onRetry != null) ...[
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Thử lại'),
                ),
              ],
            ],
          ),
        ),
      );
}

class CustomErrorWidget extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const CustomErrorWidget({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) => ErrorState(message: message, onRetry: onRetry);
}

/// GradientText
class GradientText extends StatelessWidget {
  final String text;
  final TextStyle? style;
  const GradientText(this.text, {super.key, this.style});

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: (style ?? const TextStyle()).copyWith(color: AppTheme.primary),
      );
}

/// AppCard – white card with subtle shadow
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  const AppCard({super.key, required this.child, this.padding, this.onTap});

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: content,
        ),
      );
    }
    return content;
  }
}

class SectionCard extends AppCard {
  const SectionCard({super.key, required super.child, super.padding, super.onTap});
}

/// PrimaryButton
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final Color? color;

  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton(
          onPressed: (loading || onPressed == null) ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: color ?? AppTheme.primary,
            foregroundColor: Colors.white,
            disabledBackgroundColor: AppTheme.border,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
          ),
          child: loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[Icon(icon, size: 18, color: Colors.white), const SizedBox(width: 8)],
                    Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                  ],
                ),
        ),
      );
}

/// GradientButton alias
class GradientButton extends PrimaryButton {
  const GradientButton({
    super.key,
    required super.label,
    super.onPressed,
    super.loading,
    super.icon,
    super.color,
  });
}

/// showSnack
void showSnack(BuildContext context, String message, {bool isError = false}) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Row(children: [
      Icon(
        isError ? Icons.error_outline : Icons.check_circle_outline,
        color: Colors.white,
        size: 18,
      ),
      const SizedBox(width: 8),
      Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
    ]),
    backgroundColor: isError ? AppTheme.error : AppTheme.success,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    margin: const EdgeInsets.all(16),
    duration: const Duration(seconds: 3),
  ));
}

/// Format VND
String formatCurrency(dynamic amount) {
  if (amount == null) return '0 ₫';
  final n = double.tryParse(amount.toString()) ?? 0;
  final parts = n.toStringAsFixed(0).split('');
  final result = StringBuffer();
  for (int i = 0; i < parts.length; i++) {
    if (i > 0 && (parts.length - i) % 3 == 0) result.write('.');
    result.write(parts[i]);
  }
  return '${result.toString()} ₫';
}

/// Format date
String formatDate(String? iso, {bool withTime = false}) {
  if (iso == null) return '';
  try {
    final dt = DateTime.parse(iso).toLocal();
    final date = '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    if (!withTime) return date;
    final time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    return '$date $time';
  } catch (_) {
    return iso;
  }
}
