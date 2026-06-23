(function () {
  "use strict";

  const errorLogs = [];

  window.addEventListener("error", (event) => {
    const errorMsg = event.message || "Error desconocido";
    const source = event.filename ? event.filename.split("/").pop() : "desconocido";
    const line = event.lineno || "?";
    const col = event.colno || "?";
    const stack = event.error && event.error.stack ? event.error.stack : "";
    
    errorLogs.push({
      time: new Date().toLocaleTimeString(),
      message: errorMsg,
      file: `${source}:${line}:${col}`,
      stack: stack
    });
    
    renderErrorConsole();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error && reason.stack ? reason.stack : "";
    
    errorLogs.push({
      time: new Date().toLocaleTimeString(),
      message: `Promesa rechazada: ${errorMsg}`,
      file: "async",
      stack: stack
    });
    
    renderErrorConsole();
  });

  const STORAGE_KEY = "clara.state.v1";
  const BACKWARD_STORAGE_KEY = "linksplit.state.v1";
  const CACHE_NAME = "clara-cache-v32";
  const MAX_HASH_LENGTH = 180000;
  const MAX_BACKUP_BYTES = 350000;
  const MAX_PEOPLE = 80;
  const MAX_EXPENSES = 500;
  const MAX_TABLE_CLOSE_RECORDS = 600;
  const UNCOMPRESSED_PREFIX = "u1";
  const COMPRESSED_PREFIX = "c1";
  const EASY_PREFIX = "easy1";
  const PRIVATE_PREFIX = "priv1";
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const emptyState = () => ({
    version: 1,
    groupName: "",
    currency: "MXN",
    people: [],
    expenses: [],
    tableClose: {},
    updatedAt: Date.now()
  });

  let state = emptyState();
  let pendingPrivatePayload = "";
  let ticketItems = []; // Array of { name, price, splitWith: [id, ...] }

  const els = {
    resetBtn: document.getElementById("resetBtn"),
    supportBtn: document.getElementById("supportBtn"),
    groupNameInput: document.getElementById("groupNameInput"),
    currencyInput: document.getElementById("currencyInput"),
    personForm: document.getElementById("personForm"),
    personNameInput: document.getElementById("personNameInput"),
    peopleList: document.getElementById("peopleList"),
    guestPanel: document.getElementById("guestPanel"),
    peopleCount: document.getElementById("peopleCount"),
    expenseForm: document.getElementById("expenseForm"),
    expenseDescriptionInput: document.getElementById("expenseDescriptionInput"),
    expenseAmountInput: document.getElementById("expenseAmountInput"),
    expensePaidByInput: document.getElementById("expensePaidByInput"),
    splitWithList: document.getElementById("splitWithList"),
    selectAllSplitBtn: document.getElementById("selectAllSplitBtn"),
    expenseList: document.getElementById("expenseList"),
    expenseCount: document.getElementById("expenseCount"),
    balanceList: document.getElementById("balanceList"),
    settlementList: document.getElementById("settlementList"),
    tableClosePanel: document.getElementById("tableClosePanel"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    copyMessageBtn: document.getElementById("copyMessageBtn"),
    shareLinkOutput: document.getElementById("shareLinkOutput"),
    privateKeyField: document.getElementById("privateKeyField"),
    privateKeyOutput: document.getElementById("privateKeyOutput"),
    copyPrivateKeyBtn: document.getElementById("copyPrivateKeyBtn"),
    privacyNote: document.getElementById("privacyNote"),
    peopleCount: document.getElementById("peopleCount"),
    expenseForm: document.getElementById("expenseForm"),
    expenseDescriptionInput: document.getElementById("expenseDescriptionInput"),
    expenseAmountInput: document.getElementById("expenseAmountInput"),
    expensePaidByInput: document.getElementById("expensePaidByInput"),
    splitWithList: document.getElementById("splitWithList"),
    selectAllSplitBtn: document.getElementById("selectAllSplitBtn"),
    expenseList: document.getElementById("expenseList"),
    expenseCount: document.getElementById("expenseCount"),
    balanceList: document.getElementById("balanceList"),
    settlementList: document.getElementById("settlementList"),
    tableClosePanel: document.getElementById("tableClosePanel"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    copyMessageBtn: document.getElementById("copyMessageBtn"),
    shareLinkOutput: document.getElementById("shareLinkOutput"),
    privateKeyField: document.getElementById("privateKeyField"),
    privateKeyOutput: document.getElementById("privateKeyOutput"),
    copyPrivateKeyBtn: document.getElementById("copyPrivateKeyBtn"),
    privacyNote: document.getElementById("privacyNote"),
    statusLine: document.getElementById("statusLine"),
    privateKeyDialog: document.getElementById("privateKeyDialog"),
    privateKeyForm: document.getElementById("privateKeyForm"),
    privateKeyInput: document.getElementById("privateKeyInput"),
    cancelPrivateKeyBtn: document.getElementById("cancelPrivateKeyBtn"),
    
    // Restaurant Mode elements
    openRestaurantBtn: document.getElementById("openRestaurantBtn"),
    restaurantDialog: document.getElementById("restaurantDialog"),
    closeRestaurantBtn: document.getElementById("closeRestaurantBtn"),
    ticketRawInput: document.getElementById("ticketRawInput"),
    parseTicketBtn: document.getElementById("parseTicketBtn"),
    cancelRestaurantBtn: document.getElementById("cancelRestaurantBtn"),
    ticketItemsBody: document.getElementById("ticketItemsBody"),
    addTicketItemBtn: document.getElementById("addTicketItemBtn"),
    ticketTipPercent: document.getElementById("ticketTipPercent"),
    ticketTaxFixed: document.getElementById("ticketTaxFixed"),
    ticketPaidBySelect: document.getElementById("ticketPaidBySelect"),
    ticketNameInput: document.getElementById("ticketNameInput"),
    ticketSubtotalLabel: document.getElementById("ticketSubtotalLabel"),
    ticketTotalLabel: document.getElementById("ticketTotalLabel"),
    saveRestaurantBtn: document.getElementById("saveRestaurantBtn"),
    
    reminderDialog: document.getElementById("reminderDialog"),
    closeReminderBtn: document.getElementById("closeReminderBtn"),
    reminderPersonIdInput: document.getElementById("reminderPersonIdInput"),
    reminderTextInput: document.getElementById("reminderTextInput"),
    cancelReminderBtn: document.getElementById("cancelReminderBtn"),
    reminderForm: document.getElementById("reminderForm"),
    reminderPersonName: document.getElementById("reminderPersonName"),
    
    // Support Tab elements
    copyStateJsonBtn: document.getElementById("copyStateJsonBtn"),
    forceReloadBtn: document.getElementById("forceReloadBtn"),
    errorConsoleBox: document.getElementById("errorConsoleBox"),
    copyErrorLogBtn: document.getElementById("copyErrorLogBtn"),
    exportBackupBtn: document.getElementById("exportBackupBtn"),
    importBackupBtn: document.getElementById("importBackupBtn"),
    importBackupFile: document.getElementById("importBackupFile")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("clara.swReloaded") === CACHE_NAME) return;
        sessionStorage.setItem("clara.swReloaded", CACHE_NAME);
        window.location.reload();
      });
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker registration failed", err);
      });
    }

    // Detectar si se fuerza el modo celular mediante el query param 'mode' o 'view'
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("mode") === "mobile" || urlParams.get("view") === "mobile") {
      document.body.classList.add("force-mobile");
    }

    loadLocalState();
    bindEvents();
    render();
    await restoreFromHash();

    // Auto-collapse group config details if there is already a group name set
    if (state.groupName) {
      const details = document.getElementById("groupConfigDetails");
      if (details) details.removeAttribute("open");
    }
  }

  function bindEvents() {
    els.groupNameInput.addEventListener("input", () => {
      state.groupName = sanitizeText(els.groupNameInput.value, 80);
      saveAndRender(false);
    });

    els.currencyInput.addEventListener("change", () => {
      state.currency = sanitizeCurrency(els.currencyInput.value);
      saveAndRender();
    });

    els.personForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = sanitizeText(els.personNameInput.value, 40);
      if (!name) return setStatus("Escribe un nombre.");

      const duplicate = state.people.some((p) => p.name.toLowerCase() === name.toLowerCase());
      if (duplicate) return setStatus("Ya existe un participante con ese nombre.");

      state.people.push({ id: createId("p"), name, reminder: "", isGuest: false });
      els.personNameInput.value = "";
      saveAndRender();
    });

    els.expenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addExpense();
    });

    els.selectAllSplitBtn.addEventListener("click", () => {
      document.querySelectorAll("[data-split-id]").forEach((input) => {
        input.checked = true;
      });
    });

    els.resetBtn.addEventListener("click", () => {
      if (!confirm("Esto borra el grupo local de este navegador. Continuar?")) return;
      state = emptyState();
      localStorage.removeItem(STORAGE_KEY);
      history.replaceState(null, "", location.pathname + location.search);
      setStatus("Grupo local limpiado.");
      render();
    });

    document.querySelectorAll("input[name='shareMode']").forEach((input) => {
      input.addEventListener("change", () => {
        els.shareLinkOutput.value = "";
        els.privateKeyOutput.value = "";
        renderShareMode();
      });
    });

    els.copyLinkBtn.addEventListener("click", async () => {
      await generateAndCopyShare(false);
    });

    els.copyMessageBtn.addEventListener("click", async () => {
      await generateAndCopyShare(true);
    });

    els.copyPrivateKeyBtn.addEventListener("click", async () => {
      if (!els.privateKeyOutput.value) return setStatus("Genera un link privado primero.");
      await copyText(els.privateKeyOutput.value);
      setStatus("Clave copiada. Mandala por otro canal si quieres privacidad real.");
    });

    els.privateKeyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const key = els.privateKeyInput.value.trim();
      if (!key) return;
      await openPrivateLink(key);
    });

    // Restaurant Mode
    els.openRestaurantBtn.addEventListener("click", openRestaurantWizard);
    els.closeRestaurantBtn.addEventListener("click", () => els.restaurantDialog.close());
    if (els.cancelRestaurantBtn) {
      els.cancelRestaurantBtn.addEventListener("click", () => els.restaurantDialog.close());
    }
    // Prevent form submission on Enter inside the restaurant dialog (it closes the dialog)
    const restaurantFormEl = document.getElementById("restaurantForm");
    if (restaurantFormEl) {
      restaurantFormEl.addEventListener("submit", (e) => e.preventDefault());
    }
    if (els.parseTicketBtn) {
      els.parseTicketBtn.addEventListener("click", handleParseTicket);
    }
    els.addTicketItemBtn.addEventListener("click", addEmptyTicketItem);
    document.querySelectorAll("input[name='ticketTipPercent']").forEach((input) => {
      input.addEventListener("change", updateTicketTotals);
    });
    els.ticketTaxFixed.addEventListener("input", updateTicketTotals);
    els.saveRestaurantBtn.addEventListener("click", saveRestaurantTicket);

    els.closeReminderBtn.addEventListener("click", () => els.reminderDialog.close());
    els.cancelReminderBtn.addEventListener("click", () => els.reminderDialog.close());
    els.reminderForm.addEventListener("submit", saveReminder);

    els.cancelPrivateKeyBtn.addEventListener("click", () => {
      pendingPrivatePayload = "";
      els.privateKeyDialog.close();
      history.replaceState(null, "", location.pathname + location.search);
    });

    // Tab switching event listeners
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        
        // Auto-add typed name if leaving tab-group and people list is empty
        if (targetTab !== "tab-group" && state.people.length === 0) {
          const typedName = els.personNameInput ? sanitizeText(els.personNameInput.value, 40) : "";
          if (typedName) {
            const duplicate = state.people.some((p) => p.name.toLowerCase() === typedName.toLowerCase());
            if (!duplicate) {
              state.people.push({ id: createId("p"), name: typedName, reminder: "", isGuest: false });
              if (els.personNameInput) els.personNameInput.value = "";
              saveAndRender();
              setStatus(`Se agrego a "${typedName}" automaticamente.`);
            }
          }
        }
        
        // Block switching to Gastos/Liquidacion if there are 0 participants
        if ((targetTab === "tab-expenses" || targetTab === "tab-settlements") && state.people.length === 0) {
          setStatus("Agrega al menos un participante en Grupo para continuar.");
          if (els.personNameInput) {
            els.personNameInput.focus();
          }
          // Restore active state to tab-group button
          document.querySelectorAll(".nav-item").forEach((b) => {
            b.classList.toggle("active", b.dataset.tab === "tab-group");
          });
          document.querySelectorAll(".tab-content").forEach((tc) => {
            tc.classList.toggle("hidden", tc.id !== "tab-group");
          });
          return;
        }

        document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".tab-content").forEach((tc) => {
          tc.classList.toggle("hidden", tc.id !== targetTab);
        });
      });
    });

    if (els.supportBtn) {
      els.supportBtn.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((tc) => {
          tc.classList.toggle("hidden", tc.id !== "tab-support");
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Flow buttons event listeners ("Siguiente")
    document.querySelectorAll(".next-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextTabId = btn.dataset.nextTab;
        const targetNavBtn = document.querySelector(`.nav-item[data-tab="${nextTabId}"]`);
        if (targetNavBtn) {
          targetNavBtn.click();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    els.copyStateJsonBtn.addEventListener("click", async () => {
      try {
        const json = JSON.stringify(state, null, 2);
        await copyText(json);
        setStatus("Estado JSON copiado al portapapeles.");
      } catch (err) {
        setStatus("No se pudo copiar el estado JSON.");
      }
    });

    els.forceReloadBtn.addEventListener("click", async () => {
      if (!confirm("Esto forzara la actualizacion del cache de la aplicacion. Tus datos locales no se borraran. Continuar?")) return;
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } finally {
        window.location.reload();
      }
    });

    els.copyErrorLogBtn.addEventListener("click", async () => {
      try {
        const logText = errorLogs
          .map((log) => `[${log.time}] (${log.file}) ${log.message}\nStack: ${log.stack || "N/A"}`)
          .join("\n\n");
        const info = `Claramente Error Report\nCache: ${CACHE_NAME}\nUA: ${navigator.userAgent}\nURL: ${window.location.href}\n\n${logText}`;
        await copyText(info);
        setStatus("Log de errores copiado al portapapeles.");
      } catch (err) {
        setStatus("No se pudo copiar el log de errores.");
      }
    });

    if (els.exportBackupBtn) {
      els.exportBackupBtn.addEventListener("click", exportBackup);
    }
    if (els.importBackupBtn) {
      els.importBackupBtn.addEventListener("click", () => {
        if (els.importBackupFile) els.importBackupFile.click();
      });
    }
    if (els.importBackupFile) {
      els.importBackupFile.addEventListener("change", handleImportBackupFile);
    }
  }

  function loadLocalState() {
    try {
      let saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        saved = localStorage.getItem(BACKWARD_STORAGE_KEY);
      }
      if (!saved) return;
      const parsed = JSON.parse(saved);
      state = normalizeState(parsed);
    } catch {
      state = emptyState();
      setStatus("No pude leer el guardado local anterior.");
    }
  }

  async function restoreFromHash() {
    const rawHash = location.hash.slice(1);
    if (!rawHash) return;
    if (rawHash.length > MAX_HASH_LENGTH) {
      history.replaceState(null, "", location.pathname + location.search);
      setStatus("El link es demasiado grande para abrirlo con seguridad.");
      return;
    }

    try {
      const imported = await decodeHash(rawHash);
      if (!imported) return;
      if (hasMeaningfulLocalState() && !confirm("El link trae otro grupo. Reemplazar el grupo local?")) {
        history.replaceState(null, "", location.pathname + location.search);
        return;
      }
      state = normalizeState(imported);
      saveAndRender(false);
      history.replaceState(null, "", location.pathname + location.search);
      setStatus("Grupo restaurado desde el link.");
    } catch (error) {
      if (error && error.message === "PRIVATE_KEY_REQUIRED") {
        pendingPrivatePayload = rawHash;
        els.privateKeyDialog.showModal();
        return;
      }
      history.replaceState(null, "", location.pathname + location.search);
      setStatus("No pude abrir este link. Revisa que este completo.");
    }
  }

  async function openPrivateLink(key) {
    try {
      const imported = await decodeHash(pendingPrivatePayload, key);
      state = normalizeState(imported);
      saveAndRender(false);
      pendingPrivatePayload = "";
      els.privateKeyInput.value = "";
      els.privateKeyDialog.close();
      history.replaceState(null, "", location.pathname + location.search);
      setStatus("Grupo privado abierto.");
    } catch {
      setStatus("Clave incorrecta o link privado danado.");
    }
  }

  function sanitizeText(value, maxLength) {
    return String(value ?? "")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function sanitizeCurrency(value) {
    const next = sanitizeText(value || "MXN", 8).toUpperCase();
    return /^[A-Z]{3,8}$/.test(next) ? next : "MXN";
  }

  function sanitizeId(value, prefix) {
    const clean = String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 18);
    return clean || createId(prefix || "id");
  }

  function isReasonableObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function normalizeState(candidate) {
    const next = emptyState();
    if (!isReasonableObject(candidate)) return next;
    next.version = Number(candidate.version) || 1;
    next.groupName = sanitizeText(candidate.groupName, 80);
    next.currency = sanitizeCurrency(candidate.currency);
    next.people = Array.isArray(candidate.people)
      ? candidate.people.slice(0, MAX_PEOPLE).map((person) => {
          if (!isReasonableObject(person)) return null;
          const legacyReminder = [
            person.paypal ? `PayPal: ${person.paypal}` : "",
            person.venmo ? `Venmo: ${person.venmo}` : "",
            person.bizum ? `Bizum: ${person.bizum}` : ""
          ].filter(Boolean).join(" | ");
          return {
            id: sanitizeId(person.id || createId("p"), "p"),
            name: sanitizeText(person.name || "Persona", 40) || "Persona",
            reminder: sanitizeText(person.reminder || legacyReminder || "", 160),
            isGuest: Boolean(person.isGuest)
          };
        }).filter(Boolean)
      : [];
    const peopleIds = new Set(next.people.map((person) => person.id));
    next.expenses = Array.isArray(candidate.expenses)
      ? candidate.expenses
          .slice(0, MAX_EXPENSES)
          .filter(isReasonableObject)
          .map((expense) => ({
            id: sanitizeId(expense.id || createId("e"), "e"),
            description: sanitizeText(expense.description || "Gasto", 80) || "Gasto",
            amountCents: normalizeExpenseAmount(expense),
            paidBy: sanitizeId(expense.paidBy || "", "p"),
            splitWith: Array.isArray(expense.splitWith)
              ? expense.splitWith.map((id) => sanitizeId(id, "p")).filter((id) => peopleIds.has(id))
              : [],
            createdAt: Number(expense.createdAt) || Date.now(),
            source: sanitizeText(expense.source || "", 24),
            restaurantId: sanitizeId(expense.restaurantId || "", "r"),
            restaurantPaidBy: expense.restaurantPaidBy ? sanitizeId(expense.restaurantPaidBy, "p") : "",
            payerShareCents: Math.max(0, toCents(expense.payerShareCents || 0)),
            restaurantName: sanitizeText(expense.restaurantName || "", 80)
          }))
          .filter((expense) => expense.amountCents > 0 && peopleIds.has(expense.paidBy) && expense.splitWith.length > 0)
      : [];
    next.tableClose = normalizeTableClose(candidate.tableClose, next.expenses, peopleIds);
    next.updatedAt = Number(candidate.updatedAt) || Date.now();
    return next;
  }

  function normalizeTableClose(candidate, expenses, peopleIds) {
    const next = {};
    if (!isReasonableObject(candidate)) return next;
    Object.entries(candidate).slice(0, MAX_TABLE_CLOSE_RECORDS).forEach(([key, record]) => {
      if (!isReasonableObject(record)) return;
      const parts = String(key).split(":");
      if (parts.length !== 3) return;
      if (parts[0] === "restaurant-payer") {
        if (!peopleIds.has(parts[2])) return;
      } else if (!peopleIds.has(parts[1]) || !peopleIds.has(parts[2])) {
        return;
      }
      next[key] = {
        paidCents: Math.max(0, toCents(record.paidCents || 0)),
        isGuest: Boolean(record.isGuest)
      };
    });
    return next;
  }

  function saveAndRender(shouldRender = true) {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (shouldRender) render();
    renderShareMode();
  }

  function render() {
    els.groupNameInput.value = state.groupName;
    els.currencyInput.value = state.currency;
    els.peopleCount.textContent = state.people.length;
    els.expenseCount.textContent = state.expenses.length;
    renderPeople();
    renderExpenseForm();
    renderExpenses();
    renderBalances();
    renderTableClose();
    renderShareMode();
    renderErrorConsole();
  }

  function renderPeople() {
    if (!state.people.length) {
      els.peopleList.innerHTML = `<li class="empty">Agrega los nombres de quienes estan en la mesa.</li>`;
      renderGuestPanel();
      return;
    }
    els.peopleList.innerHTML = state.people
      .map((person) => {
        const used = isPersonUsed(person.id);
        return `
          <li class="list-item">
            <div class="person-info">
              <div class="person-name-container">
                <input class="inline-name-input" type="text" value="${escapeHtml(person.name)}" data-person-name="${person.id}" aria-label="Editar nombre de ${escapeHtml(person.name)}">
              </div>
            </div>
            <button class="danger-button" type="button" data-remove-person="${person.id}" ${used ? "disabled" : ""}>Quitar</button>
          </li>
        `;
      })
      .join("");
    document.querySelectorAll("[data-remove-person]").forEach((button) => {
      button.addEventListener("click", () => removePerson(button.dataset.removePerson));
    });
    document.querySelectorAll("[data-person-name]").forEach((input) => {
      input.addEventListener("change", () => updatePersonName(input.dataset.personName, input.value));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
        if (event.key === "Escape") {
          const person = state.people.find((p) => p.id === input.dataset.personName);
          if (person) input.value = person.name;
          input.blur();
        }
      });
    });
    renderGuestPanel();
  }

  function renderGuestPanel() {
    if (!els.guestPanel) return;
    if (!state.people.length) {
      els.guestPanel.classList.add("hidden");
      els.guestPanel.innerHTML = "";
      return;
    }
    els.guestPanel.classList.remove("hidden");
    els.guestPanel.innerHTML = `
      <div class="guest-panel-header">
        <h3>Alguien es cumpleanero o invitado?</h3>
        <p>Si no va a pagar, marcalo para dividir su parte entre los demas.</p>
      </div>
      <div class="chips guest-chips">
        ${state.people
          .map((person) => {
            const active = person.isGuest ? "active" : "";
            return `<button class="guest-badge ${active}" type="button" data-guest-person="${person.id}">${escapeHtml(person.name)}</button>`;
          })
          .join("")}
      </div>
    `;
    document.querySelectorAll("[data-guest-person]").forEach((button) => {
      button.addEventListener("click", () => togglePersonGuest(button.dataset.guestPerson));
    });
  }

  function renderExpenseForm() {
    const hasPeople = state.people.length > 0;
    const warningEl = document.getElementById("restaurantWarning");
    if (warningEl) {
      warningEl.classList.toggle("hidden", hasPeople);
    }
    if (els.openRestaurantBtn) {
      els.openRestaurantBtn.classList.toggle("disabled-looking", !hasPeople);
    }

    els.expensePaidByInput.innerHTML = state.people.length
      ? state.people.map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("")
      : `<option value="">Agrega participantes</option>`;
    els.expensePaidByInput.disabled = !state.people.length;
    els.expenseForm.querySelector("button[type='submit']").disabled = !state.people.length;
    els.splitWithList.innerHTML = state.people.length
      ? state.people
          .map(
            (person) => `
              <label class="chip">
                <input type="checkbox" data-split-id="${person.id}" checked>
                ${escapeHtml(person.name)}
              </label>
            `
          )
          .join("")
      : `<div class="empty">Agrega participantes para dividir gastos.</div>`;
  }

  // Restaurant Mode Logic
  function openRestaurantWizard() {
    if (!state.people.length) {
      alert("Para dividir por platillo, primero agrega al menos un participante en Grupo.");
      const groupTabBtn = document.querySelector('.nav-item[data-tab="tab-group"]');
      if (groupTabBtn) {
        groupTabBtn.click();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          if (els.personNameInput) els.personNameInput.focus();
        }, 300);
      }
      return;
    }
    
    // Pre-populate paid by select, default to "Nadie" for pay-at-the-moment scenarios
    els.ticketPaidBySelect.innerHTML = `<option value="" selected>Nadie (pago al momento)</option>` +
      state.people
        .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
        .join("");
    
    
    // Initialize list with a single blank item
    ticketItems = [];
    addEmptyTicketItem();
    els.restaurantDialog.showModal();
  }

  function handleParseTicket() {
    if (!els.ticketRawInput) return;
    const text = els.ticketRawInput.value.trim();
    if (!text) return alert("Pega algun texto primero.");
    const parsed = parseTicketText(text);
    if (!parsed.length) {
      alert("No encontramos precios claros en el texto. Puedes agregarlos a mano en la tabla.");
      return;
    }
    
    const newItems = parsed.map((item) => ({
      name: item.name,
      price: item.price,
      splitWith: state.people.map((p) => p.id) // Default split with all
    }));
    
    // If we only have one empty item, replace it
    if (ticketItems.length === 1 && !ticketItems[0].name && ticketItems[0].price === 0) {
      ticketItems = newItems;
    } else {
      ticketItems = ticketItems.concat(newItems);
    }
    
    renderTicketItems();
    updateTicketTotals();
    
    setStatus("Texto procesado y agregado a la tabla.");
  }

  function addEmptyTicketItem(focusField = "name") {
    ticketItems.push({
      name: "",
      price: 0,
      splitWith: state.people.map((p) => p.id)
    });
    renderTicketItems();
    updateTicketTotals();
    focusTicketItemField(ticketItems.length - 1, focusField);
  }

  function focusTicketItemField(index, field = "name") {
    window.setTimeout(() => {
      const row = els.ticketItemsBody.querySelector(`tr[data-item-index="${index}"]`);
      const input = row?.querySelector(field === "price" ? ".ticket-item-price" : ".ticket-item-name");
      if (!input) return;
      input.focus();
      input.select?.();
    }, 0);
  }

  function renderTicketItems() {
    if (!ticketItems.length) {
      els.ticketItemsBody.innerHTML = `<tr><td colspan="4" class="empty">Agrega productos manualmente para dividir la cuenta.</td></tr>`;
      return;
    }

    els.ticketItemsBody.innerHTML = ticketItems
      .map((item, index) => {
        const itemPrice = item.price > 0 ? item.price.toFixed(2) : "";
        return `
          <tr data-item-index="${index}">
            <td class="ticket-product-cell">
              <input type="text" class="ticket-item-name" value="${escapeHtml(item.name)}" placeholder="Producto ${index + 1}">
            </td>
            <td class="ticket-price-cell">
              <input type="number" min="0" step="0.01" class="ticket-item-price" value="${itemPrice}" placeholder="0.00">
            </td>
            <td class="ticket-consumer-cell">
              <div class="item-bubbles">
                ${state.people
                  .map((person) => {
                    const active = item.splitWith.includes(person.id) ? "active" : "";
                    return `<button type="button" class="item-bubble ${active}" data-person-id="${person.id}" data-item-index="${index}">${escapeHtml(person.name)}</button>`;
                  })
                  .join("")}
              </div>
            </td>
            <td class="ticket-remove-cell">
              <button type="button" class="danger-button text-button delete-ticket-item-btn" data-item-index="${index}" aria-label="Quitar producto">&times;</button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Bind inputs changes
    document.querySelectorAll(".ticket-item-name").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.closest("tr").dataset.itemIndex);
        ticketItems[idx].name = sanitizeText(e.target.value, 80);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const idx = parseInt(e.target.closest("tr").dataset.itemIndex);
        focusTicketItemField(idx, "price");
      });
    });

    document.querySelectorAll(".ticket-item-price").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.closest("tr").dataset.itemIndex);
        ticketItems[idx].price = parseFloat(e.target.value) || 0;
        updateTicketTotals();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const idx = parseInt(e.target.closest("tr").dataset.itemIndex);
        if (idx === ticketItems.length - 1) {
          addEmptyTicketItem("name");
        } else {
          focusTicketItemField(idx + 1, "name");
        }
      });
    });

    document.querySelectorAll(".item-bubble").forEach((bubble) => {
      bubble.addEventListener("click", (e) => {
        const idx = parseInt(e.target.dataset.itemIndex);
        const pid = e.target.dataset.personId;
        const item = ticketItems[idx];
        if (item.splitWith.includes(pid)) {
          item.splitWith = item.splitWith.filter((id) => id !== pid);
          e.target.classList.remove("active");
        } else {
          item.splitWith.push(pid);
          e.target.classList.add("active");
        }
        updateTicketTotals();
      });
    });

    document.querySelectorAll(".delete-ticket-item-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(btn.dataset.itemIndex);
        ticketItems.splice(idx, 1);
        renderTicketItems();
        updateTicketTotals();
      });
    });
  }

  function updateTicketTotals() {
    let subtotal = 0;
    for (const item of ticketItems) {
      subtotal += item.price;
    }
    const tipPercent = selectedTipPercent();
    const taxFixed = parseFloat(els.ticketTaxFixed.value) || 0;
    const total = subtotal * (1 + tipPercent / 100) + taxFixed;

    els.ticketSubtotalLabel.textContent = formatMoney(Math.round(subtotal * 100));
    els.ticketTotalLabel.textContent = formatMoney(Math.round(total * 100));
  }

  function selectedTipPercent() {
    const selected = document.querySelector("input[name='ticketTipPercent']:checked");
    return selected ? Number(selected.value) || 0 : 0;
  }

  function saveRestaurantTicket() {
    if (!ticketItems.length) return alert("Agrega al menos un producto.");
    const paidBy = els.ticketPaidBySelect.value; // "" means nobody paid (pay at the moment)
    const ticketName = sanitizeText(els.ticketNameInput.value, 80) || "Restaurante";

    for (let i = 0; i < ticketItems.length; i++) {
      const item = ticketItems[i];
      if (item.price <= 0) return alert(`El precio del producto "${item.name || i+1}" debe ser mayor a 0.`);
      if (!item.splitWith.length) return alert(`Asigna al menos a un comensal para el producto "${item.name || i+1}".`);
    }

    let subtotal = 0;
    for (const item of ticketItems) {
      subtotal += item.price;
    }
    if (subtotal <= 0) return alert("El subtotal debe ser mayor a 0.");

    const tipPercent = selectedTipPercent();
    const taxFixed = parseFloat(els.ticketTaxFixed.value) || 0;
    const total = subtotal * (1 + tipPercent / 100) + taxFixed;
    const multiplier = total / subtotal;

    const personShares = new Map();
    state.people.forEach(p => personShares.set(p.id, 0));

    for (const item of ticketItems) {
      const itemPriceCents = Math.round(item.price * 100);
      const splitCount = item.splitWith.length;
      const baseShare = Math.floor(itemPriceCents / splitCount);
      let remainder = itemPriceCents - baseShare * splitCount;

      for (const pid of item.splitWith) {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        const current = personShares.get(pid) || 0;
        personShares.set(pid, current + baseShare + extra);
      }
    }

    const newExpenses = [];
    const restaurantId = createId("r");

    if (paidBy) {
      // Someone paid: create debts from each person to the payer
      const payerShareCents = Math.round((personShares.get(paidBy) || 0) * multiplier);
      personShares.forEach((shareCents, pid) => {
        if (pid === paidBy || shareCents <= 0) return;
        const finalShareCents = Math.round(shareCents * multiplier);
        const itemsList = ticketItems
          .filter(item => item.splitWith.includes(pid))
          .map(item => sanitizeText(item.name || "Producto", 80) || "Producto")
          .join(", ");
        const limitDesc = itemsList.length > 55 ? itemsList.slice(0, 52) + "..." : itemsList;
        const description = `${ticketName}: ${limitDesc}`;

        newExpenses.push({
          id: createId("e"),
          description,
          amountCents: finalShareCents,
          paidBy,
          splitWith: [pid],
          createdAt: Date.now(),
          source: "restaurant",
          restaurantId,
          restaurantPaidBy: paidBy,
          payerShareCents,
          restaurantName: ticketName
        });
      });
    } else {
      // Nobody paid (pay at the moment): record each person's share as info-only
      personShares.forEach((shareCents, pid) => {
        if (shareCents <= 0) return;
        const finalShareCents = Math.round(shareCents * multiplier);
        const itemsList = ticketItems
          .filter(item => item.splitWith.includes(pid))
          .map(item => sanitizeText(item.name || "Producto", 80) || "Producto")
          .join(", ");
        const limitDesc = itemsList.length > 55 ? itemsList.slice(0, 52) + "..." : itemsList;
        const personName = state.people.find(p => p.id === pid)?.name || "?";
        const description = `${ticketName}: ${limitDesc}`;

        newExpenses.push({
          id: createId("e"),
          description,
          amountCents: finalShareCents,
          paidBy: pid,
          splitWith: [pid],
          createdAt: Date.now(),
          source: "restaurant",
          restaurantId,
          restaurantPaidBy: "__self__",
          payerShareCents: finalShareCents,
          restaurantName: ticketName
        });
      });
    }

    if (newExpenses.length > 0) {
      state.expenses.push(...newExpenses);
      saveAndRender();
      setStatus(`Cuenta dividida. ${newExpenses.length} gasto(s) agregado(s).`);
    } else {
      setStatus("La cuenta se dividio, pero no se generaron pagos.");
    }

    els.restaurantDialog.close();
  }

  function parseTicketText(text) {
    const lines = text.split("\n");
    const items = [];
    const ignoreKeywords = ["total", "subtotal", "iva", "propina", "descuento", "efectivo", "tarjeta", "cambio", "pago", "duplicado", "ticket", "mesa", "servicio"];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const lowerLine = line.toLowerCase();
      if (ignoreKeywords.some(keyword => lowerLine.includes(keyword))) {
        continue;
      }

      const priceRegex = /(?:[\$\s]*)(\d+(?:[\.,]\d{2})?)\s*$/;
      const match = line.match(priceRegex);

      if (match) {
        const priceStr = match[1].replace(",", ".");
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) continue;

        let name = line.substring(0, line.lastIndexOf(match[0])).trim();

        name = name.replace(/^(\d+[\s*xX]?)\s*/, "");
        name = name.replace(/\s*c\/u\s*$/, "");
        name = name.replace(/[\.\-\*_]+$/, "").trim();

        name = sanitizeText(name, 80);
        if (!name) name = "Producto";

        items.push({ name, price });
      }
    }
    return items;
  }

  function openReminderDialog(personId) {
    const person = state.people.find((p) => p.id === personId);
    if (!person) return;

    els.reminderPersonName.textContent = person.name;
    els.reminderPersonIdInput.value = person.id;
    els.reminderTextInput.value = person.reminder || "";

    els.reminderDialog.showModal();
  }

  function saveReminder(event) {
    event.preventDefault();
    const personId = els.reminderPersonIdInput.value;
    const personIndex = state.people.findIndex((p) => p.id === personId);
    if (personIndex === -1) return;

    state.people[personIndex].reminder = sanitizeText(els.reminderTextInput.value, 160);

    saveAndRender();
    els.reminderDialog.close();
    setStatus(`Recordatorio actualizado para ${state.people[personIndex].name}.`);
  }

  function renderExpenses() {
    if (!state.expenses.length) {
      els.expenseList.innerHTML = `<li class="empty">Agrega una cuenta por platillo o un gasto compartido para calcular pagos.</li>`;
      return;
    }
    const renderedRestaurantIds = new Set();
    els.expenseList.innerHTML = [...state.expenses]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((expense) => {
        if (expense.source === "restaurant" && expense.restaurantId) {
          if (renderedRestaurantIds.has(expense.restaurantId)) return "";
          renderedRestaurantIds.add(expense.restaurantId);
          const summary = buildRestaurantExpenseSummary(expense.restaurantId);
          return `
          <li class="list-item">
            <div class="expense-edit-row">
              <strong>${escapeHtml(summary.description)}</strong>
              <strong>${formatMoney(summary.amountCents)}</strong>
              <p class="item-meta">${escapeHtml(summary.meta)}</p>
            </div>
            <button class="danger-button" type="button" data-remove-restaurant="${expense.restaurantId}">Quitar</button>
          </li>
        `;
        }
        const payer = personName(expense.paidBy);
        const splitNames = expense.splitWith.map(personName).join(", ");
        const meta = expense.source === "restaurant" && expense.restaurantPaidBy === "__self__"
          ? `Aporte de ${payer}`
          : expense.source === "restaurant"
            ? `${splitNames} paga a ${payer}`
            : `Pago ${payer} - dividido entre ${splitNames}`;
        return `
          <li class="list-item">
            <div class="expense-edit-row">
              <input class="inline-expense-description" type="text" value="${escapeHtml(expense.description)}" data-expense-description="${expense.id}" aria-label="Editar descripcion">
              <input class="inline-expense-amount" type="number" min="0" step="0.01" inputmode="decimal" value="${(expense.amountCents / 100).toFixed(2)}" data-expense-amount="${expense.id}" aria-label="Editar monto">
              <p class="item-meta">${escapeHtml(meta)}</p>
            </div>
            <button class="danger-button" type="button" data-remove-expense="${expense.id}">Quitar</button>
          </li>
        `;
      })
      .join("");
    document.querySelectorAll("[data-remove-restaurant]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!confirm("Quitar esta cuenta por platillo?")) return;
        state.expenses = state.expenses.filter((expense) => expense.restaurantId !== button.dataset.removeRestaurant);
        saveAndRender();
      });
    });
    document.querySelectorAll("[data-remove-expense]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!confirm("Quitar este gasto?")) return;
        state.expenses = state.expenses.filter((expense) => expense.id !== button.dataset.removeExpense);
        saveAndRender();
      });
    });
    document.querySelectorAll("[data-expense-description]").forEach((input) => {
      input.addEventListener("change", () => updateExpenseDescription(input.dataset.expenseDescription, input.value));
      input.addEventListener("keydown", handleInlineInputKeydown);
    });
    document.querySelectorAll("[data-expense-amount]").forEach((input) => {
      input.addEventListener("change", () => updateExpenseAmount(input.dataset.expenseAmount, input.value));
      input.addEventListener("keydown", handleInlineInputKeydown);
    });
  }

  function buildRestaurantExpenseSummary(restaurantId) {
    const groupExpenses = state.expenses.filter((expense) => expense.restaurantId === restaurantId);
    const first = groupExpenses[0] || {};
    const paidBy = first.restaurantPaidBy || "";
    const consumedBy = new Set();
    let amountCents = 0;
    let payerShareCents = 0;

    groupExpenses.forEach((expense) => {
      amountCents += expense.amountCents;
      if (expense.restaurantPaidBy !== "__self__") {
        payerShareCents = Math.max(payerShareCents, expense.payerShareCents || 0);
      }
      expense.splitWith.forEach((personId) => consumedBy.add(personId));
    });

    amountCents += payerShareCents;
    const names = Array.from(consumedBy).map(personName).join(", ") || "Sin comensales";
    return {
      description: first.restaurantName || "Cuenta por platillo",
      amountCents,
      meta: paidBy === "__self__"
        ? `Pago al momento - consumido por ${names}`
        : `Pago ${personName(paidBy)} - consumido por ${names}`
    };
  }

  function handleInlineInputKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      render();
    }
  }

  function updateExpenseDescription(expenseId, value) {
    const expense = state.expenses.find((item) => item.id === expenseId);
    if (!expense) return;
    const description = sanitizeText(value, 80);
    if (!description) {
      render();
      return setStatus("La descripcion no puede estar vacia.");
    }
    if (expense.description === description) return;
    expense.description = description;
    saveAndRender();
    setStatus("Gasto actualizado.");
  }

  function updateExpenseAmount(expenseId, value) {
    const expense = state.expenses.find((item) => item.id === expenseId);
    if (!expense) return;
    const amountCents = toCents(value);
    if (amountCents <= 0) {
      render();
      return setStatus("El monto debe ser mayor a cero.");
    }
    if (expense.amountCents === amountCents) return;
    expense.amountCents = amountCents;
    if (expense.source === "restaurant" && expense.restaurantPaidBy === "__self__") {
      expense.payerShareCents = amountCents;
    }
    saveAndRender();
    setStatus("Monto actualizado.");
  }

  function renderBalances() {
    const { balances, settlements } = calculateSettlements();
    if (!state.people.length) {
      els.balanceList.innerHTML = `<div class="empty">Agrega participantes para calcular pagos.</div>`;
      els.settlementList.innerHTML = "";
      return;
    }

    const tableRows = buildTableCloseRows(settlements);
    const hasTableContributions = tableRows.some((row) => row.amountCents > 0 || row.originalAmountCents > 0);
    const allBalancesZero = state.people.every((person) => (balances.get(person.id) || 0) === 0);
    if (hasTableContributions && allBalancesZero) {
      els.balanceList.innerHTML = "";
      els.settlementList.innerHTML = "";
      return;
    }

    let balancesHtml = state.people
      .map((person) => {
        const amount = balances.get(person.id) || 0;
        const className = amount > 0 ? "positive" : amount < 0 ? "negative" : "neutral";
        const label = amount > 0 ? "cobra" : amount < 0 ? "debe" : "en cero";
        return `
          <div class="balance-row is-${className}">
            <span>${escapeHtml(person.name)}</span>
            <span class="${className}">${label} ${formatMoney(Math.abs(amount))}</span>
          </div>
        `;
      })
      .join("");

    if (!state.expenses.length) {
      balancesHtml = `
        <div class="restaurant-warning" style="margin-top: 0; margin-bottom: 16px;">
          <span><strong>Falta agregar gastos:</strong> registra platillos o gastos compartidos para calcular los pagos.</span>
        </div>
      ` + balancesHtml;
    }

    els.balanceList.innerHTML = balancesHtml;

    if (!settlements.length) {
      els.settlementList.innerHTML = `<div class="empty">Si nadie pago todavia, revisa abajo cuanto aporta cada persona.</div>`;
      return;
    }

    els.settlementList.innerHTML = `
      <h2>Pagos sugeridos</h2>
      ${settlements
        .map(
          (settlement) => `
            <div class="settlement-row">
              <span>${escapeHtml(personName(settlement.from))} paga a ${escapeHtml(personName(settlement.to))}</span>
              <strong>${formatMoney(settlement.amountCents)}</strong>
            </div>
          `
        )
        .join("")}
    `;
  }

  function renderTableClose() {
    const { settlements } = calculateSettlements();
    if (!els.tableClosePanel) return;

    const rows = buildTableCloseRows(settlements);
    if (!rows.length) {
      els.tableClosePanel.innerHTML = "";
      return;
    }

    const missingTotal = rows.reduce((total, row) => total + row.missingCents, 0);
    const paidTotal = rows.reduce((total, row) => total + Math.min(row.paidCents, row.amountCents), 0);
    const changeTotal = rows.reduce((total, row) => total + row.changeCents, 0);
    const pendingRows = rows.filter((row) => row.missingCents > 0 && !row.isGuest);
    const guestRows = rows.filter((row) => row.isGuest);
    const visibleRows = rows.filter((row) => !row.isGuest);
    const absorbedTotal = guestRows.reduce((total, row) => total + row.originalAmountCents, 0);
    const guestSummaryText = guestRows.length && visibleRows.length === 1
      ? `Cubierto por ${personName(visibleRows[0].from)}: ${formatMoney(absorbedTotal)}`
      : `Incluido en quienes pagan: ${formatMoney(absorbedTotal)}`;
    const allGuests = guestRows.length > 0 && guestRows.length === rows.length;

    els.tableClosePanel.innerHTML = `
      <div class="table-close-header">
        <div>
          <h2>Pagos de la mesa</h2>
          <p>Marca quien ya cubrio su parte o cuanto entrego al juntar la cuenta.</p>
        </div>
        <strong class="${missingTotal > 0 || allGuests ? "negative" : "positive"}">
          ${allGuests ? "Falta pagador" : missingTotal > 0 ? `Falta ${formatMoney(missingTotal)}` : "Mesa saldada"}
        </strong>
      </div>
      <div class="close-summary">
        <span>Juntado: ${formatMoney(paidTotal)}</span>
        <span>Cambio: ${formatMoney(changeTotal)}</span>
      </div>
      ${
        guestRows.length
          ? `<div class="guest-summary">
              <strong>Festejados: ${guestRows.map((row) => escapeHtml(personName(row.from))).join(", ")}</strong>
              <span>${escapeHtml(guestSummaryText)}</span>
            </div>`
          : ""
      }
      ${allGuests ? `<p class="close-warning">No puede quedar toda la mesa como festejada. Deja al menos una persona que absorba la cuenta.</p>` : ""}
      <div class="close-header-row" aria-hidden="true">
        <span>Persona</span>
        <span>Debe</span>
        <span>Entrego</span>
        <span>Estado</span>
      </div>
      <div class="close-list">
        ${visibleRows.map((row) => renderCloseRow(row)).join("")}
      </div>
      <div class="close-pending">
        <h3>Faltan por pagar</h3>
        ${
          pendingRows.length
            ? pendingRows.map((row) => `<p>${escapeHtml(personName(row.from))}: ${formatMoney(row.missingCents)}</p>`).join("")
            : `<p>Todos cubrieron su parte.</p>`
        }
      </div>
    `;

    document.querySelectorAll("[data-close-paid]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.closePaid;
        const amountCents = Number(input.dataset.amountCents) || 0;
        const current = state.tableClose[key] || {};
        state.tableClose[key] = { ...current, paidCents: input.checked ? amountCents : 0 };
        saveAndRender();
      });
    });

    document.querySelectorAll("[data-close-delivered]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.closeDelivered;
        const current = state.tableClose[key] || {};
        state.tableClose[key] = { ...current, paidCents: Math.max(0, toCents(input.value)) };
        saveAndRender();
      });
    });
  }

  function renderErrorConsole() {
    if (!els.errorConsoleBox) return;
    if (errorLogs.length === 0) {
      els.errorConsoleBox.className = "error-console-box no-errors";
      els.errorConsoleBox.innerHTML = "No se han detectado errores de ejecucion. Todo funciona bien.";
      els.copyErrorLogBtn.classList.add("hidden");
      return;
    }

    els.errorConsoleBox.className = "error-console-box has-errors";
    els.errorConsoleBox.innerHTML = errorLogs
      .map(
        (log) => `
          <div class="error-log-item">
            <strong>[${log.time}] (${log.file}):</strong> ${escapeHtml(log.message)}
            ${log.stack ? `<pre class="error-stack">${escapeHtml(log.stack.slice(0, 400))}</pre>` : ""}
          </div>
        `
      )
      .join("");
    els.copyErrorLogBtn.classList.remove("hidden");
  }

  function buildTableCloseRows(settlements) {
    const payerContributionRows = buildRestaurantPayerRows();
    const baseRows = settlements.map((settlement) => {
      const key = settlementKey(settlement);
      const record = state.tableClose[key] || { paidCents: 0 };
      const debtor = state.people.find(p => p.id === settlement.from);
      const isGuest = debtor ? Boolean(debtor.isGuest) : false;
      return {
        ...settlement,
        key,
        originalAmountCents: settlement.amountCents,
        amountCents: settlement.amountCents,
        paidCents: record.paidCents || 0,
        isGuest,
        absorbedCents: 0
      };
    }).concat(payerContributionRows);

    const guestTotal = baseRows.reduce((total, row) => total + (row.isGuest ? row.originalAmountCents : 0), 0);
    const payerRows = baseRows.filter((row) => !row.isGuest);
    const uniqueDebtors = [...new Set(payerRows.map((row) => row.from))];
    if (guestTotal > 0 && uniqueDebtors.length > 0) {
      const baseShare = Math.floor(guestTotal / uniqueDebtors.length);
      let remainder = guestTotal - baseShare * uniqueDebtors.length;
      const debtorShares = {};
      uniqueDebtors.forEach((debtor) => {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        debtorShares[debtor] = baseShare + extra;
      });
      payerRows.forEach((row) => {
        const debtorRows = payerRows.filter((r) => r.from === row.from);
        const index = debtorRows.indexOf(row);
        const totalShareForDebtor = debtorShares[row.from] || 0;
        const rowShare = Math.floor(totalShareForDebtor / debtorRows.length);
        const rowRemainder = totalShareForDebtor - rowShare * debtorRows.length;
        row.absorbedCents = rowShare + (index < rowRemainder ? 1 : 0);
        row.amountCents += row.absorbedCents;
      });
    }

    baseRows.forEach((row) => {
      if (row.isGuest) {
        row.amountCents = 0;
        row.paidCents = 0;
      }
      row.missingCents = Math.max(0, row.amountCents - row.paidCents);
      row.changeCents = Math.max(0, row.paidCents - row.amountCents);
    });

    return baseRows;
  }

  function buildRestaurantPayerRows() {
    const restaurantGroups = new Map();
    const personTotals = new Map();
    state.expenses.forEach((expense) => {
      if (expense.source !== "restaurant" || !expense.restaurantId || !expense.restaurantPaidBy) return;
      if (expense.restaurantPaidBy === "__self__") {
        if (!state.people.some((person) => person.id === expense.paidBy)) return;
        personTotals.set(expense.paidBy, (personTotals.get(expense.paidBy) || 0) + expense.amountCents);
        return;
      }
      if (!state.people.some((person) => person.id === expense.restaurantPaidBy)) return;
      if (!restaurantGroups.has(expense.restaurantId)) {
        restaurantGroups.set(expense.restaurantId, {
          restaurantId: expense.restaurantId,
          paidBy: expense.restaurantPaidBy,
          payerShareCents: expense.payerShareCents || 0,
          restaurantName: expense.restaurantName || expense.description || "Restaurante"
        });
      }
    });

    restaurantGroups.forEach((group) => {
      if (group.payerShareCents <= 0) return;
      personTotals.set(group.paidBy, (personTotals.get(group.paidBy) || 0) + group.payerShareCents);
    });

    return Array.from(personTotals.entries())
      .filter(([, amountCents]) => amountCents > 0)
      .map(([personId, amountCents]) => {
        const key = `restaurant-payer:${personId}:${personId}`;
        const record = state.tableClose[key] || { paidCents: 0 };
        const payer = state.people.find((person) => person.id === personId);
        return {
          expenseId: `restaurant-payer-${personId}`,
          from: personId,
          to: personId,
          key,
          originalAmountCents: amountCents,
          amountCents,
          paidCents: record.paidCents || 0,
          isGuest: payer ? Boolean(payer.isGuest) : false,
          absorbedCents: 0,
          isPayerContribution: true
        };
      });
  }

  function renderCloseRow(row) {
    const isPaid = row.missingCents === 0;
    const status = row.isGuest ? "Festejado" : isPaid ? "Saldado" : row.paidCents > 0 ? `Falta ${formatMoney(row.missingCents)}` : "Pendiente";
    const change = row.changeCents > 0 ? `<span class="positive">Cambio ${formatMoney(row.changeCents)}</span>` : "";
    const absorbed = row.absorbedCents > 0 ? `<span class="neutral">Incluye invitado(s): ${formatMoney(row.absorbedCents)}</span>` : "";
    const original = row.isGuest ? `<span class="neutral">Parte original: ${formatMoney(row.originalAmountCents)}</span>` : "";
    const amountLine = row.isPayerContribution
      ? `<span>Aporta ${formatMoney(row.amountCents)} a la cuenta</span>`
      : `<span>Debe ${formatMoney(row.amountCents)} a ${escapeHtml(personName(row.to))}</span>`;
    return `
      <div class="close-row ${isPaid ? "is-paid" : ""} ${row.isGuest ? "is-guest" : ""}">
        <label class="close-check">
          <input type="checkbox" data-close-paid="${row.key}" data-amount-cents="${row.amountCents}" ${isPaid && !row.isGuest ? "checked" : ""} ${row.isGuest ? "disabled" : ""}>
          <span>${escapeHtml(personName(row.from))}</span>
        </label>
        <div class="close-row-money">
          ${amountLine}
          ${original}
          ${absorbed}
          <label>
            Entrego
            <input type="number" min="0" step="0.01" inputmode="decimal" data-close-delivered="${row.key}" value="${row.paidCents ? (row.paidCents / 100).toFixed(2) : ""}" placeholder="0.00" ${row.isGuest ? "disabled" : ""}>
          </label>
          <strong class="${isPaid || row.isGuest ? "positive" : "negative"}">${status}</strong>
          ${change}
        </div>
      </div>
    `;
  }

  function settlementKey(settlement) {
    return `${settlement.expenseId || "settlement"}:${settlement.from}:${settlement.to}`;
  }

  function renderShareMode() {
    els.privateKeyField.classList.add("hidden");
    els.copyPrivateKeyBtn.classList.add("hidden");
    els.privacyNote.textContent = "El link incluye los datos para abrir el grupo. Compartelo solo con quienes participan en la cuenta.";
  }

  function addExpense() {
    const description = sanitizeText(els.expenseDescriptionInput.value, 80);
    const amountCents = toCents(els.expenseAmountInput.value);
    const peopleIds = new Set(state.people.map((person) => person.id));
    const paidBy = sanitizeId(els.expensePaidByInput.value, "p");
    const splitWith = Array.from(document.querySelectorAll("[data-split-id]:checked"))
      .map((input) => sanitizeId(input.dataset.splitId, "p"))
      .filter((id) => peopleIds.has(id));

    if (!state.people.length) return setStatus("Agrega participantes primero.");
    if (!description) return setStatus("Agrega una descripcion.");
    if (amountCents <= 0) return setStatus("El monto debe ser mayor a cero.");
    if (!peopleIds.has(paidBy)) return setStatus("Selecciona quien pago.");
    if (!splitWith.length) return setStatus("Selecciona al menos una persona para dividir.");

    state.expenses.push({
      id: createId("e"),
      description,
      amountCents,
      paidBy,
      splitWith,
      createdAt: Date.now()
    });

    els.expenseDescriptionInput.value = "";
    els.expenseAmountInput.value = "";
    saveAndRender();
    setStatus("Gasto agregado.");
  }

  // addDishRows removed (replaced by Restaurant Mode wizard)

  function removePerson(personId) {
    if (isPersonUsed(personId)) {
      setStatus("No puedes quitar a alguien que ya aparece en gastos.");
      return;
    }
    state.people = state.people.filter((person) => person.id !== personId);
    saveAndRender();
  }

  function updatePersonName(personId, value) {
    const person = state.people.find((p) => p.id === personId);
    if (!person) return;
    const trimmed = sanitizeText(value, 40);
    if (!trimmed) {
      render();
      return setStatus("El nombre no puede estar vacio.");
    }

    const duplicate = state.people.some(
      (p) => p.id !== personId && p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      render();
      return setStatus("Ya existe un participante con ese nombre.");
    }

    if (person.name === trimmed) return;
    person.name = trimmed;
    saveAndRender();
    setStatus(`Nombre cambiado a ${trimmed}.`);
  }

  function togglePersonGuest(personId) {
    const person = state.people.find((p) => p.id === personId);
    if (!person) return;
    person.isGuest = !person.isGuest;
    saveAndRender();
  }

  function isPersonUsed(personId) {
    return state.expenses.some((expense) => expense.paidBy === personId || expense.splitWith.includes(personId));
  }

  function calculateSettlements() {
    return window.ClaraCore.calculateSettlements(state);
  }

  async function generateAndCopyShare(asMessage) {
    try {
      const mode = "easy";
      const { url, key } = await createShareUrl(mode);
      els.shareLinkOutput.value = url;
      els.privateKeyOutput.value = key || "";
      renderShareMode();
      const content = asMessage ? createWhatsAppMessage(url, Boolean(key)) : url;
      await copyText(content);
      setStatus(asMessage ? "Mensaje copiado." : "Link copiado.");
    } catch (error) {
      setStatus(error.message || "No pude crear el link. Revisa el navegador.");
    }
  }

  async function createShareUrl(mode) {
    assertCryptoAvailable();
    const portableState = normalizeState(state);
    const json = JSON.stringify(portableState);
    const packed = await packJson(json);

    if (mode === "easy") {
      const key = randomKey();
      const encrypted = await encryptText(packed, key);
      return { url: withHash(`${EASY_PREFIX}:${encrypted}:${key}`), key: "" };
    }

    const key = randomKey();
    const encrypted = await encryptText(packed, key);
    return { url: withHash(`${PRIVATE_PREFIX}:${encrypted}`), key };
  }

  async function decodeHash(rawHash, privateKey) {
    if (typeof rawHash !== "string" || rawHash.length > MAX_HASH_LENGTH) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    const parts = rawHash.split(":");
    const prefix = parts[0];

    if (prefix === EASY_PREFIX) {
      assertCryptoAvailable();
      const encrypted = parts[1];
      const key = parts[2];
      if (!encrypted || !key) throw new Error("INVALID_EASY_LINK");
      const packed = await decryptText(encrypted, key);
      return JSON.parse(await unpackJson(packed));
    }

    if (prefix === PRIVATE_PREFIX) {
      assertCryptoAvailable();
      if (!privateKey) throw new Error("PRIVATE_KEY_REQUIRED");
      if (!parts[1]) throw new Error("INVALID_PRIVATE_LINK");
      const packed = await decryptText(parts[1], privateKey);
      return JSON.parse(await unpackJson(packed));
    }

    if (prefix === UNCOMPRESSED_PREFIX || prefix === COMPRESSED_PREFIX) {
      return JSON.parse(await unpackJson(rawHash));
    }

    return JSON.parse(fromBase64Url(rawHash));
  }

  async function packJson(json) {
    if (canCompress()) {
      try {
        const compressed = await compress(textEncoder.encode(json));
        return `${COMPRESSED_PREFIX}:${toBase64Url(compressed)}`;
      } catch {
        return `${UNCOMPRESSED_PREFIX}:${toBase64Url(textEncoder.encode(json))}`;
      }
    }
    return `${UNCOMPRESSED_PREFIX}:${toBase64Url(textEncoder.encode(json))}`;
  }

  async function unpackJson(packed) {
    const [prefix, payload] = packed.split(":");
    if (!prefix || !payload) throw new Error("INVALID_PAYLOAD");
    const bytes = fromBase64UrlBytes(payload);
    if (prefix === COMPRESSED_PREFIX) {
      if (!("DecompressionStream" in window)) throw new Error("NO_DECOMPRESSION");
      const decompressed = await decompress(bytes);
      return textDecoder.decode(decompressed);
    }
    if (prefix === UNCOMPRESSED_PREFIX) {
      return textDecoder.decode(bytes);
    }
    throw new Error("UNKNOWN_PAYLOAD");
  }

  async function compress(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decompress(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encryptText(plainText, keyText) {
    const keyBytes = fromBase64UrlBytes(keyText);
    if (keyBytes.length !== 32) throw new Error("INVALID_KEY");
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, textEncoder.encode(plainText));
    return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
  }

  async function decryptText(payload, keyText) {
    if (!payload || !payload.includes(".")) throw new Error("INVALID_CIPHER");
    const [ivText, cipherText] = payload.split(".");
    const keyBytes = fromBase64UrlBytes(keyText);
    if (keyBytes.length !== 32) throw new Error("INVALID_KEY");
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64UrlBytes(ivText) },
      cryptoKey,
      fromBase64UrlBytes(cipherText)
    );
    return textDecoder.decode(plain);
  }

  function createWhatsAppMessage(url, hasPrivateKey) {
    const { settlements } = calculateSettlements();
    const closeRows = buildTableCloseRows(settlements);
    const title = state.groupName || "Claramente: cuentas claras.";
    const lines = [`${title}`, "", "Pagos:"];
    if (!settlements.length && !closeRows.length) {
      lines.push("No hay pagos pendientes.");
    } else if (!settlements.length) {
      lines.push("Aportes para juntar la cuenta:");
      closeRows
        .filter((row) => !row.isGuest)
        .forEach((row) => {
          lines.push(`${personName(row.from)} aporta ${formatMoney(row.amountCents)}`);
        });
    } else {
      settlements.forEach((settlement) => {
        const fromName = personName(settlement.from);
        const toName = personName(settlement.to);
        lines.push(`${fromName} paga ${formatMoney(settlement.amountCents)} a ${toName}`);
      });
    }
    const closeLines = createTableCloseMessageLines(settlements);
    if (closeLines.length) {
      lines.push("", "Cierre de mesa:", ...closeLines);
    }
    lines.push("", `Link del grupo: ${url}`);
    if (hasPrivateKey) {
      lines.push("Clave: mandala aparte por otro canal.");
    }
    return lines.join("\n");
  }

  function createTableCloseMessageLines(settlements) {
    const lines = [];
    const pending = [];
    let missingTotal = 0;
    const rows = buildTableCloseRows(settlements);
    const guests = rows.filter((row) => row.isGuest);

    rows.forEach((row) => {
      if (row.missingCents > 0 && !row.isGuest) {
        missingTotal += row.missingCents;
        pending.push(`${personName(row.from)} ${formatMoney(row.missingCents)}`);
      }
    });

    if (!rows.length) return lines;
    if (guests.length) {
      lines.push(`Festejados: ${guests.map((row) => personName(row.from)).join(", ")}`);
    }
    if (guests.length === rows.length) {
      lines.push("Falta elegir quien absorbe la cuenta.");
      return lines;
    }
    if (missingTotal === 0) {
      lines.push("Mesa saldada.");
      return lines;
    }
    lines.push(`Falta por juntar: ${formatMoney(missingTotal)}`);
    lines.push(`Faltan: ${pending.join(", ")}`);
    return lines;
  }

  function selectedShareMode() {
    return document.querySelector("input[name='shareMode']:checked")?.value || "easy";
  }

  function withHash(hash) {
    const url = new URL(location.href);
    // Limpiar los parametros de modo forzado al compartir para no obligar a los invitados
    url.searchParams.delete("mode");
    url.searchParams.delete("view");
    url.hash = hash;
    return url.href;
  }

  function hasMeaningfulLocalState() {
    return Boolean(state.groupName || state.people.length || state.expenses.length);
  }

  function randomKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return toBase64Url(bytes);
  }

  function assertCryptoAvailable() {
    if (!window.crypto || !crypto.subtle) {
      throw new Error("Este navegador no tiene Web Crypto disponible. Abre la app en localhost o HTTPS.");
    }
  }

  function canCompress() {
    return "CompressionStream" in window && "DecompressionStream" in window;
  }

  function createId(prefix) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return `${prefix}_${toBase64Url(bytes).slice(0, 6)}`;
  }

  function personName(id) {
    return state.people.find((person) => person.id === id)?.name || "Persona";
  }

  function toCents(value) {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
  }

  function normalizeExpenseAmount(expense) {
    if (Number.isInteger(expense.amountCents)) return Math.max(0, expense.amountCents);
    return toCents(expense.amount ?? 0);
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: state.currency || "MXN"
    }).format(cents / 100);
  }

  function toBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64Url(value) {
    return textDecoder.decode(fromBase64UrlBytes(value));
  }

  function fromBase64UrlBytes(value) {
    if (!value || typeof value !== "string") throw new Error("INVALID_BASE64");
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  let toastTimeout = null;
  function showToast(message) {
    let toast = document.getElementById("toastNotification");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toastNotification";
      toast.className = "toast-notification";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  function setStatus(message) {
    if (els.statusLine) {
      els.statusLine.textContent = message;
    }
    showToast(message);
  }

  function exportBackup() {
    try {
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const sanitizedName = state.groupName
        ? sanitizeText(state.groupName, 80).toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")
        : "grupo";
      const fileName = `grupo-claramente-${sanitizedName}.claramente`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(`Copia guardada: ${fileName}`);
    } catch (err) {
      console.error(err);
      setStatus("Error al exportar la copia del grupo.");
    }
  }

  function handleImportBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setStatus("La copia es demasiado grande para cargarla con seguridad.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const text = e.target.result;
        if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES) {
          throw new Error("El archivo excede el tamano permitido.");
        }
        const parsed = JSON.parse(text);
        
        if (!parsed || (typeof parsed !== "object")) {
          throw new Error("El contenido no es un objeto valido.");
        }

        const normalized = normalizeState(parsed);
        
        if (normalized.people.length === 0 && normalized.expenses.length === 0 && (!parsed.groupName)) {
          if (!confirm("El archivo parece estar vacio o no es un formato valido de Claramente. Deseas importarlo de todos modos?")) {
            event.target.value = "";
            return;
          }
        } else {
          if (!confirm("Estas seguro de que quieres cargar esta copia del grupo? Reemplazara todos los datos actuales en este dispositivo.")) {
            event.target.value = "";
            return;
          }
        }

        state = normalized;
        saveAndRender();
        setStatus("Copia del grupo cargada con exito.");
      } catch (err) {
        console.error(err);
        setStatus("Error al leer el archivo. Asegurate de que sea una copia de Claramente valida.");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = function() {
      setStatus("Error al leer el archivo desde el dispositivo.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (typeof window !== "undefined") {
    window._claraInternals = {
      state,
      emptyState,
      toCents,
      formatMoney,
      normalizeState,
      calculateSettlements,
      buildTableCloseRows,
      packJson,
      unpackJson,
      encryptText,
      decryptText,
      ticketItems,
      saveRestaurantTicket,
      parseTicketText,
      els,
      init,
      errorLogs,
      renderErrorConsole,
      exportBackup,
      handleImportBackupFile
    };
  }
})();

