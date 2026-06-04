# Verify Report: property-expenses — PR 2 (Frontend)

**Branch:** `feat/property-expenses-ui`
**Verified:** 2026-06-04
**Scope:** Frontend only — hooks, form dialog, entry point, tests. DB layer (PR 1) is out of scope.
**Mode:** Adversarial and independent. Test suite results supplied by orchestrator: 175 passed / 0 failed, typecheck clean, lint 0 new errors.

---

## Executive Summary

**PASS-WITH-WARNINGS — 0 CRITICAL, 2 WARNING, 2 SUGGESTION.**

The headline security requirement (org_id-first storage path) is correctly implemented and directly tested. All other critical correctness checks pass. Two warnings exist: a UX dead-end in the `charged_to_owner` checkbox makes `false` unreachable in practice, and the zero-amount validation test does not assert the visible error message. Two suggestions cover minor test assertiveness and an undocumented deviation in the form state.

---

## Findings

### CRITICAL — None

---

### WARNING 1 — `charged_to_owner: false` is unreachable in the current UI

**File:** `src/features/property-expenses/components/expense-form-dialog.tsx` lines 282–307
**Spec:** R3, R22, R23 (ADR-4: "form forces an explicit choice")

**What the code does:**
- `defaultValues.charged_to_owner` is `undefined as any`
- The checkbox `onChange` is `field.onChange(e.target.checked)`
- Submitting with the checkbox unchecked → `field.value` remains `undefined` → Zod rejects (correct)
- Submitting with the checkbox checked → `field.value = true` → Zod accepts `true`
- To get `false` the user must click once (→ `true`) then click again (→ `false`)

**The problem:** There is no documented path for the user to deliberately and intuitively select "no, this is NOT charged to the owner." The checkbox renders as a single binary toggle; unchecked means "not yet answered" (blocked by Zod), but unchecked after one click means "answered: false." The label "A cargo del propietario" reads as an affirmative, so clicking it means yes. Un-clicking after clicking means no — but the form shows no visual distinction between "never touched" and "explicitly false."

**Impact:** Every expense where `charged_to_owner` should be `false` requires the user to click the checkbox twice or click once and uncheck — a non-obvious interaction. This will cause data-integrity errors (all expenses will tend to be charged to owner because the user just checks and submits).

**Fix:** Use a radio group or two explicit labeled buttons (Sí / No), consistent with the design's suggestion of "radio/switch." The current checkbox implementation deviates from the spec note "no default (ADR-4)" in spirit — the intent was to FORCE an explicit binary selection, not an unchecked-is-blocked toggle.

---

### WARNING 2 — Zero-amount validation test does not assert the error is VISIBLE

**File:** `src/features/property-expenses/__tests__/create-expense.test.tsx` lines 233–253
**Spec:** R23 scenario "submit with zero amount shows error"

**What the test does:**
```ts
await waitFor(() => {
  expect(mockMutateAsync).not.toHaveBeenCalled();
});
```

**What it does NOT do:** assert that the validation error message "El monto debe ser mayor a cero" (or any error) is rendered in the DOM.

The spec says "a validation error is shown." The test only verifies the mutation was not called — not that the user receives feedback. This is a vacuous partial coverage: a bug that silently swallows the error (e.g., calling `handleSubmit` without the `FormMessage` component rendered) would pass this test.

Compare with WARNING-1's missing-amount test at line 222–231, which does assert `getAllByText(/requerido|required/i).length > 0`. The zero-amount test is weaker.

**Fix:**
```ts
await waitFor(() => {
  expect(screen.getByText(/mayor a cero/i)).toBeInTheDocument();
  expect(mockMutateAsync).not.toHaveBeenCalled();
});
```

---

### SUGGESTION 1 — `defaultValues.type` and `defaultValues.charged_to_owner` use `undefined as any` casts

**File:** `src/features/property-expenses/components/expense-form-dialog.tsx` lines 84–92

```ts
defaultValues: {
  type: undefined as any,
  ...
  charged_to_owner: undefined as any,
},
```

These casts suppress TypeScript's ability to catch incorrect default shapes. The correct pattern is to declare the schema with `.optional()` or use `z.union([z.literal("arreglo"), z.literal("compra_accesorio")]).optional()` for the pre-submit state, then strip the `any` cast. The current approach works at runtime but hides future type-regressions.

This is a code-quality concern, not a correctness issue.

---

### SUGGESTION 2 — R26 (ledger isolation) has no component-level test

**File:** `src/features/property-expenses/__tests__/create-expense.test.tsx`

