(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ClaraCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  function calculateSettlements(state) {
    const people = Array.isArray(state && state.people) ? state.people : [];
    const expenses = Array.isArray(state && state.expenses) ? state.expenses : [];
    const balances = new Map(people.map((person) => [person.id, 0]));
    const guestIds = new Set(people.filter((person) => person.isGuest).map((person) => person.id));

    for (const expense of expenses) {
      const validSplit = Array.isArray(expense.splitWith)
        ? expense.splitWith.filter((id) => balances.has(id))
        : [];
      if (!balances.has(expense.paidBy) || !validSplit.length) continue;
      balances.set(expense.paidBy, balances.get(expense.paidBy) + expense.amountCents);
      const payingSplit = validSplit.filter((id) => !guestIds.has(id));
      const effectiveSplit = payingSplit.length ? payingSplit : validSplit;
      distribute(expense.amountCents, effectiveSplit).forEach((amount, personId) => {
        balances.set(personId, balances.get(personId) - amount);
      });
    }

    return {
      balances,
      settlements: settleBalances(balances)
    };
  }

  function claramenteToClaraState(state) {
    const people = Array.isArray(state && state.people) ? state.people : [];
    const items = Array.isArray(state && state.items) ? state.items : [];
    const canonicalState = {
      version: 1,
      groupName: "",
      currency: "MXN",
      people: people.map((person) => ({
        id: person.id,
        name: person.name,
        reminder: person.reminder || "",
        isGuest: Boolean(person.isGuest)
      })),
      expenses: [],
      tableClose: {},
      updatedAt: 0
    };

    if (state && state.paidMode === "none") {
      calculateClaramenteContributions(state).forEach((amountCents, personId) => {
        if (amountCents <= 0) return;
        canonicalState.expenses.push({
          id: `claramente-none-${personId}`,
          description: "Aportacion antes de pagar",
          amountCents,
          paidBy: personId,
          splitWith: [personId],
          createdAt: canonicalState.expenses.length + 1,
          source: "restaurant",
          restaurantId: "claramente-none",
          restaurantPaidBy: "__self__",
          payerShareCents: amountCents,
          restaurantName: "Claramente"
        });
      });
      return canonicalState;
    }

    canonicalState.expenses = items
      .map((item, index) => {
        const paidBy = state && state.paidMode === "single" ? state.paidById : item.paidById;
        return {
          id: item.id || `claramente-item-${index + 1}`,
          description: item.name || "Gasto",
          amountCents: item.amountCents,
          paidBy,
          splitWith: claramenteSplitPeopleFor(state, item),
          createdAt: index + 1
        };
      })
      .filter((expense) => expense.amountCents > 0 && expense.paidBy && expense.splitWith.length > 0);

    return canonicalState;
  }

  function calculateClaramenteContributions(state) {
    const people = Array.isArray(state && state.people) ? state.people : [];
    const items = Array.isArray(state && state.items) ? state.items : [];
    const totals = new Map(people.map((person) => [person.id, 0]));
    items.forEach((item) => {
      distribute(item.amountCents, claramenteChargedPeopleFor(state, item)).forEach((amount, personId) => {
        totals.set(personId, (totals.get(personId) || 0) + amount);
      });
    });
    return totals;
  }

  function calculateClaramenteSettlements(state) {
    return calculateSettlements(claramenteToClaraState(state)).settlements;
  }

  function claramenteChargedPeopleFor(state, item) {
    const people = Array.isArray(state && state.people) ? state.people : [];
    const payerIds = people.filter((person) => !person.isGuest).map((person) => person.id);
    if (!item) return [];
    if (item.type === "product") {
      const chargedIds = claramenteNonGuestIds(people, item.eatenBy);
      return chargedIds.length ? chargedIds : payerIds;
    }
    if (item.type === "shared") {
      const chargedIds = claramenteNonGuestIds(people, item.splitWith);
      return chargedIds.length ? chargedIds : payerIds;
    }
    if (item.type === "single") {
      const owner = people.find((person) => person.id === item.ownerId);
      if (owner && !owner.isGuest) return [owner.id];
      return payerIds;
    }
    return [];
  }


  function claramenteSplitPeopleFor(state, item) {
    const people = Array.isArray(state && state.people) ? state.people : [];
    const payerIds = people.filter((person) => !person.isGuest).map((person) => person.id);
    if (!item) return [];
    if (item.type === "product") {
      const selectedIds = claramenteValidIds(people, item.eatenBy);
      return claramenteNonGuestIds(people, selectedIds).length ? selectedIds : payerIds;
    }
    if (item.type === "shared") {
      const selectedIds = claramenteValidIds(people, item.splitWith);
      return claramenteNonGuestIds(people, selectedIds).length ? selectedIds : payerIds;
    }
    if (item.type === "single") {
      const owner = people.find((person) => person.id === item.ownerId);
      if (owner && !owner.isGuest) return [owner.id];
      return payerIds;
    }
    return [];
  }

  function claramenteValidIds(people, ids) {
    const peopleIds = new Set(people.map((person) => person.id));
    return Array.isArray(ids) ? Array.from(new Set(ids)).filter((id) => peopleIds.has(id)) : [];
  }

  function claramenteNonGuestIds(people, ids) {
    const peopleById = new Map(people.map((person) => [person.id, person]));
    return Array.isArray(ids)
      ? ids.filter((id) => {
        const person = peopleById.get(id);
        return person && !person.isGuest;
      })
      : [];
  }

  function distribute(amountCents, ids) {
    const result = new Map();
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (!uniqueIds.length) return result;
    const baseShare = Math.floor(amountCents / uniqueIds.length);
    let remainder = amountCents - baseShare * uniqueIds.length;
    uniqueIds.forEach((personId) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      result.set(personId, baseShare + extra);
    });
    return result;
  }

  function settleBalances(balances) {
    const debtors = [];
    const creditors = [];
    for (const [id, amount] of balances.entries()) {
      if (amount < 0) debtors.push({ id, amount: -amount });
      if (amount > 0) creditors.push({ id, amount });
    }

    const settlements = [];
    let debtIndex = 0;
    let creditIndex = 0;
    while (debtIndex < debtors.length && creditIndex < creditors.length) {
      const debtor = debtors[debtIndex];
      const creditor = creditors[creditIndex];
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0) {
        settlements.push({ from: debtor.id, to: creditor.id, amountCents: amount });
      }
      debtor.amount -= amount;
      creditor.amount -= amount;
      if (debtor.amount === 0) debtIndex += 1;
      if (creditor.amount === 0) creditIndex += 1;
    }
    return settlements;
  }

  return {
    calculateClaramenteContributions,
    calculateClaramenteSettlements,
    calculateSettlements,
    claramenteToClaraState,
    distribute,
    settleBalances
  };
});

