import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, LogOut, Mail, User, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportarBackup, baixarBackupJSON, importarBackup, type BackupPayload } from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({ meta: [{ title: "Minha conta" }] }),
  component: ContaPage,
});

function ContaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (u) {
        setCurrentEmail(u.email ?? "");
        setEmail(u.email ?? "");
        setUserId(u.id);
        setCreatedAt(u.created_at ?? "");
        const newEmail = (u as { new_email?: string }).new_email;
        setPendingEmail(newEmail && newEmail !== u.email ? newEmail : null);
      }
      setLoading(false);
    })();
  }, []);

  async function salvarEmail(e: React.FormEvent) {
    e.preventDefault();
    const novo = email.trim();
    if (!novo || novo === currentEmail) {
      toast.info("Informe um novo e-mail diferente do atual.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser(
      { email: novo },
      { emailRedirectTo: window.location.origin + "/conta" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPendingEmail(novo);
    toast.success("Enviamos um link de confirmação para o novo e-mail.");
  }

  async function sair() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function baixarBackup() {
    setExportando(true);
    try {
      const payload = await exportarBackup();
      baixarBackupJSON(payload);
      toast.success(
        `Backup gerado: ${payload.diarias.length} diárias e ${payload.adiantamentos.length} adiantamentos.`,
      );
    } catch (e) {
      toast.error("Falha ao exportar. " + (e instanceof Error ? e.message : ""));
    } finally {
      setExportando(false);
    }
  }

  async function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let payload: BackupPayload;
    try {
      payload = JSON.parse(await file.text()) as BackupPayload;
    } catch {
      toast.error("Arquivo inválido (não é JSON).");
      return;
    }
    const modo = window.confirm(
      "Deseja SUBSTITUIR os dados atuais pelo backup?\n\n" +
        "OK = substituir (apaga tudo e importa)\n" +
        "Cancelar = mesclar (mantém os atuais e adiciona os do backup)",
    )
      ? "substituir"
      : "mesclar";
    setImportando(true);
    try {
      const r = await importarBackup(payload, modo);
      toast.success(
        `Importado: ${r.diariasInseridas} diárias e ${r.adiantInseridos} adiantamentos.`,
      );
    } catch (err) {
      toast.error("Falha ao importar. " + (err instanceof Error ? err.message : ""));
    } finally {
      setImportando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <header className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar">
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
            <p className="text-sm text-muted-foreground">Atualize seu e-mail e gerencie sua sessão.</p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">E-mail atual</span>
              <span className="font-medium truncate">{currentEmail || "—"}</span>
            </div>
            {pendingEmail && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Aguardando confirmação</span>
                <span className="font-medium truncate">{pendingEmail}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">ID do usuário</span>
              <span className="font-mono text-xs truncate">{userId}</span>
            </div>
            {createdAt && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Conta criada em</span>
                <span>{new Date(createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Atualizar e-mail
            </CardTitle>
            <CardDescription>
              Enviaremos um link de confirmação para o novo endereço.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Novo e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Salvando…" : "Salvar e-mail"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" /> Backup e restauração
            </CardTitle>
            <CardDescription>
              Exporte todos os seus dados em JSON ou restaure a partir de um backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={baixarBackup}
              disabled={exportando}
              variant="outline"
              className="w-full"
            >
              <Download className="h-4 w-4" />
              {exportando ? "Exportando…" : "Exportar backup (.json)"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={aoSelecionarArquivo}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importando}
              variant="outline"
              className="w-full"
            >
              <Upload className="h-4 w-4" />
              {importando ? "Importando…" : "Restaurar backup"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Na restauração você pode mesclar (mantém o que já tem) ou substituir (apaga tudo antes de importar).
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogOut className="h-4 w-4" /> Sessão
            </CardTitle>
            <CardDescription>Encerre a sessão neste dispositivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={sair} disabled={signingOut} className="w-full">
              {signingOut ? "Saindo…" : "Sair da conta"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
