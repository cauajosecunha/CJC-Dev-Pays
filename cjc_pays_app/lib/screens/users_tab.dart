import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class UsersTab extends StatefulWidget {
  const UsersTab({super.key});

  @override
  State<UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<UsersTab> {
  final _api = ApiService();
  final _auth = AuthService();
  final _dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  List<AdminUser> _users = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final users = await _api.getAdminUsers();
      if (!mounted) return;
      setState(() {
        _users = users;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _openCreateUserDialog() {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final usernameController = TextEditingController();
    final passwordController = TextEditingController();
    bool obscurePassword = true;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.person_add_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Cadastrar Novo Administrador',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Nome Completo *',
                      hintText: 'Ex: Cauã Cunha',
                      prefixIcon: Icon(Icons.person_outline_rounded, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'E-mail de Acesso *',
                      hintText: 'Ex: admin@cjcdev.com',
                      prefixIcon: Icon(Icons.email_outlined, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Nome de Usuário (Opcional)',
                      hintText: 'Ex: cauacunha',
                      prefixIcon: Icon(Icons.alternate_email_rounded, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: passwordController,
                    obscureText: obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Senha de Acesso (Mín. 6 caracteres) *',
                      hintText: '••••••••',
                      prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.primary, size: 20),
                      suffixIcon: IconButton(
                        icon: Icon(
                          obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                          size: 20,
                          color: AppColors.textMuted,
                        ),
                        onPressed: () => setModalState(() => obscurePassword = !obscurePassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final name = nameController.text.trim();
                            final email = emailController.text.trim();
                            final username = usernameController.text.trim();
                            final password = passwordController.text;

                            if (name.isEmpty || email.isEmpty || password.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Preencha todos os campos obrigatórios (Nome, E-mail e Senha).'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }

                            if (password.length < 6) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('A senha deve ter no mínimo 6 caracteres.'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }

                            final messenger = ScaffoldMessenger.of(context);
                            setModalState(() => isSubmitting = true);

                            try {
                              await _api.createAdminUser(
                                name: name,
                                email: email,
                                username: username.isNotEmpty ? username : null,
                                password: password,
                              );

                              if (!mounted) return;
                              if (ctx.mounted) Navigator.pop(ctx);
                              messenger.showSnackBar(
                                const SnackBar(
                                  content: Text('Administrador cadastrado com sucesso!'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                              _fetchUsers();
                            } catch (e) {
                              setModalState(() => isSubmitting = false);
                              if (!mounted) return;
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text('Erro ao cadastrar administrador: $e'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Text('Cadastrar Administrador'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openEditUserDialog(AdminUser user) {
    final nameController = TextEditingController(text: user.name);
    final emailController = TextEditingController(text: user.email);
    final usernameController = TextEditingController(text: user.username);
    final passwordController = TextEditingController();
    bool obscurePassword = true;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.edit_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Editar Administrador',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Nome Completo *',
                      prefixIcon: Icon(Icons.person_outline_rounded, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'E-mail de Acesso *',
                      prefixIcon: Icon(Icons.email_outlined, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Nome de Usuário (Opcional)',
                      prefixIcon: Icon(Icons.alternate_email_rounded, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: passwordController,
                    obscureText: obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Nova Senha (Opcional)',
                      hintText: 'Deixe em branco para manter a atual',
                      prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.primary, size: 20),
                      suffixIcon: IconButton(
                        icon: Icon(
                          obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                          size: 20,
                          color: AppColors.textMuted,
                        ),
                        onPressed: () => setModalState(() => obscurePassword = !obscurePassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Preencha a nova senha apenas se desejar alterá-la (mínimo de 6 caracteres).',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final name = nameController.text.trim();
                            final email = emailController.text.trim();
                            final username = usernameController.text.trim();
                            final password = passwordController.text;

                            if (name.isEmpty || email.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Nome e E-mail são obrigatórios.'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }

                            if (password.isNotEmpty && password.length < 6) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('A nova senha deve ter no mínimo 6 caracteres.'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }

                            final messenger = ScaffoldMessenger.of(context);
                            setModalState(() => isSubmitting = true);

                            try {
                              await _api.updateAdminUser(
                                id: user.id,
                                name: name,
                                email: email,
                                username: username,
                                password: password.isNotEmpty ? password : null,
                              );

                              if (!mounted) return;
                              if (ctx.mounted) Navigator.pop(ctx);
                              messenger.showSnackBar(
                                const SnackBar(
                                  content: Text('Administrador atualizado com sucesso!'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                              _fetchUsers();
                            } catch (e) {
                              setModalState(() => isSubmitting = false);
                              if (!mounted) return;
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text('Erro ao atualizar administrador: $e'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Text('Salvar Alterações'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleDeleteUser(AdminUser user) async {
    final currentUserId = _auth.currentUser?.id;

    if (currentUserId != null && currentUserId == user.id) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.surface,
          title: const Text('Ação Não Permitida'),
          content: const Text(
            'Você não pode excluir sua própria conta enquanto estiver conectado a ela.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Confirmar Exclusão'),
        content: Text(
          'Deseja realmente remover o administrador "${user.name}" (${user.email})? Esta ação é irreversível.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _api.deleteAdminUser(user.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Administrador removido com sucesso!'),
          backgroundColor: AppColors.success,
        ),
      );
      _fetchUsers();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Falha ao excluir administrador: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = _auth.currentUser?.id;

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.person_add_rounded),
        label: const Text('Novo Admin', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _openCreateUserDialog,
      ),
      body: Column(
        children: [
          // Header info bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.surface,
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  '${_users.length} administrador(es) cadastrado(s)',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textSecondary),
                  tooltip: 'Atualizar',
                  visualDensity: VisualDensity.compact,
                  onPressed: _fetchUsers,
                ),
              ],
            ),
          ),

          // Content
          Expanded(
            child: _isLoading && _users.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null && _users.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.danger),
                              const SizedBox(height: 16),
                              Text(_errorMessage!, textAlign: TextAlign.center),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _fetchUsers,
                                child: const Text('Tentar Novamente'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchUsers,
                        color: AppColors.primary,
                        child: _users.isEmpty
                            ? const Center(
                                child: Text('Nenhum administrador encontrado.', style: TextStyle(color: AppColors.textMuted)),
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                                itemCount: _users.length,
                                separatorBuilder: (context, index) => const SizedBox(height: 12),
                                itemBuilder: (ctx, i) {
                                  final user = _users[i];
                                  final isSelf = currentUserId == user.id;

                                  return Container(
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: isSelf ? AppColors.primary.withValues(alpha: 0.5) : AppColors.border,
                                        width: isSelf ? 1.5 : 1,
                                      ),
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            crossAxisAlignment: CrossAxisAlignment.center,
                                            children: [
                                              CircleAvatar(
                                                radius: 20,
                                                backgroundColor: isSelf ? AppColors.primary : AppColors.surfaceAlt,
                                                child: Text(
                                                  user.initials,
                                                  style: TextStyle(
                                                    color: isSelf ? Colors.black : AppColors.textPrimary,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 14,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Flexible(
                                                          child: Text(
                                                            user.name,
                                                            style: const TextStyle(
                                                              fontSize: 15,
                                                              fontWeight: FontWeight.bold,
                                                              color: AppColors.textPrimary,
                                                            ),
                                                            maxLines: 1,
                                                            overflow: TextOverflow.ellipsis,
                                                          ),
                                                        ),
                                                        if (isSelf) ...[
                                                          const SizedBox(width: 6),
                                                          Container(
                                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                            decoration: BoxDecoration(
                                                              color: AppColors.primary.withValues(alpha: 0.2),
                                                              borderRadius: BorderRadius.circular(6),
                                                            ),
                                                            child: const Text(
                                                              'Você',
                                                              style: TextStyle(
                                                                color: AppColors.primary,
                                                                fontSize: 10,
                                                                fontWeight: FontWeight.bold,
                                                              ),
                                                            ),
                                                          ),
                                                        ],
                                                      ],
                                                    ),
                                                    const SizedBox(height: 2),
                                                    Text(
                                                      user.email,
                                                      style: const TextStyle(
                                                        fontSize: 12,
                                                        color: AppColors.textSecondary,
                                                      ),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              PopupMenuButton<String>(
                                                icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textMuted),
                                                color: AppColors.surfaceAlt,
                                                shape: RoundedRectangleBorder(
                                                  borderRadius: BorderRadius.circular(10),
                                                  side: const BorderSide(color: AppColors.border),
                                                ),
                                                onSelected: (val) {
                                                  if (val == 'edit') {
                                                    _openEditUserDialog(user);
                                                  } else if (val == 'delete') {
                                                    _handleDeleteUser(user);
                                                  }
                                                },
                                                itemBuilder: (ctx) => [
                                                  const PopupMenuItem(
                                                    value: 'edit',
                                                    child: Row(
                                                      children: [
                                                        Icon(Icons.edit_rounded, size: 16, color: AppColors.primary),
                                                        SizedBox(width: 8),
                                                        Text('Editar Administrador', style: TextStyle(fontSize: 13)),
                                                      ],
                                                    ),
                                                  ),
                                                  PopupMenuItem(
                                                    value: 'delete',
                                                    enabled: !isSelf,
                                                    child: Row(
                                                      children: [
                                                        Icon(
                                                          Icons.delete_outline_rounded,
                                                          size: 16,
                                                          color: isSelf ? AppColors.textMuted : AppColors.danger,
                                                        ),
                                                        const SizedBox(width: 8),
                                                        Text(
                                                          'Excluir Administrador',
                                                          style: TextStyle(
                                                            fontSize: 13,
                                                            color: isSelf ? AppColors.textMuted : AppColors.danger,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 10),
                                          const Divider(height: 1),
                                          const SizedBox(height: 8),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                user.username.isNotEmpty ? '@${user.username}' : '—',
                                                style: const TextStyle(
                                                  color: AppColors.textMuted,
                                                  fontFamily: 'monospace',
                                                  fontSize: 11,
                                                ),
                                              ),
                                              if (user.createdAt != null)
                                                Text(
                                                  'Cadastrado em: ${_dateFormat.format(user.createdAt!)}',
                                                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                                ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}