The hook-level test `use-create-expense.test.tsx` correctly asserts no `from('cash_movements')` call. However, the component-level test `create-expense.test.tsx` mocks `useCreateExpense` entirely — so any accidental `supabase.from('cash_movements')` call added to the form's submit handler in the future would not be caught by any component test.

This is acceptable given the hook test covers it, but a belt-and-suspenders note for the record.

---

## Audit Results by Spec Requirement (Frontend: R21–R26, R32 visible fields)

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| R21 | "Registrar gasto" visible admin / hidden agent | PASS | `register-expense-button.tsx` L19; 2 tests in R21 suite |
| R22 | Form collects all fields; `charged_to_owner` NOT pre-checked | PASS (with WARNING 1) | All fields present; checkbox default `undefined` (unchecked); ADR-4 enforced at schema level |
| R23 | Validation: missing amount, zero amount, valid submit | PASS (with WARNING 2) | Zod schema `amount > 0` refine; mutation blocked on validation failure; zero-amount test coverage weak |
| R24 | Upload-then-insert ordering; upload failure blocks insert | PASS | `handleSubmit` L100–109; direct test in R24 suite |
| R25 | Success closes dialog; failure shows error, keeps open | PASS | R25 suite 2 tests; `role="alert"` assertion |
| R26 | No `cash_movements` call | PASS | Hook test explicit; no `cash_movements` reference anywhere in feature folder |
| R19/R20 | `createSignedUrl` used, not `getPublicUrl`; `receipt_path` is key not URL | PASS | `use-receipt-url.ts` L22; `expense-form-dialog.tsx` L107–109; hook test explicit |
| Storage path org_id-first | `${orgId}/${propertyId}/...` | PASS (CRITICAL CHECK CLEAN) | `use-upload-receipt.ts` L37; `orgId` sourced from `session.user.app_metadata` access token claims (consistent with storage RLS `(storage.foldername(name))[1] = app_metadata.org_id`); explicit test in `use-create-expense.test.tsx` L188–199 |
| Query invalidation | `PROPERTY_EXPENSES_QUERY_KEY` invalidated on success | PASS | `use-create-expense.ts` L33–35 |
| Payload correctness | `type` in `['arreglo','compra_accesorio']`, `currency` in `['ARS','USD']`, `org_id` injected, `charged_to_owner` boolean | PASS | Zod enums; `useAuth().orgId` injected; hook test payload assertion |

---

## Critical Check Detail: Storage Upload Path

`use-upload-receipt.ts` line 37:
```ts
const key = `${orgId}/${propertyId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
```

- `orgId` comes from `useAuth()`, which reads `payload.app_metadata?.org_id` from the decoded JWT access token (confirmed in `use-auth.tsx` L69–70)
- This is IDENTICAL to what the storage RLS policy evaluates: `(storage.foldername(name))[1] = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')`
- The bucket name matches the PR 1 bucket: `property-expense-receipts`
- The test at lines 188–199 explicitly asserts `uploadedKey.split("/")[0] === "org-abc"` (first segment = org_id)

**CRITICAL CHECK: CLEAN.**

---

## Tests Are Real (Strict TDD Verification)

All 17 new vitest tests (7 in `use-create-expense.test.tsx` + 10 in `create-expense.test.tsx`) assert concrete behavior:

- Hook tests: assert specific call signatures (`spies.from.toHaveBeenCalledWith("property_expenses")`), payload shape (`org_id: "org-abc"`), first path segment (`uploadedKey.split("/")[0] === "org-abc"`), and throw conditions
- Component tests: assert DOM presence (`getByRole`), mutation call arguments including `charged_to_owner: true`, upload-before-insert ordering, success callback invocation, and `role="alert"` visibility on failure
- R24 test uses a real rejected promise, not a vacuous stub
- R26 test inspects all `.from()` calls and asserts `"cash_movements"` is not among them

No vacuous tests found, with the one weakness noted in WARNING 2 (zero-amount test does not assert the visible error message).

---

## Deviations from Design (PR 2 — confirmed in apply-progress)

| Item | Design | Applied | Verdict |
|------|--------|---------|---------|
| `charged_to_owner` UI | radio/switch | checkbox | Functional but WARNING 1 — `false` path is non-obvious |
| Success toast | toast notification | dialog-close only | Acceptable — no toast system exists; spec R25 says "notification", which can be the closure itself |
| Orphan cleanup on insert fail | best-effort delete | not implemented | Acceptable — design marks it "best-effort", apply-progress flags as follow-up |

---

## Next Recommended

`sdd-archive` — no CRITICAL issues block archiving. WARNING 1 (charged_to_owner UX) is tracked and should be addressed in a follow-up ticket before real usage, but it does not represent a security or data-corruption risk since Zod correctly blocks `undefined` submissions; `false` is reachable, just non-obvious.
