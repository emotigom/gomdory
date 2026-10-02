export type UploadStatus = "queued" | "uploading" | "success" | "failed";

export type UploadItem = {
  id: string;
  file: File;
  previewUrl?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  fileId?: string;
  bytesSaved?: number | null;
  optimizedBytes?: number | null;
  originalBytes?: number | null;
  deduped?: boolean;
};

export type UploadState = {
  items: UploadItem[];
};

export type UploadAction =
  | { type: "enqueue"; items: UploadItem[] }
  | { type: "start"; id: string }
  | { type: "progress"; id: string; progress: number }
  | { type: "success"; id: string; file: { id: string; bytesSaved?: number | null; originalBytes?: number | null; optimizedBytes?: number | null; deduped?: boolean } }
  | { type: "failure"; id: string; error?: string }
  | { type: "retry"; id: string };

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "enqueue": {
      return { items: [...state.items, ...action.items] };
    }
    case "start": {
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, status: "uploading", progress: Math.max(item.progress, 5), error: undefined } : item,
        ),
      };
    }
    case "progress": {
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, progress: Math.min(100, action.progress) } : item,
        ),
      };
    }
    case "success": {
      return {
        items: state.items.map((item) =>
          item.id === action.id
            ? {
                ...item,
                status: "success",
                progress: 100,
                error: undefined,
                fileId: action.file.id,
                bytesSaved: action.file.bytesSaved ?? item.bytesSaved,
                optimizedBytes: action.file.optimizedBytes ?? item.optimizedBytes,
                originalBytes: action.file.originalBytes ?? item.originalBytes,
                deduped: action.file.deduped ?? item.deduped,
              }
            : item,
        ),
      };
    }
    case "failure": {
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, status: "failed", error: action.error ?? "failed" } : item,
        ),
      };
    }
    case "retry": {
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, status: "queued", progress: 0, error: undefined } : item,
        ),
      };
    }
    default:
      return state;
  }
}
