"use client";

import Swal from "sweetalert2";

export async function confirmAction(title: string, text: string, confirmButtonText: string) {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: "Go back",
    reverseButtons: true,
    customClass: { popup: "snowaz-alert", confirmButton: "snowaz-alert-confirm", cancelButton: "snowaz-alert-cancel" },
  });
  return result.isConfirmed;
}

export function showSuccess(message: string) {
  return Swal.fire({ toast: true, position: "top-end", icon: "success", title: message, showConfirmButton: false, timer: 3200, timerProgressBar: true, customClass: { popup: "snowaz-toast" } });
}

export function showError(message: string) {
  return Swal.fire({ icon: "error", title: "Something needs attention", text: message, confirmButtonText: "Okay", customClass: { popup: "snowaz-alert", confirmButton: "snowaz-alert-confirm" } });
}
