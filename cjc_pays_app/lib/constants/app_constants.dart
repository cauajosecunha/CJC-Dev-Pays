class AppConstants {
  static const String appName = 'CJC Dev Pays';
  static const String defaultBaseUrl = 'https://pays.cjcdev.site';
  static const String localDefaultUrl = 'http://10.0.2.2:4020';

  // Storage Keys
  static const String keyToken = 'auth_token';
  static const String keyUser = 'auth_user';
  static const String keyBaseUrl = 'custom_base_url';

  // Request Timeouts
  static const Duration connectTimeout = Duration(seconds: 15);
}
