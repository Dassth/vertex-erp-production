# Changelog

## 2026.10.20 — fixes from the end-to-end test

1. **GST split (critical).** Same state → CGST + SGST (CGST = half rounded to the paisa, SGST = the rest, so they always add up); other state → IGST; for registered and unregistered (URD) buyers alike.
   - Company profile has a **State** (filled from the GSTIN, editable without one).
   - Customer **Place of supply** is a list of states/UTs with GST codes (01–38, 97); filled from the GSTIN for registered customers. Customers whose place cannot be matched show as "Incomplete details".
   - One shared tax helper is used by quotations, costing, the dispatch preview, tax invoices, the cumulative summary, the Invoice and Billing (GST) reports, their PDF/Excel exports, the report cards and purchase bills.
   - "Confirm dispatch & issue invoice" is blocked, with a clear message, when the state is not known — tax is never put under IGST by guess.
   - The "(GST NOT SPLIT)" group is gone; tax sits in its own CGST / SGST / IGST columns.
   - **Migration `gst-state-split-v1`:** fills the company State, stores each Place of supply as a state code, and corrects only the CGST/SGST/IGST split of issued invoices whose split was missing or wrong (taxable value and total unchanged; one Activity-log entry per invoice). A backup is taken before it runs.
2. **Loans in the cash balance.** A loan received now counts in "Balance at month end" and in "How the money moved"; it is never income. The Summary shows "Loan received" and "Loan repaid (principal)" separately.
3. **EMI principal and interest.** A loan repayment has Principal and Interest (they must add up to the amount; "From the loan's rate" works it out). Only the principal reduces "still owed"; the interest is the expense "Loan interest". The Debts tab shows Interest paid. Loans take an optional interest rate, tenure and EMI. EMIs recorded earlier count as all principal and can be edited.
4. **"This screen could not be loaded".** The app waits for the saved session before opening a page (no "Sign in" title flash); a page file that fails to download is retried, then the page reloads once (never in a loop); the server answers a missing file with 404 instead of the app page; only hashed build files are cached long-term.
5. **Fast typing lost characters.** Text and number fields keep what is being typed: a value arriving from autosave, a server copy or other computers never overwrites a field that has focus, and the typed text is kept when leaving it.
6. **Production job drawer.** The circle next to each process now opens Start / Complete / Report problem (Administrator 1 and 2, any unit). Stage, order progress and the Units page follow; the order completes by itself when its last process does ("Work finished…" in Dispatch stays as an override). Outside units and units without staff never block a start. Roles that cannot update see a plain circle with the reason.
7. **Quotation rates carried into the plan.** A plan made from a quotation now shows the quoted material prices under "Material prices for this order"; process rates and profit start the costing — quote, costing and invoice give the same price per piece.
8. **Laptop-width layout.** Amounts on cards are never cut short (they scale with the card). The Invoice and Billing (GST) report tables fit a 1240 px screen without sideways scrolling (GST % under the rate, GST under the total, GSTIN under the party; the bill number or a small edit button opens a row, as does tapping it); on narrower screens the first column stays fixed while scrolling.
9. **Seed / product data.** A gentle hint on the product form when the HSN looks unrelated to a box or carton (chapter 48, usually 4819). The customer's own records (e.g. an HSN 0823 product, a misspelt material) are not changed by the update — correct them in the app.

Also: invoice order rows on the Invoices page open with the keyboard; the Invoices page enables the cumulative summary as soon as an invoice exists and says how much is still awaiting delivery confirmation (it no longer claims those shipments are left out); a scheduled backup no longer collides with the backup taken just before an update.
