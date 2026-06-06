import { useState, useRef } from "react";
import { Loader2, Plus, Trash2, Mail, UserPlus, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useThemeSettings } from "@/shared/hooks/use-theme-settings";
import { AgencyProfileForm } from "@/features/agency-profile/components/agency-profile-form";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { useUploadLogo } from "@/features/agency-profile/hooks/use-upload-logo";
import { useLogoUrl } from "@/features/agency-profile/hooks/use-logo-url";
import { useUpsertOrgProfile } from "@/features/agency-profile/hooks/use-upsert-org-profile";

interface BankAccount {
  id: string;
  bankName: string;
  alias: string;
  cbu: string;
}

function LogoCustomUploader() {
  const { data: profile } = useOrgProfile();
  const { mutateAsync: uploadLogo, isPending: isUploading } = useUploadLogo();
  const { mutateAsync: upsertProfile, isPending: isSaving } = useUpsertOrgProfile();
  const { data: logoUrl } = useLogoUrl(profile?.logo_path);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const path = await uploadLogo({ file });
      await upsertProfile({ logo_path: path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el logo");
    }
  };

  const handleClearLogo = async () => {
    setError(null);
    try {
      await upsertProfile({ logo_path: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el logo");
    }
  };

  const isPending = isUploading || isSaving;

  return (
    <div className="space-y-4">
      <Label className="text-xs font-bold text-navy">Archivo del Logo</Label>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {logoUrl ? (
          <div className="relative group rounded-md overflow-hidden border border-border bg-white p-2">
            <img src={logoUrl} alt="Logo de la empresa" className="h-16 w-auto object-contain" />
            <button
              onClick={handleClearLogo}
              disabled={isPending}
              type="button"
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-xs rounded-md"
            >
              Eliminar
            </button>
          </div>
        ) : (
          <div className="h-16 w-16 bg-border flex items-center justify-center rounded-md text-slate2">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isPending}
            className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
          />
          <p className="text-[10px] text-slate2">
            Formatos soportados: JPG, PNG o WebP. Tamaño máximo: 2 MB.
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-brand font-semibold">
          <Loader2 className="h-3 w-3 animate-spin" />
          Subiendo y guardando logo...
        </div>
      )}
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<
    "company" | "customization" | "users"
  >("company");
  const { settings, setSettings, resetSettings } = useThemeSettings();

  // Dynamic Bank Accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    {
      id: "1",
      bankName: "Banco Galicia",
      alias: "NODO.GALICIA",
      cbu: "0070001120000000123456",
    },
  ]);
  const [newBank, setNewBank] = useState({ bankName: "", alias: "", cbu: "" });
  const [isAddingBank, setIsAddingBank] = useState(false);

  // Dynamic Users state (mocked mapped to Node architecture logic)
  const [users, setUsers] = useState([
    {
      id: "1",
      name: "Ramiro Tule",
      email: "ramiro@nodoinmo.com",
      role: "Nodo Administrador",
      status: "Activo",
    },
    {
      id: "2",
      name: "Juan Colega",
      email: "juan@inmobiliaria.com",
      role: "Nodo Colega",
      status: "Activo",
    },
  ]);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    role: "Nodo Colega",
  });
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bankName || !newBank.cbu) return;
    setBankAccounts((prev) => [
      ...prev,
      { id: Date.now().toString(), ...newBank },
    ]);
    setNewBank({ bankName: "", alias: "", cbu: "" });
    setIsAddingBank(false);
  };

  const handleRemoveBank = (id: string) => {
    setBankAccounts((prev) => prev.filter((b) => b.id !== id));
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) return;
    setIsInviting(true);
    setTimeout(() => {
      setUsers((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: newMember.name,
          email: newMember.email,
          role: newMember.role,
          status: "Pendiente",
        },
      ]);
      setNewMember({ name: "", email: "", role: "Nodo Colega" });
      setIsInviting(false);
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[92vh] md:h-[800px] flex flex-col p-0 overflow-hidden">
        {/* Header con tabs */}
        <div className="border-b border-border bg-paper p-6 pb-0 flex-shrink-0">
          <DialogHeader className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mr-6">
              <DialogTitle className="text-xl">
                Configuración del Panel
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSettings}
                className="text-xs border-brand text-brand hover:bg-brand hover:text-white"
              >
                Default Nodo (Restablecer)
              </Button>
            </div>
            <DialogDescription className="text-xs sm:text-sm">
              Personalizá los datos de tu empresa, el look & feel del panel y
              los accesos de tu equipo.
            </DialogDescription>
          </DialogHeader>

          {/* Selector de Tabs */}
          <div className="flex gap-4 border-b border-border overflow-x-auto scrollbar-none whitespace-nowrap -mx-6 px-6">
            <button
              onClick={() => setActiveTab("company")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex-shrink-0 ${
                activeTab === "company"
                  ? "border-brand text-brand"
                  : "border-transparent text-slate2 hover:text-navy"
              }`}
            >
              Mi Perfil / Empresa
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex-shrink-0 ${
                activeTab === "users"
                  ? "border-brand text-brand"
                  : "border-transparent text-slate2 hover:text-navy"
              }`}
            >
              Gestión de Usuarios y Roles
            </button>
            <button
              onClick={() => setActiveTab("customization")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex-shrink-0 ${
                activeTab === "customization"
                  ? "border-brand text-brand"
                  : "border-transparent text-slate2 hover:text-navy"
              }`}
            >
              Personalización del Panel
            </button>
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: Mi Perfil / Empresa */}
          {activeTab === "company" && (
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-bold text-navy mb-4">
                  Datos Fiscales y Comerciales
                </h3>
                <AgencyProfileForm onSuccess={() => {}} />
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-bold text-navy">
                      Cuentas Bancarias
                    </h3>
                    <p className="text-xs text-slate2">
                      Cuentas habilitadas para las liquidaciones y pagos.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsAddingBank(!isAddingBank)}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar cuenta
                  </Button>
                </div>

                {isAddingBank && (
                  <form
                    onSubmit={handleAddBank}
                    className="bg-paper p-4 rounded-md border border-border gap-4 grid grid-cols-1 sm:grid-cols-3 mb-4"
                  >
                    <div className="space-y-1">
                      <Label htmlFor="bankName">Banco</Label>
                      <Input
                        id="bankName"
                        placeholder="Ej. Banco Galicia"
                        value={newBank.bankName}
                        onChange={(e) =>
                          setNewBank({ ...newBank, bankName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="alias">Alias</Label>
                      <Input
                        id="alias"
                        placeholder="Ej. NODO.INMO"
                        value={newBank.alias}
                        onChange={(e) =>
                          setNewBank({ ...newBank, alias: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cbu">CBU/CVU</Label>
                      <Input
                        id="cbu"
                        placeholder="22 dígitos"
                        value={newBank.cbu}
                        onChange={(e) =>
                          setNewBank({ ...newBank, cbu: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingBank(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm">
                        Confirmar
                      </Button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-4 bg-card rounded-md border border-border flex justify-between items-start"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-navy text-sm">
                          {account.bankName}
                        </p>
                        <p className="text-xs text-slate2">
                          <strong>Alias:</strong> {account.alias || "-"}
                        </p>
                        <p className="text-xs text-slate2 font-mono">
                          <strong>CBU:</strong> {account.cbu}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveBank(account.id)}
                        className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {bankAccounts.length === 0 && (
                    <p className="col-span-2 text-center py-6 text-sm text-slate2">
                      No hay cuentas bancarias registradas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Personalización del Panel */}
          {activeTab === "customization" && (
            <div className="space-y-6">
              {/* Color Primario */}
              <div className="space-y-2">
                <Label className="text-base font-bold text-navy">
                  Color Primario
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color de marca que representa el dashboard (Botones y
                  Detalles). Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.primaryColor) ? settings.primaryColor : "#da5a0e"}
                    onChange={(e) =>
                      setSettings({ primaryColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#DA5A0E"
                      value={settings.primaryColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ primaryColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ primaryColor: "#da5a0e" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Naranja Nodo Inmo
                    </button>
                  </div>
                </div>
              </div>

              {/* Color Secundario (Menu lateral) */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color Secundario (Menú Lateral)
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color de fondo para la barra de navegación lateral. Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.secondaryColor) ? settings.secondaryColor : "#121e2f"}
                    onChange={(e) =>
                      setSettings({ secondaryColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#121E2F"
                      value={settings.secondaryColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ secondaryColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ secondaryColor: "#121e2f" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Azul Marino Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Color del Texto del Menú Lateral (Sin Seleccionar) */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color del Texto del Menú Lateral (Sin Seleccionar)
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color de fuente para los elementos del menú que no estén seleccionados (ej. Contratos, Pagos).
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.sidebarTextColor) ? settings.sidebarTextColor : "#9dacbe"}
                    onChange={(e) =>
                      setSettings({ sidebarTextColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#9DACBE"
                      value={settings.sidebarTextColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ sidebarTextColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ sidebarTextColor: "#9dacbe" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Gris Azulado Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Color de Fuente */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color de Fuente (Textos)
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color para los textos y títulos del sistema. Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.fontColor) ? settings.fontColor : "#16202e"}
                    onChange={(e) => setSettings({ fontColor: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#16202E"
                      value={settings.fontColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ fontColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() => setSettings({ fontColor: "#16202e" })}
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Color de Texto Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Color de Fuente de Botones */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Color de Texto en Botones Primarios
                </Label>
                <p className="text-xs text-slate2">
                  Elegí el color del texto y los iconos dentro de los botones rellenos. Puedes elegirlo o ingresar su código hexadecimal.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(settings.buttonFontColor) ? settings.buttonFontColor : "#ffffff"}
                    onChange={(e) =>
                      setSettings({ buttonFontColor: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-border p-1 bg-white flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      placeholder="#FFFFFF"
                      value={settings.buttonFontColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && !val.startsWith("#") && /^[0-9A-Fa-f]/.test(val)) {
                          val = "#" + val;
                        }
                        setSettings({ buttonFontColor: val });
                      }}
                      className="h-9 w-28 text-xs font-mono uppercase"
                      maxLength={7}
                    />
                    <button
                      onClick={() =>
                        setSettings({ buttonFontColor: "#ffffff" })
                      }
                      className="text-left text-xs text-brand hover:underline font-semibold"
                    >
                      Restablecer Color de Texto de Botón Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Logo del Panel */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Logo del Panel
                </Label>
                <p className="text-xs text-slate2">
                  Elegí si preferís usar el logo de Nodo, el logo cargado de tu
                  empresa, o un texto personalizado.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
                  {[
                    { id: "default", label: "Predeterminado Nodo" },
                    { id: "custom", label: "Logo de mi Empresa" },
                    { id: "text", label: "Texto / Nombre" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setSettings({ logoType: option.id as any })
                      }
                      className={`p-3 border text-center text-sm font-semibold rounded-md transition-all ${
                        settings.logoType === option.id
                          ? "border-brand bg-brand/5 text-brand"
                          : "border-border hover:bg-paper text-slate2"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {settings.logoType === "text" && (
                  <div className="space-y-2 bg-paper p-4 rounded-md border border-border">
                    <Label htmlFor="brandText">Texto de la Marca</Label>
                    <Input
                      id="brandText"
                      placeholder="Ej. Mi Inmobiliaria"
                      value={settings.brandText}
                      onChange={(e) =>
                        setSettings({ brandText: e.target.value })
                      }
                    />
                  </div>
                )}

                {settings.logoType === "custom" && (
                  <div className="space-y-4 bg-paper p-4 rounded-md border border-border">
                    <LogoCustomUploader />
                  </div>
                )}
              </div>

              {/* Estilo de Bordes */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Estilo de Bordes
                </Label>
                <p className="text-xs text-slate2">
                  Ajustá la redondez de los botones, inputs y tarjetas.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    {
                      id: "none",
                      label: "Rectos / Cuadrados",
                      previewClass: "rounded-none",
                    },
                    {
                      id: "md",
                      label: "Redondeados",
                      previewClass: "rounded-md",
                    },
                    {
                      id: "full",
                      label: "Curvos / Orgánicos",
                      previewClass: "rounded-full",
                    },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() =>
                        setSettings({ borderRadius: style.id as any })
                      }
                      className={`p-4 border text-left flex flex-col justify-between h-28 transition-all ${
                        settings.borderRadius === style.id
                          ? "border-brand bg-brand/5 shadow-sm"
                          : "border-border hover:bg-paper"
                      }`}
                      style={{
                        borderRadius:
                          style.id === "none"
                            ? "0px"
                            : style.id === "full"
                              ? "22px"
                              : "14px",
                      }}
                    >
                      <span className="text-sm font-bold text-navy">
                        {style.label}
                      </span>
                      <div
                        className="w-full h-8 bg-border flex items-center justify-center text-[10px] text-slate2 font-medium"
                        style={{
                          borderRadius:
                            style.id === "none"
                              ? "0px"
                              : style.id === "full"
                                ? "22px"
                                : "8px",
                        }}
                      >
                        Vista previa
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipografía */}
              <div className="space-y-2 border-t border-border pt-6">
                <Label className="text-base font-bold text-navy">
                  Tipografía del Sistema
                </Label>
                <p className="text-xs text-slate2">
                  Seleccioná una tipografía segura para maximizar la
                  legibilidad.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {(["Inter", "Roboto", "Montserrat"] as const).map((font) => (
                    <button
                      key={font}
                      onClick={() => setSettings({ fontFamily: font })}
                      className={`p-4 border text-left flex flex-col gap-2 transition-all ${
                        settings.fontFamily === font
                          ? "border-brand bg-brand/5 shadow-sm"
                          : "border-border hover:bg-paper"
                      }`}
                      style={{ fontFamily: font }}
                    >
                      <span className="text-base font-bold text-navy text-sm sm:text-base">
                        {font}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate2 leading-tight">
                        El veloz murciélago hindú comía feliz cardillo y kiwi.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Gestión de Usuarios y Roles */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-navy">
                    Equipo & Accesos
                  </h3>
                  <p className="text-xs text-slate2">
                    Administrá los roles mapeados directamente a la lógica de
                    nodos.
                  </p>
                </div>
              </div>

              {/* Formulario de invitación rápida */}
              <form
                onSubmit={handleInviteUser}
                className="bg-paper p-4 rounded-md border border-border gap-4 grid grid-cols-1 md:grid-cols-3 items-end"
              >
                <div className="space-y-1">
                  <Label htmlFor="memberName">Nombre completo</Label>
                  <Input
                    id="memberName"
                    placeholder="Ej. Lucas Gómez"
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="memberEmail">Email</Label>
                  <Input
                    id="memberEmail"
                    type="email"
                    placeholder="lucas@nodoinmo.com"
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="memberRole">Rol del Nodo</Label>
                  <select
                    id="memberRole"
                    value={newMember.role}
                    onChange={(e) =>
                      setNewMember({ ...newMember, role: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Nodo Administrador">
                      Nodo Administrador
                    </option>
                    <option value="Nodo Inquilino">Nodo Inquilino</option>
                    <option value="Nodo Propietario">Nodo Propietario</option>
                    <option value="Nodo Colega">Nodo Colega</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex justify-end gap-2">
                  <Button type="submit" disabled={isInviting} className="gap-2">
                    {isInviting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Invitando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Invitar Usuario
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {inviteSuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-md flex items-center gap-2 border border-emerald-200">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  <span>
                    ¡Email de verificación enviado exitosamente al invitado!
                  </span>
                </div>
              )}

              {/* Tabla de Usuarios */}
              <div className="border border-border rounded-md overflow-x-auto bg-card">
                <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-paper border-b border-border text-navy font-bold">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Rol asignado</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-slate2">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-paper/50">
                        <td className="p-3 font-semibold text-navy">
                          {user.name}
                        </td>
                        <td className="p-3">{user.email}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-navy/10 text-navy">
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                              user.status === "Activo"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
