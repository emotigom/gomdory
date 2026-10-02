export async function toDataURL(text: string): Promise<string> {
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(text)}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error("QR 코드를 생성하지 못했습니다.");
  }

  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("QR 데이터를 불러오지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}
