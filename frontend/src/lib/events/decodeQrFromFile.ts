import { BrowserQRCodeReader } from "@zxing/browser";

export async function decodeQrFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserQRCodeReader();
    const result = await reader.decodeFromImageUrl(url);
    return result.getText().trim();
  } finally {
    URL.revokeObjectURL(url);
  }
}
