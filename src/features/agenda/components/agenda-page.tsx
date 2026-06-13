import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Clock,
  User,
  MapPin,
  Wrench,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  FileText
} from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, TaskRow } from "../hooks/use-tasks";
import { useProperties } from "@/features/properties/hooks/use-properties";
import { useContacts } from "@/features/contacts/hooks/use-contacts";
import { useStaff } from "@/shared/hooks/use-staff";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

// Category configuration
const CATEGORIES = [
  { value: "general", label: "General", icon: CheckCircle2, bg: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "visita", label: "Visita/Muestra", icon: MapPin, bg: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "firma", label: "Firma de Contrato", icon: FileText, bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "cobro", label: "Cobro/Alquiler", icon: DollarSign, bg: "bg-green-50 text-green-700 border-green-200" },
  { value: "mantenimiento", label: "Mantenimiento", icon: Wrench, bg: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "tramite", label: "Trámite/Papelería", icon: ClipboardList, bg: "bg-purple-50 text-purple-700 border-purple-200" }
];

export function AgendaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: properties = [] } = useProperties();
  const { data: contacts = [] } = useContacts();
  const { users } = useStaff();

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  // Filters State
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pendiente"); // default view pending tasks
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  // Selection Date navigation
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formPriority, setFormPriority] = useState("media");
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formPropertyId, setFormPropertyId] = useState("");
  const [formContactId, setFormContactId] = useState("");

  const handleOpenCreateDialog = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormCategory("general");
    setFormPriority("media");
    setFormDueDate(selectedDateStr);
    setFormAssignedTo("");
    setFormPropertyId("");
    setFormContactId("");
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (task: TaskRow) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormDueDate(task.due_date);
    setFormAssignedTo(task.assigned_to || "");
    setFormPropertyId(task.property_id || "");
    setFormContactId(task.contact_id || "");
    setDialogOpen(true);
  };

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || isLoading) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setSelectedDateStr(task.due_date);
    setFilterStatus("all");
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormDueDate(task.due_date);
    setFormAssignedTo(task.assigned_to || "");
    setFormPropertyId(task.property_id || "");
    setFormContactId(task.contact_id || "");
    setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, tasks, isLoading, setSearchParams]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      category: formCategory,
      priority: formPriority,
      due_date: formDueDate,
      assigned_to: formAssignedTo.trim() || null,
      property_id: formPropertyId || null,
      contact_id: formContactId || null,
      status: editingTask ? editingTask.status : "pendiente"
    };

    try {
      if (editingTask) {
        await updateTaskMutation.mutateAsync({
          id: editingTask.id,
          ...payload
        });
      } else {
        await createTaskMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Error saving task:", err);
    }
  };

  const handleToggleStatus = async (task: TaskRow) => {
    const nextStatus = task.status === "completada" ? "pendiente" : "completada";
    try {
      await updateTaskMutation.mutateAsync({
        id: task.id,
        status: nextStatus
      });
    } catch (err) {
      console.error("Error toggling status:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm("¿Seguro que querés eliminar esta tarea?")) {
      try {
        await deleteTaskMutation.mutateAsync(taskId);
      } catch (err) {
        console.error("Error deleting task:", err);
      }
    }
  };

  // Date Navigator Helper (horizontal week)
  const getWeekDates = (baseDateStr: string) => {
    const base = new Date(baseDateStr + "T00:00:00");
    const dayOfWeek = base.getDay(); // 0 is Sunday
    // Start week on Monday
    const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayDiff);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const currentWeekDates = getWeekDates(selectedDateStr);

  const navigateWeek = (weeksDiff: number) => {
    const current = new Date(selectedDateStr + "T00:00:00");
    current.setDate(current.getDate() + weeksDiff * 7);
    setSelectedDateStr(current.toISOString().split("T")[0]);
  };

  // Filter Logic
  const filteredTasks = tasks.filter((t) => {
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
    return true;
  });

  // Today, Overdue, and Future categorization for the selected day or overall
  const todayStr = new Date().toISOString().split("T")[0];
  
  const overdueTasks = filteredTasks.filter(
    (t) => t.status !== "completada" && t.due_date < todayStr
  );
  
  const selectedDayTasks = filteredTasks.filter(
    (t) => t.due_date === selectedDateStr
  );

  const futureTasks = filteredTasks.filter(
    (t) => t.due_date > selectedDateStr && t.due_date >= todayStr
  );

  // Render a Category Icon
  const getCategoryBadge = (catValue: string) => {
    const cat = CATEGORIES.find((c) => c.value === catValue) || CATEGORIES[0];
    const IconComponent = cat.icon;
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", cat.bg)}>
        <IconComponent className="h-3 w-3 flex-shrink-0" />
        {cat.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "alta":
        return <span className="bg-rose-500/10 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Alta</span>;
      case "media":
        return <span className="bg-amber-500/10 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Media</span>;
      default:
        return <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Baja</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper header statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-md border border-border p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate2 font-semibold uppercase">Tareas Pendientes</p>
            <p className="text-2xl font-bold text-navy">
              {tasks.filter((t) => t.status !== "completada").length}
            </p>
          </div>
          <Clock className="h-8 w-8 text-amber-500 opacity-60" />
        </div>
        <div className="bg-card rounded-md border border-border p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate2 font-semibold uppercase">Completadas Hoy</p>
            <p className="text-2xl font-bold text-emerald-600">
              {tasks.filter((t) => t.status === "completada" && t.due_date === todayStr).length}
            </p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
        </div>
        <div className="bg-card rounded-md border border-border p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate2 font-semibold uppercase">Vencidas / Demoradas</p>
            <p className="text-2xl font-bold text-rose-600">
              {tasks.filter((t) => t.status !== "completada" && t.due_date < todayStr).length}
            </p>
          </div>
          <AlertCircle className="h-8 w-8 text-rose-500 opacity-60" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN: Date Navigator & Filter Control panel */}
        <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
          {/* Week Date Picker Navigation */}
          <div className="bg-card rounded-md border border-border p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy text-sm flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Navegador de Agenda
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => navigateWeek(-1)}
                  className="p-1 rounded hover:bg-slate-100 text-slate2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateWeek(1)}
                  className="p-1 rounded hover:bg-slate-100 text-slate2"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Horizontal week dates display */}
            <div className="grid grid-cols-7 gap-1">
              {currentWeekDates.map((date) => {
                const dateString = date.toISOString().split("T")[0];
                const isSelected = dateString === selectedDateStr;
                const isToday = dateString === todayStr;
                const weekdayName = date.toLocaleDateString("es-AR", { weekday: "narrow" });
                const dayNum = date.getDate();

                return (
                  <button
                    key={dateString}
                    onClick={() => setSelectedDateStr(dateString)}
                    className={cn(
                      "flex flex-col items-center py-2 px-1 rounded-md transition-all text-xs border",
                      isSelected
                        ? "bg-brand text-white border-brand font-bold"
                        : isToday
                        ? "bg-brand/10 text-brand border-brand/20 font-semibold"
                        : "bg-white border-border text-slate2 hover:bg-slate-50"
                    )}
                  >
                    <span className="uppercase text-[10px] opacity-75">{weekdayName}</span>
                    <span className="text-sm mt-0.5">{dayNum}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
              <span className="text-slate2">Día seleccionado:</span>
              <span className="font-bold text-navy uppercase font-mono">
                {new Date(selectedDateStr + "T00:00:00").toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </span>
            </div>
          </div>

          {/* Sidebar Filter controls card */}
          <div className="bg-card rounded-md border border-border p-4 space-y-4 shadow-sm">
            <h3 className="font-bold text-navy text-sm flex items-center gap-1.5">
              <Filter className="h-4 w-4" />
              Filtros de Tarea
            </h3>

            {/* Status Filter */}
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full text-xs rounded border border-border p-2 bg-white"
              >
                <option value="all">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="completada">Completadas</option>
                <option value="en_progreso">En Progreso</option>
                <option value="cancelada">Canceladas</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full text-xs rounded border border-border p-2 bg-white"
              >
                <option value="all">Todas las categorías</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-1">
              <Label className="text-xs">Prioridad</Label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full text-xs rounded border border-border p-2 bg-white"
              >
                <option value="all">Todas las prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            {/* Assignee Filter */}
            <div className="space-y-1">
              <Label className="text-xs">Asignado a</Label>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="w-full text-xs rounded border border-border p-2 bg-white"
              >
                <option value="all">Cualquiera</option>
                <option value="">Sin asignar / General</option>
                {users.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Task board cards list grouped by status categories */}
        <div className="flex-1 w-full space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-navy">
              Tareas organizadas de la Agencia
            </h2>
            <Button onClick={handleOpenCreateDialog} className="gap-2 text-xs">
              <Plus className="h-4 w-4" />
              Nueva Tarea
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div
                role="status"
                aria-label="Cargando tareas"
                className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group 1: Overdue tasks (Atrasadas) */}
              {overdueTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    Tareas Atrasadas / Demoradas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {overdueTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        properties={properties}
                        contacts={contacts}
                        onToggle={handleToggleStatus}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDeleteTask}
                        getCategoryBadge={getCategoryBadge}
                        getPriorityBadge={getPriorityBadge}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Group 2: Today's Tasks (Día Seleccionado) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  Agenda para el Día Seleccionado
                </h3>
                {selectedDayTasks.length === 0 ? (
                  <div className="p-8 text-center bg-card rounded-md border border-border border-dashed text-slate2 text-sm">
                    No tenés tareas agendadas para este día.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedDayTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        properties={properties}
                        contacts={contacts}
                        onToggle={handleToggleStatus}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDeleteTask}
                        getCategoryBadge={getCategoryBadge}
                        getPriorityBadge={getPriorityBadge}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Group 3: Upcoming Tasks (Próximas) */}
              {futureTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate2 uppercase tracking-wider flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Próximas Tareas Agendadas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {futureTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        properties={properties}
                        contacts={contacts}
                        onToggle={handleToggleStatus}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDeleteTask}
                        getCategoryBadge={getCategoryBadge}
                        getPriorityBadge={getPriorityBadge}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CRUD Creation/Edition Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarea" : "Nueva Tarea de la Agencia"}</DialogTitle>
            <DialogDescription>
              Completá los campos para organizar las actividades y asignaciones de tu equipo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="task-title">Título *</Label>
              <Input
                id="task-title"
                placeholder="Ej. Visita con inquilino Gómez"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="task-desc">Detalles / Comentarios</Label>
              <Input
                id="task-desc"
                placeholder="Notas adicionales..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-1">
                <Label htmlFor="task-cat">Categoría</Label>
                <select
                  id="task-cat"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-xs rounded border border-border p-2 bg-white h-9"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <Label htmlFor="task-prio">Prioridad</Label>
                <select
                  id="task-prio"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full text-xs rounded border border-border p-2 bg-white h-9"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <div className="space-y-1">
                <Label htmlFor="task-date">Fecha límite</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  required
                />
              </div>

              {/* Assigned To */}
              <div className="space-y-1">
                <Label htmlFor="task-assign">Empleado Asignado</Label>
                <select
                  id="task-assign"
                  value={formAssignedTo}
                  onChange={(e) => setFormAssignedTo(e.target.value)}
                  className="w-full text-xs rounded border border-border p-2 bg-white h-9"
                >
                  <option value="">Sin asignar / General</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Associated Property */}
              <div className="space-y-1">
                <Label htmlFor="task-prop">Propiedad vinculada</Label>
                <select
                  id="task-prop"
                  value={formPropertyId}
                  onChange={(e) => setFormPropertyId(e.target.value)}
                  className="w-full text-xs rounded border border-border p-2 bg-white h-9"
                >
                  <option value="">Ninguna</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}
                    </option>
                  ))}
                </select>
              </div>

              {/* Associated Contact */}
              <div className="space-y-1">
                <Label htmlFor="task-contact">Cliente vinculado</Label>
                <select
                  id="task-contact"
                  value={formContactId}
                  onChange={(e) => setFormContactId(e.target.value)}
                  className="w-full text-xs rounded border border-border p-2 bg-white h-9"
                >
                  <option value="">Ninguno</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTask ? "Guardar Cambios" : "Crear Tarea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── TASK CARD COMPONENT ────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskRow;
  properties: any[];
  contacts: any[];
  onToggle: (task: TaskRow) => void;
  onEdit: (task: TaskRow) => void;
  onDelete: (id: string) => void;
  getCategoryBadge: (cat: string) => React.ReactNode;
  getPriorityBadge: (prio: string) => React.ReactNode;
}

