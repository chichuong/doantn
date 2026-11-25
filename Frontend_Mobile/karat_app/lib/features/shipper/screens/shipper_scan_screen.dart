import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/theme/app_theme.dart';
import '../shipper_service.dart';
import 'shipment_detail_screen.dart';

class ShipperScanScreen extends StatefulWidget {
  const ShipperScanScreen({super.key});

  @override
  State<ShipperScanScreen> createState() => _ShipperScanScreenState();
}

class _ShipperScanScreenState extends State<ShipperScanScreen> {
  final _inputController = TextEditingController();
  final MobileScannerController _scannerController = MobileScannerController();
  bool _isProcessing = false;
  bool _torchOn = false;
  String? _errorMessage;

  @override
  void dispose() {
    _inputController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _handleScan(String code) async {
    final cleanCode = code.trim();
    if (cleanCode.isEmpty || _isProcessing) return;

    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });

    try {
      final shipment = await ShipperService.scanTracking(cleanCode);
      final id = shipment['id']?.toString();
      if (id != null && mounted) {
        _inputController.clear();
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ShipmentDetailScreen(shipmentId: id),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quét mã vận đơn'),
        actions: [
          IconButton(
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            onPressed: () {
              _scannerController.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios),
            onPressed: () => _scannerController.switchCamera(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Camera viewport
          Expanded(
            flex: 3,
            child: Stack(
              children: [
                MobileScanner(
                  controller: _scannerController,
                  onDetect: (capture) {
                    final barcodes = capture.barcodes;
                    for (final barcode in barcodes) {
                      if (barcode.rawValue != null) {
                        _handleScan(barcode.rawValue!);
                        break;
                      }
                    }
                  },
                ),
                // Center scan overlay
                Center(
                  child: Container(
                    width: 260,
                    height: 180,
                    decoration: BoxDecoration(
                      border: Border.all(color: AppTheme.primary, width: 2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                if (_isProcessing)
                  Container(
                    color: Colors.black45,
                    child: const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),

          // Manual input & feedback
          Expanded(
            flex: 2,
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.all(20),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Hoặc nhập mã vận đơn thủ công:',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _inputController,
                            decoration: InputDecoration(
                              hintText: 'VD: TRK-2026-0001...',
                              prefixIcon: const Icon(Icons.qr_code),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            ),
                            onSubmitted: _handleScan,
                          ),
                        ),
                        const SizedBox(width: 10),
                        ElevatedButton(
                          onPressed: _isProcessing ? null : () => _handleScan(_inputController.text),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Icon(Icons.search, color: Colors.white),
                        ),
                      ],
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.error.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppTheme.error, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(color: AppTheme.error, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
