import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const saveFileWithPicker = async (sourceUri: string, fileName: string) => {
  if (Platform.OS !== 'android') {
    return sourceUri;
  }

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    return sourceUri;
  }

  const base64Content = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    fileName,
    EXCEL_MIME_TYPE,
  );

  await FileSystem.writeAsStringAsync(destinationUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return destinationUri;
};
