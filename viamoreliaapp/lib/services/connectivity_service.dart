import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  final _connectivity = Connectivity();
  final _controller = StreamController<bool>.broadcast();
  StreamSubscription? _sub;
  bool _online = true;

  bool get isOnline => _online;
  Stream<bool> get onlineStream => _controller.stream;

  Future<void> start() async {
    final initial = await _connectivity.checkConnectivity();
    _setOnline(_hasNet(initial));
    _sub = _connectivity.onConnectivityChanged.listen((result) {
      _setOnline(_hasNet(result));
    });
  }

  bool _hasNet(List<ConnectivityResult> r) {
    return r.any((e) =>
        e == ConnectivityResult.mobile ||
        e == ConnectivityResult.wifi ||
        e == ConnectivityResult.ethernet ||
        e == ConnectivityResult.vpn);
  }

  void _setOnline(bool v) {
    if (_online == v) return;
    _online = v;
    _controller.add(v);
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    await _controller.close();
  }
}
