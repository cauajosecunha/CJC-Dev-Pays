import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

class FileDownloadService {
  /// Salva os bytes de um arquivo na pasta de Downloads do dispositivo
  /// Tenta a pasta pública '/storage/emulated/0/Download' no Android e possui
  /// fallback seguro para getDownloadsDirectory() e getExternalStorageDirectory().
  static Future<File> saveFileToDevice({
    required String filename,
    required List<int> bytes,
  }) async {
    // 1. No Android, tenta salvar na pasta pública oficial de Downloads
    if (Platform.isAndroid) {
      try {
        final publicDownload = Directory('/storage/emulated/0/Download');
        if (await publicDownload.exists()) {
          final targetFile = File('${publicDownload.path}/$filename');
          await targetFile.writeAsBytes(bytes);
          return targetFile;
        }
      } catch (e) {
        debugPrint('Aviso: pasta pública restrita pelo Android, aplicando fallback: $e');
      }
    }

    // 2. Tenta o diretório de downloads oficial do path_provider
    Directory? targetDir;
    try {
      targetDir = await getDownloadsDirectory();
    } catch (_) {}

    // 3. Tenta o armazenamento externo do app
    if (targetDir == null) {
      try {
        targetDir = await getExternalStorageDirectory();
      } catch (_) {}
    }

    // 4. Fallback final para a pasta de documentos do app
    targetDir ??= await getApplicationDocumentsDirectory();

    final fallbackFile = File('${targetDir.path}/$filename');
    await fallbackFile.writeAsBytes(bytes);
    return fallbackFile;
  }
}
