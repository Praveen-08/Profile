"use client";

import * as React from "react";
import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

function isAccepted(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function UploadDropzone({
  files,
  onFilesChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(isAccepted);
    onFilesChange([...files, ...accepted]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center transition-colors",
          isDragging && "border-accent bg-muted"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop bracketed photos here</p>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, or TIFF straight from your camera (EXIF capture time required for auto-grouping)
        </p>
        <button
          type="button"
          className="mt-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span>{files.length} file(s) selected</span>
            <button className="underline" onClick={() => onFilesChange([])}>
              Clear all
            </button>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <button onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