function TaskCard({
  task,
  properties,
  contacts,
  onToggle,
  onEdit,
  onDelete,
  getCategoryBadge,
  getPriorityBadge
}: TaskCardProps) {
  const linkedProperty = properties.find((p) => p.id === task.property_id);
  const linkedContact = contacts.find((c) => c.id === task.contact_id);
  const isCompleted = task.status === "completada";

  return (
    <div
      className={cn(
        "p-4 rounded-md border bg-white flex flex-col justify-between gap-3 shadow-sm hover:shadow transition-shadow relative",
        isCompleted ? "opacity-60 border-slate-200" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Checked checkbox controls status */}
        <button
          onClick={() => onToggle(task)}
          type="button"
          className="text-slate2 hover:text-brand flex-shrink-0 mt-0.5"
          aria-label={isCompleted ? "Marcar pendiente" : "Marcar completada"}
        >
          {isCompleted ? (
            <CheckSquare className="h-4.5 w-4.5 text-brand" />
          ) : (
            <Square className="h-4.5 w-4.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-bold text-sm text-navy truncate",
              isCompleted && "line-through text-slate2"
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate2 line-clamp-2 mt-0.5">
              {task.description}
            </p>
          )}
        </div>

        {/* Action controls */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded text-slate2 hover:bg-slate-50 hover:text-brand"
            aria-label="Editar"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded text-slate2 hover:bg-slate-50 hover:text-destructive"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tags and badges block */}
      <div className="flex flex-wrap gap-2 items-center">
        {getCategoryBadge(task.category)}
        {getPriorityBadge(task.priority)}
        {task.assigned_to && (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200">
            <User className="h-2.5 w-2.5" />
            {task.assigned_to}
          </span>
        )}
      </div>

      {/* Linked entities footer info */}
      {(linkedProperty || linkedContact || task.due_date) && (
        <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate2">
          {linkedProperty && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Prop: {linkedProperty.address}</span>
            </div>
          )}
          {linkedContact && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Contacto: {linkedContact.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1 mt-0.5 font-semibold">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>F. Límite: {new Date(task.due_date + "T00:00:00").toLocaleDateString("es-AR")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
