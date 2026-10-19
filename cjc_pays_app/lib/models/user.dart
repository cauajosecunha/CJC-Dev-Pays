class AdminUser {
  final String id;
  final String email;
  final String username;
  final String name;

  AdminUser({
    required this.id,
    required this.email,
    required this.username,
    required this.name,
  });

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      name: json['name']?.toString() ?? (json['username']?.toString() ?? 'Administrador'),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'name': name,
    };
  }

  String get initials {
    if (name.trim().isEmpty) return 'AD';
    final parts = name.trim().split(' ');
    if (parts.length == 1) return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }
}
