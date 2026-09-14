"use client";

import { useEffect } from "react";
import { showError, showSuccess } from "@/lib/sweetalert";

export function AdminFlashAlert({ saved, error }: { saved?: string; error?: string }) {
  useEffect(() => {
    if (saved) void showSuccess("Changes saved successfully.");
    else if (error) void showError("The requested change could not be completed. Check the values and your access level.");
  }, [saved, error]);
  return null;
}
