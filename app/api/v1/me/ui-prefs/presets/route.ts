import { handleCreatePreset, handleDeletePreset, handleGetPresets, handleRenamePreset } from "./handlers";

export async function GET(request: Request) {
  return handleGetPresets(request);
}

export async function POST(request: Request) {
  return handleCreatePreset(request);
}

export async function PATCH(request: Request) {
  return handleRenamePreset(request);
}

export async function DELETE(request: Request) {
  return handleDeletePreset(request);
}
