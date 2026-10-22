import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { MAX_UPLOAD_BYTES } from '@fixnow/shared';
import { api } from './api';

export interface PickedMedia { id: string; uri: string; mediaType: 'PHOTO' | 'VIDEO' }

const MAX_PHOTO_WIDTH = 1280;

/** Downscales large photos and re-encodes as JPEG so uploads stay small on slow connections. */
async function compressPhoto(asset: ImagePicker.ImagePickerAsset): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (asset.width > MAX_PHOTO_WIDTH) ctx.resize({ width: MAX_PHOTO_WIDTH, height: null });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return saved.base64 ? { base64: saved.base64, mimeType: 'image/jpeg' } : null;
  } catch {
    return null; // fall back to the picker's own (already compressed) output
  }
}

async function uriToBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('File too large (max 8 MB)');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Lets the user pick a photo/video, compresses photos (quality 0.5, low-cost Android friendly)
 * and uploads it to private storage. Returns null when the user cancels.
 */
export async function pickAndUpload(purpose: string, kind: 'images' | 'videos' = 'images'): Promise<PickedMedia | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Permission to access photos was denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [kind],
    quality: 0.5,
    base64: false, // photos are re-encoded by compressPhoto; videos are read from the file
    videoMaxDuration: 20,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  let mimeType = asset.mimeType ?? (kind === 'videos' ? 'video/mp4' : 'image/jpeg');
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  let dataBase64: string | null = null;
  if (kind === 'images') {
    const compressed = await compressPhoto(asset);
    if (compressed) { dataBase64 = compressed.base64; mimeType = compressed.mimeType; }
  }
  dataBase64 ??= asset.base64 ?? (await uriToBase64(asset.uri));
  const uploaded = await api<{ id: string; mediaType: 'PHOTO' | 'VIDEO' }>('/uploads', {
    method: 'POST', body: { purpose, mimeType, dataBase64 },
  });
  return { id: uploaded.id, uri: asset.uri, mediaType: uploaded.mediaType };
}
