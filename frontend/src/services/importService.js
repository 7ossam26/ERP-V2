const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function downloadTemplate(type) {
  const res = await fetch(`${API_BASE}/imports/templates/${type}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("فشل تحميل القالب");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `template_${type}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importFile(type, file, dryRun = false) {
  const form = new FormData();
  form.append("file", file);
  const url = `${API_BASE}/imports/${type}${dryRun ? "?dryRun=true" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل الاستيراد");
  return data;
}

async function getBranches() {
  const res = await fetch(`${API_BASE}/imports/branches`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("فشل تحميل الفروع");
  return res.json();
}

export const importService = { downloadTemplate, importFile, getBranches };
