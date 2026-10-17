(() => {
  "use strict";
  const STORAGE_KEY = "organizae.tasks.v1";
  const subjects = [
    "Programação Web",
    "Engenharia de Requisitos",
    "Banco de Dados",
    "Algoritmos",
    "Matemática",
    "Outras",
  ];
  const $ = (selector) => document.querySelector(selector);
  const els = {
    list: $("#task-list"),
    search: $("#search-input"),
    subject: $("#subject-filter"),
    priority: $("#priority-filter"),
    status: $("#status-filter"),
    clear: $("#clear-filters"),
    dialog: $("#task-dialog"),
    confirm: $("#confirm-dialog"),
    form: $("#task-form"),
    title: $("#task-title"),
    subjectInput: $("#task-subject"),
    due: $("#task-due"),
    priorityInput: $("#task-priority"),
    id: $("#task-id"),
    toast: $("#toast-region"),
  };
  let tasks = readTasks();
  let currentView = "overview";
  let pendingDeleteId = null;
  let toastTimer;

  function readTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.subject === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) &&
            ["Alta", "Média", "Baixa"].includes(item.priority),
        )
        .map((item) => ({
          id: item.id,
          title: item.title.slice(0, 100),
          subject: item.subject,
          dueDate: item.dueDate,
          priority: item.priority,
          completed: item.completed === true,
        }));
    } catch (error) {
      console.warn("Não foi possível ler as tarefas salvas.", error);
      return [];
    }
  }
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.warn("Não foi possível salvar as tarefas.", error);
      toast("Não foi possível salvar. Verifique o espaço do navegador.");
      return false;
    }
  }
  function localISODate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function dayDifference(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    const due = Date.UTC(y, m - 1, d);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((due - today) / 86400000);
  }
  function formatDate(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(y, m - 1, d, 12));
  }
  function isOverdue(task) {
    return !task.completed && dayDifference(task.dueDate) < 0;
  }
  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }
  function toast(message) {
    clearTimeout(toastTimer);
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    els.toast.replaceChildren(node);
    toastTimer = setTimeout(() => node.remove(), 3100);
  }
  function updateDate() {
    const now = new Date();
    $("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    const hour = now.getHours();
    $("#greeting").textContent =
      hour < 12
        ? "Bom dia! Vamos organizar seus estudos?"
        : hour < 18
          ? "Boa tarde! Vamos organizar seus estudos?"
          : "Boa noite! Vamos organizar seus estudos?";
  }
  function updateStats() {
    const completed = tasks.filter((task) => task.completed).length;
    const pending = tasks.length - completed;
    $("#stat-total").textContent = tasks.length;
    $("#stat-pending").textContent = pending;
    $("#stat-completed").textContent = completed;
    $("#stat-overdue").textContent = tasks.filter(isOverdue).length;
    $("#nav-pending").textContent = pending;
    $("#nav-completed").textContent = completed;
  }
  function updateSubjectOptions() {
    const selected = els.subject.value;
    const used = [...new Set(tasks.map((task) => task.subject))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    els.subject.innerHTML =
      '<option value="">Todas as matérias</option>' +
      used
        .map(
          (name) =>
            `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`,
        )
        .join("");
    if (used.includes(selected)) els.subject.value = selected;
  }
  function visibleTasks() {
    const query = els.search.value.trim().toLocaleLowerCase("pt-BR");
    return tasks
      .filter((task) => {
        const status = task.completed
          ? "completed"
          : isOverdue(task)
            ? "overdue"
            : "pending";
        if (currentView === "completed" && !task.completed) return false;
        if (currentView === "tasks" && task.completed) return false;
        if (
          query &&
          !`${task.title} ${task.subject}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)
        )
          return false;
        if (els.subject.value && task.subject !== els.subject.value)
          return false;
        if (els.priority.value && task.priority !== els.priority.value)
          return false;
        if (els.status.value && status !== els.status.value) return false;
        return true;
      })
      .sort(
        (a, b) =>
          a.completed - b.completed ||
          a.dueDate.localeCompare(b.dueDate) ||
          a.title.localeCompare(b.title, "pt-BR"),
      );
  }
  function taskMarkup(task) {
    const diff = dayDifference(task.dueDate);
    let statusLabel = "Pendente",
      statusClass = "status-pending",
      dueClass = "";
    if (task.completed) {
      statusLabel = "Concluída";
      statusClass = "status-completed";
    } else if (diff < 0) {
      statusLabel = "Atrasada";
      statusClass = "status-overdue";
      dueClass = "overdue";
    } else if (diff === 0) dueClass = "today";
    const dueLabel = task.completed
      ? formatDate(task.dueDate)
      : diff < 0
        ? `Venceu ${formatDate(task.dueDate)}`
        : diff === 0
          ? "Vence hoje"
          : diff === 1
            ? "Vence amanhã"
            : formatDate(task.dueDate);
    const priorityClass =
      task.priority === "Alta"
        ? "priority-high"
        : task.priority === "Baixa"
          ? "priority-low"
          : "priority-medium";
    return `<article class="task-card ${task.completed ? "is-complete" : ""}" data-task-id="${escapeHTML(task.id)}">
      <input class="complete-toggle" type="checkbox" ${task.completed ? "checked" : ""} aria-label="${task.completed ? "Reabrir" : "Concluir"} tarefa: ${escapeHTML(task.title)}">
      <div class="task-info"><h3 class="task-title">${escapeHTML(task.title)}</h3><div class="task-meta"><span class="task-subject">${escapeHTML(task.subject)}</span><span class="task-due ${dueClass}">${escapeHTML(dueLabel)}</span></div></div>
      <div class="task-badges"><span class="badge ${priorityClass}">${escapeHTML(task.priority)}</span><span class="badge ${statusClass}">${statusLabel}</span></div>
      <div class="task-actions"><button class="icon-button edit-task" aria-label="Editar tarefa: ${escapeHTML(task.title)}" title="Editar">✎</button><button class="icon-button delete delete-task" aria-label="Excluir tarefa: ${escapeHTML(task.title)}" title="Excluir">×</button></div>
    </article>`;
  }
  function renderEmpty() {
    const noTasks =
      tasks.length === 0 && currentView === "overview" && !hasFilters();
    const completedEmpty =
      currentView === "completed" &&
      !tasks.some((task) => task.completed) &&
      !hasFilters();
    if (noTasks)
      return `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">☷</div><h3>Tudo começa com uma tarefa</h3><p>Adicione suas atividades e acompanhe seus prazos em um só lugar.</p><button class="button button-primary" data-action="create">Criar primeira tarefa</button></div>`;
    if (completedEmpty)
      return `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">✓</div><h3>Nenhuma tarefa concluída por enquanto</h3><p>Suas atividades concluídas aparecerão aqui.</p></div>`;
    return `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">⌕</div><h3>Nenhuma tarefa encontrada</h3><p>Tente mudar a pesquisa ou os filtros para encontrar o que procura.</p></div>`;
  }
  function hasFilters() {
    return Boolean(
      els.search.value.trim() ||
      els.subject.value ||
      els.priority.value ||
      els.status.value,
    );
  }
  function render() {
    updateStats();
    updateSubjectOptions();
    const shown = visibleTasks();
    els.list.innerHTML = shown.length
      ? shown.map(taskMarkup).join("")
      : renderEmpty();
    $("#visible-count").textContent =
      `${shown.length} ${shown.length === 1 ? "tarefa" : "tarefas"}`;
    els.clear.hidden = !hasFilters();
    const headings = {
      overview: [
        "ACOMPANHE SEU RITMO",
        "Suas tarefas",
        "Tudo o que você precisa fazer, em um só lugar.",
      ],
      tasks: [
        "NO SEU TEMPO",
        "Minhas tarefas",
        "Atividades que ainda estão no seu planejamento.",
      ],
      completed: [
        "OLHA SÓ O QUE VOCÊ JÁ FEZ",
        "Concluídas",
        "Cada atividade finalizada é um passo adiante.",
      ],
    };
    const [kicker, title, subtitle] = headings[currentView];
    $("#section-kicker").textContent = kicker;
    $("#list-heading").textContent = title;
    $("#list-subtitle").textContent = subtitle;
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.view === currentView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }
  function openForm(task = null) {
    clearErrors();
    els.form.reset();
    els.id.value = task?.id || "";
    $("#dialog-title").textContent = task ? "Editar tarefa" : "Nova tarefa";
    $("#save-task").textContent = task ? "Salvar alterações" : "Salvar tarefa";
    if (task) {
      els.title.value = task.title;
      els.subjectInput.value = subjects.includes(task.subject)
        ? task.subject
        : "Outras";
      els.due.value = task.dueDate;
      els.priorityInput.value = task.priority;
    }
    els.dialog.showModal();
    requestAnimationFrame(() => els.title.focus());
  }
  function closeForm() {
    if (els.dialog.open) els.dialog.close();
  }
  function clearErrors() {
    $("#title-error").textContent = "";
    $("#due-error").textContent = "";
    els.title.removeAttribute("aria-invalid");
    els.due.removeAttribute("aria-invalid");
  }
  function validateForm() {
    clearErrors();
    let valid = true;
    if (!els.title.value.trim()) {
      $("#title-error").textContent = "Informe um título para a tarefa.";
      els.title.setAttribute("aria-invalid", "true");
      valid = false;
    } else if (els.title.value.trim().length > 100) {
      $("#title-error").textContent = "Use no máximo 100 caracteres.";
      els.title.setAttribute("aria-invalid", "true");
      valid = false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(els.due.value)) {
      $("#due-error").textContent = "Escolha uma data válida para o prazo.";
      els.due.setAttribute("aria-invalid", "true");
      valid = false;
    } else {
      const [y, m, d] = els.due.value.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (
        date.getFullYear() !== y ||
        date.getMonth() !== m - 1 ||
        date.getDate() !== d
      ) {
        $("#due-error").textContent = "Escolha uma data válida.";
        els.due.setAttribute("aria-invalid", "true");
        valid = false;
      }
    }
    if (!valid) toast("Revise os campos destacados.");
    return valid;
  }
  function submitTask(event) {
    event.preventDefault();
    if (!validateForm()) return;
    const existing = tasks.find((task) => task.id === els.id.value);
    const task = {
      id:
        existing?.id ||
        (crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      title: els.title.value.trim(),
      subject: els.subjectInput.value,
      dueDate: els.due.value,
      priority: els.priorityInput.value,
      completed: existing?.completed || false,
    };
    if (existing)
      tasks = tasks.map((item) => (item.id === existing.id ? task : item));
    else tasks.push(task);
    if (saveTasks()) {
      closeForm();
      render();
      toast(existing ? "Alterações salvas." : "Tarefa criada.");
    }
  }
  function setComplete(id, completed) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    task.completed = completed;
    saveTasks();
    render();
    toast(completed ? "Tarefa concluída." : "Tarefa reaberta.");
  }
  function openDelete(id) {
    pendingDeleteId = id;
    els.confirm.showModal();
    $("#keep-task").focus();
  }
  function deleteTask() {
    if (!pendingDeleteId) return;
    tasks = tasks.filter((task) => task.id !== pendingDeleteId);
    pendingDeleteId = null;
    if (saveTasks()) {
      els.confirm.close();
      render();
      toast("Tarefa excluída.");
    }
  }
  $("#new-task").addEventListener("click", () => openForm());
  $("#close-dialog").addEventListener("click", closeForm);
  $("#cancel-dialog").addEventListener("click", closeForm);
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeForm();
  });
  els.confirm.addEventListener("click", (event) => {
    if (event.target === els.confirm) {
      els.confirm.close();
      pendingDeleteId = null;
    }
  });
  $("#keep-task").addEventListener("click", () => {
    pendingDeleteId = null;
    els.confirm.close();
  });
  $("#confirm-delete").addEventListener("click", deleteTask);
  els.form.addEventListener("submit", submitTask);
  [els.search, els.subject, els.priority, els.status].forEach((control) =>
    control.addEventListener(
      control === els.search ? "input" : "change",
      render,
    ),
  );
  els.clear.addEventListener("click", () => {
    els.search.value = "";
    els.subject.value = "";
    els.priority.value = "";
    els.status.value = "";
    render();
  });
  document.querySelectorAll(".nav-item").forEach((button) =>
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      render();
    }),
  );
  els.list.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="create"]')) {
      openForm();
      return;
    }
    const card = event.target.closest("[data-task-id]");
    if (!card) return;
    const id = card.dataset.taskId;
    if (event.target.closest(".edit-task"))
      openForm(tasks.find((task) => task.id === id));
    if (event.target.closest(".delete-task")) openDelete(id);
  });
  els.list.addEventListener("change", (event) => {
    if (event.target.matches(".complete-toggle")) {
      const id = event.target.closest("[data-task-id]").dataset.taskId;
      setComplete(id, event.target.checked);
    }
  });
  updateDate();
  render();
})();
