"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export default function AdminBackupPage() {
  // ── Remote sync state ──────────────────────────────────────────────────────
  const [sshPublicKey, setSshPublicKey] = useState<string | null>(null);
  const [sshKeyLoading, setSshKeyLoading] = useState(true);
  const [sshKeyGenerating, setSshKeyGenerating] = useState(false);
  const [sshKeyCopied, setSshKeyCopied] = useState(false);
  const [sshKeyError, setSshKeyError] = useState("");

  const [remoteHost, setRemoteHost] = useState("");
  const [remotePort, setRemotePort] = useState("");
  const [remotePath, setRemotePath] = useState("~/eve-backups");
  const [remoteLastSync, setRemoteLastSync] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [savedRemoteHost, setSavedRemoteHost] = useState<string | null>(null);
  const [savedRemotePort, setSavedRemotePort] = useState<string | null>(null);
  const [remoteSaving, setRemoteSaving] = useState(false);
  const [remoteSaveError, setRemoteSaveError] = useState("");
  const [remoteSaveSuccess, setRemoteSaveSuccess] = useState(false);
  const [remoteDisabling, setRemoteDisabling] = useState(false);
  const [remoteDisableConfirming, setRemoteDisableConfirming] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/backup/ssh-key")
      .then((r) => r.json())
      .then((d) => setSshPublicKey(d.publicKey ?? null))
      .catch(() => setSshPublicKey(null))
      .finally(() => setSshKeyLoading(false));

    fetch("/api/admin/backup/remote")
      .then((r) => r.json())
      .then((d) => {
        setRemoteHost(d.host ?? "");
        setRemotePort(d.port ? String(d.port) : "");
        setRemotePath(d.path ?? "~/eve-backups");
        setRemoteLastSync(d.lastSync ?? null);
        setSavedRemoteHost(d.host ?? null);
        setSavedRemotePort(d.port ? String(d.port) : null);
      })
      .catch(() => {})
      .finally(() => setRemoteLoading(false));
  }, []);

  async function handleGenerateKey() {
    setSshKeyGenerating(true);
    setSshKeyError("");
    try {
      const res = await fetch("/api/admin/backup/ssh-key", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSshKeyError(data.error ?? "Error generando clave SSH"); return; }
      setSshPublicKey(data.publicKey);
    } catch {
      setSshKeyError("Error de conexión");
    } finally {
      setSshKeyGenerating(false);
    }
  }

  async function handleCopyKey() {
    if (!sshPublicKey) return;
    await navigator.clipboard.writeText(sshPublicKey);
    setSshKeyCopied(true);
    setTimeout(() => setSshKeyCopied(false), 2000);
  }

  async function handleDisableRemote() {
    setRemoteDisabling(true);
    setRemoteSaveError("");
    setRemoteSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/backup/remote", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRemoteSaveError(data.error ?? "Error al desactivar");
        return;
      }
      setRemoteHost(""); setRemotePort(""); setRemoteLastSync(null);
      setRemoteDisableConfirming(false); setSavedRemoteHost(null); setSavedRemotePort(null);
    } catch {
      setRemoteSaveError("Error de conexión");
    } finally {
      setRemoteDisabling(false);
    }
  }

  async function handleSaveRemote() {
    setRemoteSaving(true);
    setRemoteSaveError("");
    setRemoteSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/backup/remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: remoteHost, port: remotePort || null, path: remotePath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setRemoteSaveError(data.error ?? "Error guardando configuración"); return; }
      setRemoteSaveSuccess(true);
      setSavedRemoteHost(remoteHost.trim());
      setSavedRemotePort(remotePort.trim() || null);
    } catch {
      setRemoteSaveError("Error de conexión");
    } finally {
      setRemoteSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncError(""); setSyncOutput(""); setSyncSuccess(false);
    try {
      const res = await fetch("/api/admin/backup/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setSyncError(data.error ?? "Error en la sincronización"); return; }
      setSyncSuccess(true);
      setSyncOutput(data.output ?? "");
      setRemoteLastSync(new Date().toISOString());
    } catch {
      setSyncError("Error de conexión");
    } finally {
      setSyncing(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // ── Local backup state ──────────────────────────────────────────────────────
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [confirmingServerRestore, setConfirmingServerRestore] = useState<string | null>(null);
  const [serverRestoreLoading, setServerRestoreLoading] = useState(false);
  const [serverRestoreError, setServerRestoreError] = useState("");
  const [serverRestoreSuccess, setServerRestoreSuccess] = useState(false);

  const loadBackups = useCallback(() => {
    setBackupsLoading(true);
    fetch("/api/admin/backup/list")
      .then((r) => r.json())
      .then((d) => setBackups(Array.isArray(d) ? d : []))
      .catch(() => setBackups([]))
      .finally(() => setBackupsLoading(false));
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  async function handleDownload() {
    setDownloadError(""); setDownloadLoading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDownloadError(data.error ?? "Error al generar el backup");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : "eve_backup.db";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Error de conexión");
    } finally {
      setDownloadLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file); setConfirming(false); setRestoreError(""); setRestoreSuccess(false);
  }

  async function handleServerRestore(filename: string) {
    setServerRestoreLoading(true); setServerRestoreError(""); setServerRestoreSuccess(false);
    try {
      const res = await fetch(`/api/admin/backup/files/${encodeURIComponent(filename)}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setServerRestoreError(data.error ?? "Error al restaurar"); return; }
      setServerRestoreSuccess(true); setConfirmingServerRestore(null);
    } catch {
      setServerRestoreError("Error de conexión");
    } finally {
      setServerRestoreLoading(false);
    }
  }

  async function handleDownloadFile(filename: string) {
    setDownloadingFile(filename);
    try {
      const res = await fetch(`/api/admin/backup/files/${encodeURIComponent(filename)}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingFile(null);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatBackupName(name: string) {
    const m = name.match(/eve_backup_(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/)
      ?? name.match(/eve_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
    if (!m) return name;
    return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  }

  async function handleRestore() {
    if (!selectedFile) return;
    setRestoreLoading(true); setRestoreError(""); setRestoreSuccess(false);
    try {
      const formData = new FormData();
      formData.append("backup", selectedFile);
      const res = await fetch("/api/admin/backup", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setRestoreError(data.error ?? "Error al restaurar"); return; }
      setRestoreSuccess(true); setSelectedFile(null); setConfirming(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setRestoreError("Error de conexión");
    } finally {
      setRestoreLoading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-100">Copias de seguridad</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ── Columna izquierda: operaciones locales ── */}
        <div className="space-y-4">

          {/* Backup manual */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-100">Backup manual</h2>
              <p className="text-sm text-gray-500 mt-1">Descarga una copia de la base de datos en este momento.</p>
            </div>
            {downloadError && <p className="text-sm text-red-400">{downloadError}</p>}
            <button onClick={handleDownload} disabled={downloadLoading} className="btn-sm btn-primary disabled:opacity-50">
              {downloadLoading ? "Generando…" : "↓ Descargar backup"}
            </button>
          </div>

          {/* Restaurar backup */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-100">Restaurar backup</h2>
              <p className="text-sm text-gray-500 mt-1">
                Sube un fichero <code className="bg-gray-800 px-1 rounded text-xs">.db</code> para
                reemplazar la base de datos actual. Esta acción es irreversible.
              </p>
            </div>

            <input ref={fileInputRef} type="file" accept=".db" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-sm btn-ghost"
            >
              ↑ Seleccionar archivo
            </button>

            {selectedFile && !confirming && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300 truncate">
                  {selectedFile.name} <span className="text-gray-500">({formatSize(selectedFile.size)})</span>
                </span>
                <button onClick={() => setConfirming(true)} className="btn-sm btn-danger shrink-0">
                  Restaurar
                </button>
              </div>
            )}

            {confirming && (
              <div className="rounded border border-yellow-800 bg-yellow-900/20 p-4 space-y-3">
                <p className="text-sm text-yellow-300 font-medium">¿Seguro que quieres restaurar este backup?</p>
                <p className="text-sm text-yellow-400">
                  Se reemplazará la base de datos con <strong>{selectedFile?.name}</strong>.
                  Todos los cambios posteriores se perderán permanentemente.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleRestore} disabled={restoreLoading} className="btn-sm btn-danger disabled:opacity-50">
                    {restoreLoading ? "Restaurando…" : "Confirmar restauración"}
                  </button>
                  <button onClick={() => setConfirming(false)} disabled={restoreLoading} className="btn-ghost text-sm disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {restoreError && <p className="text-sm text-red-400">{restoreError}</p>}
            {restoreSuccess && <p className="text-sm text-green-400 font-medium">Backup restaurado correctamente</p>}
          </div>

          {/* Backups guardados */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-100">Backups guardados</h2>
                <p className="text-sm text-gray-500 mt-1">Copias automáticas almacenadas en el servidor.</p>
              </div>
              <button onClick={loadBackups} disabled={backupsLoading} className="btn-ghost text-xs disabled:opacity-40">
                ↻ Actualizar
              </button>
            </div>

            {serverRestoreError && <p className="text-sm text-red-400">{serverRestoreError}</p>}
            {serverRestoreSuccess && <p className="text-sm text-green-400 font-medium">Backup restaurado correctamente</p>}

            {backupsLoading ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : backups.length === 0 ? (
              <p className="text-sm text-gray-500">No hay backups guardados en el servidor.</p>
            ) : (
              <div className="space-y-2">
                <div className="rounded border border-gray-800 overflow-hidden">
                  <div className="overflow-y-auto max-h-56">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="bg-gray-800 border-b border-gray-700">
                          <th className="text-left px-3 py-2 font-medium text-gray-400">Fecha</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400">Tamaño</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {backups.map((b) => (
                          <tr key={b.name} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-3 py-2 text-gray-300 font-mono text-xs">{formatBackupName(b.name)}</td>
                            <td className="px-3 py-2 text-right text-gray-500 tabular-nums text-xs">{formatSize(b.size)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => { setConfirmingServerRestore(b.name); setServerRestoreError(""); setServerRestoreSuccess(false); }}
                                  disabled={serverRestoreLoading}
                                  className="btn-ghost btn-danger text-xs disabled:opacity-40"
                                >
                                  Restaurar
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(b.name)}
                                  disabled={downloadingFile === b.name}
                                  className="btn-ghost text-xs disabled:opacity-40"
                                >
                                  {downloadingFile === b.name ? "…" : "↓ Descargar"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {confirmingServerRestore && (
                  <div className="rounded border border-yellow-800 bg-yellow-900/20 p-4 space-y-3">
                    <p className="text-sm text-yellow-300 font-medium">¿Seguro que quieres restaurar este backup?</p>
                    <p className="text-sm text-yellow-400">
                      Se reemplazará la base de datos con <strong>{formatBackupName(confirmingServerRestore)}</strong>.
                      Todos los cambios posteriores se perderán permanentemente.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => handleServerRestore(confirmingServerRestore)} disabled={serverRestoreLoading} className="btn-sm btn-danger disabled:opacity-50">
                        {serverRestoreLoading ? "Restaurando…" : "Confirmar restauración"}
                      </button>
                      <button onClick={() => setConfirmingServerRestore(null)} disabled={serverRestoreLoading} className="btn-ghost text-sm disabled:opacity-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: sincronización remota ── */}
        <div className="space-y-4">

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-100">Sincronización remota</h2>

            {/* SSH key */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-300">Clave SSH pública</h3>
              {sshKeyError && <p className="text-sm text-red-400">{sshKeyError}</p>}
              {sshKeyLoading ? (
                <p className="text-sm text-gray-500">Cargando…</p>
              ) : sshPublicKey ? (
                <div className="space-y-2">
                  <textarea
                    readOnly
                    value={sshPublicKey}
                    rows={3}
                    className="w-full font-mono text-xs bg-gray-950 border border-gray-700 rounded p-2 text-gray-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCopyKey} className="btn-ghost text-xs">
                      {sshKeyCopied ? "✓ Copiado" : "Copiar"}
                    </button>
                    <button onClick={handleGenerateKey} disabled={sshKeyGenerating} className="btn-ghost text-xs disabled:opacity-50">
                      {sshKeyGenerating ? "Generando…" : "↻ Regenerar"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Añade esta clave a <code className="bg-gray-800 px-1 rounded">~/.ssh/authorized_keys</code> del servidor remoto.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">No hay clave SSH generada.</p>
                  <button onClick={handleGenerateKey} disabled={sshKeyGenerating} className="btn-sm btn-ghost disabled:opacity-50">
                    {sshKeyGenerating ? "Generando…" : "Generar clave SSH"}
                  </button>
                </div>
              )}
            </div>

            {/* Remote config */}
            <div className="space-y-2 border-t border-gray-800 pt-4">
              <h3 className="text-sm font-medium text-gray-300">Servidor destino</h3>
              {savedRemoteHost && (
                <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-900/20 border border-green-800">
                  <span className="text-xs text-green-400 font-medium">Configurado:</span>
                  <code className="text-xs text-green-300 font-mono flex-1">{savedRemoteHost}:{savedRemotePort ?? "22"}</code>
                  {!remoteDisableConfirming && (
                    <button onClick={() => setRemoteDisableConfirming(true)} className="btn-ghost btn-danger text-xs">
                      Desactivar
                    </button>
                  )}
                </div>
              )}
              {remoteLoading ? (
                <p className="text-sm text-gray-500">Cargando…</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">usuario@servidor</label>
                      <input type="text" value={remoteHost} onChange={(e) => { setRemoteHost(e.target.value); setRemoteSaveSuccess(false); }} placeholder="user@host.example.com" className="input w-full" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-gray-500 mb-1">Puerto SSH</label>
                      <input type="number" value={remotePort} onChange={(e) => { setRemotePort(e.target.value); setRemoteSaveSuccess(false); }} placeholder="22" min={1} max={65535} className="input w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ruta remota</label>
                    <input type="text" value={remotePath} onChange={(e) => { setRemotePath(e.target.value); setRemoteSaveSuccess(false); }} placeholder="~/eve-backups" className="input w-full" />
                  </div>
                  {remoteSaveError && <p className="text-sm text-red-400">{remoteSaveError}</p>}
                  {remoteSaveSuccess && <p className="text-sm text-green-400">Configuración guardada.</p>}
                  <button onClick={handleSaveRemote} disabled={remoteSaving || !remoteHost.trim()} className="btn-sm btn-primary disabled:opacity-50">
                    {remoteSaving ? "Guardando…" : "Guardar configuración"}
                  </button>
                  {remoteDisableConfirming && (
                    <div className="rounded border border-red-800 bg-red-900/20 p-3 space-y-2">
                      <p className="text-sm text-red-300 font-medium">¿Desactivar la sincronización remota?</p>
                      <p className="text-xs text-red-400">Se borrará la configuración del servidor destino.</p>
                      <div className="flex gap-2">
                        <button onClick={handleDisableRemote} disabled={remoteDisabling} className="btn-sm btn-danger disabled:opacity-50">
                          {remoteDisabling ? "Desactivando…" : "Confirmar"}
                        </button>
                        <button onClick={() => setRemoteDisableConfirming(false)} disabled={remoteDisabling} className="btn-ghost text-sm disabled:opacity-50">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sync now */}
            <div className="border-t border-gray-800 pt-4 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={handleSync} disabled={syncing} className="btn-sm btn-ghost disabled:opacity-50">
                  {syncing ? "Sincronizando…" : "↻ Sincronizar ahora"}
                </button>
                <span className="text-xs text-gray-500">
                  {remoteLastSync ? `Última sync: ${formatDate(remoteLastSync)}` : "Sin sincronizar"}
                </span>
              </div>
              {syncError && (
                <div className="rounded border border-red-800 bg-red-900/20 p-3">
                  <p className="text-sm text-red-400 font-medium mb-1">Error de sincronización</p>
                  <pre className="text-xs text-red-400 whitespace-pre-wrap overflow-auto max-h-28">{syncError}</pre>
                </div>
              )}
              {syncSuccess && (
                <div className="space-y-1">
                  <p className="text-sm text-green-400 font-medium">Sincronización completada.</p>
                  {syncOutput && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-300">Ver output</summary>
                      <pre className="mt-1 p-2 bg-gray-950 rounded text-gray-400 whitespace-pre-wrap overflow-auto max-h-36">{syncOutput}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Backup automático */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-2">
            <h2 className="text-base font-semibold text-gray-100">Backup automático (Docker)</h2>
            <p className="text-sm text-gray-500">
              Cuando la aplicación se ejecuta en Docker, se realiza automáticamente una copia
              cada noche a las 02:00. Los backups se guardan en{" "}
              <code className="bg-gray-800 px-1 rounded text-xs">/data/backups/</code> y
              se conservan las últimas copias indicadas en{" "}
              <code className="bg-gray-800 px-1 rounded text-xs">BACKUP_KEEP_COPIES</code> (por defecto: 7).
              Si está configurada la sincronización remota, el cron también ejecuta rsync tras cada backup.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
