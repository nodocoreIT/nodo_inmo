/**
 * ContractLocacionDocument — React-PDF component for the Argentine "Contrato de Locación".
 *
 * IMPORTANT: This module imports @react-pdf/renderer at the top level.
 * It MUST only be loaded via dynamic import() — never statically imported
 * from any file on the admin bundle critical path. (HEADLINE-2 / ADR-5)
 *
 * The component is pure / presentational: it reads ContractDocumentData verbatim
 * and never re-computes amounts or queries the DB. (HEADLINE-1)
 *
 * Disclaimer is mandatory and non-removable per HEADLINE-3.
 */

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ContractDocumentData } from "@/features/contracts/lib/contract-locacion-data";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    paddingBottom: 60,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
  },
  // Header band
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
  },
  headerLeft: {
    flexDirection: "column",
    flex: 1,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: "contain",
  },
  agencyName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  agencyDetail: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 1,
  },
  // Disclaimer band
  disclaimer: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderStyle: "solid",
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 8,
    color: "#9a3412",
    lineHeight: 1.4,
  },
  // Title
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    textAlign: "center",
  },
  // Clause
  clauseSection: {
    marginBottom: 12,
  },
  clauseTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  clauseText: {
    fontSize: 10,
    color: "#334155",
    lineHeight: 1.5,
  },
  clauseDetail: {
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
    lineHeight: 1.5,
  },
  // Signature block
  signatureBlock: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
  },
  signatureIntro: {
    fontSize: 10,
    color: "#334155",
    marginBottom: 16,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  signatureLine: {
    flexDirection: "column",
    alignItems: "center",
    width: "30%",
  },
  signatureBar: {
    borderTopWidth: 1,
    borderTopColor: "#1a1a2e",
    borderTopStyle: "solid",
    width: "100%",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 9,
    color: "#475569",
    textAlign: "center",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blank(val: string | undefined | null): string {
  return val && val.trim() ? val : "____";
}

function dash(val: string | undefined | null): string {
  return val && val.trim() ? val : "—";
}

// ─── Clause text (verbatim — §7 of design-c.md) ──────────────────────────────

const SEPTIMA_HABITACIONAL =
  "El inmueble se destina exclusivamente a vivienda del LOCATARIO y su " +
  "grupo familiar conviviente, quedando prohibido darle un destino distinto al habitacional. El " +
  "LOCATARIO no podrá ceder ni transferir el presente contrato, ni subarrendar total o " +
  "parcialmente el inmueble, sin el consentimiento previo y por escrito del LOCADOR. El LOCATARIO " +
  "se obliga a habitar el inmueble en forma personal y a no alterar su estructura ni destino.";

const SEPTIMA_COMERCIAL =
  "El inmueble se destina exclusivamente a la actividad comercial " +
  "declarada por el LOCATARIO, quien manifiesta contar con las habilitaciones que correspondan, " +
  "siendo a su exclusivo cargo la obtención y el mantenimiento de las mismas. Queda prohibida la " +
  "cesión o transferencia del contrato, así como el subarriendo total o parcial, sin autorización " +
  "previa y por escrito del LOCADOR. Todo cambio de destino o de rubro requerirá conformidad " +
  "expresa del LOCADOR.";

const OCTAVA_HABITACIONAL =
  "El LOCATARIO podrá, transcurridos los primeros SEIS (6) meses " +
  "de vigencia de la relación locativa, resolver el contrato debiendo notificar en forma " +
  "fehaciente su decisión al LOCADOR con una antelación mínima de UN (1) mes. Si hace uso de la " +
  "opción resolutoria durante el primer año de vigencia, deberá abonar al LOCADOR, en concepto de " +
  "indemnización, la suma equivalente a UN (1) mes y medio de alquiler al momento de desocupar el " +
  "inmueble; y la de UN (1) mes si la opción se ejercita transcurrido dicho lapso. En los casos " +
  "en que el LOCATARIO notifique con una antelación mínima de TRES (3) meses, no corresponderá el " +
  "pago de indemnización alguna una vez transcurridos los primeros SEIS (6) meses del contrato.";

const OCTAVA_COMERCIAL =
  "Cualquiera de las partes podrá rescindir anticipadamente el " +
  "presente contrato notificando su decisión en forma fehaciente a la otra parte con una " +
  "antelación mínima de SESENTA (60) días corridos. La rescisión ejercida por el LOCATARIO antes " +
  "del vencimiento del plazo pactado dará derecho al LOCADOR a percibir la indemnización que las " +
  "partes acuerden en el presente, sin perjuicio de las obligaciones devengadas hasta la efectiva " +
  "restitución del inmueble.";

const NOVENA =
  "El LOCATARIO recibe el inmueble en buen estado de " +
  "conservación y se obliga a mantenerlo y conservarlo en igual estado, respondiendo por todo " +
  "deterioro que no provenga del uso normal y del transcurso del tiempo. Deberá notificar al " +
  "LOCADOR, de forma inmediata y fehaciente, todo desperfecto o deterioro que requiera reparación " +
  "a cargo del LOCADOR. Al finalizar la locación, el LOCATARIO restituirá el inmueble en el mismo " +
  "estado en que lo recibió, libre de ocupantes y con sus servicios al día.";

const DECIMA =
  "Para todos los efectos legales derivados del presente contrato, las " +
  "partes se someten a la jurisdicción de los tribunales ordinarios competentes correspondientes " +
  "al lugar de ubicación del inmueble, renunciando a cualquier otro fuero o jurisdicción que " +
  "pudiera corresponderles.";

const DEPOSITO_NOTE_HABITACIONAL =
  "El depósito en garantía no podrá exceder el equivalente al primer mes de alquiler y será " +
  "reintegrado al finalizar la locación, conforme art. 1196 CCCN (Ley 27.551).";

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractLocacionDocument(props: ContractDocumentData) {
  const {
    agencyName,
    agencyAddress,
    cuit,
    logoUrl,
    contractType,
    contractTypeLabel,
    locador,
    locatario,
    garantes,
    propertyAddress,
    propertyTypeLabel,
    rooms,
    sqm,
    inventoryDescription,
    startDate,
    endDate,
    durationMonths,
    legalMinNote,
    rentAmount,
    adjustmentIndexLabel,
    adjustmentPeriodMonths,
    depositAmount,
    expensesPaidByLabel,
    signingCity,
    signingDate,
    agencyName: agName,
  } = props;

  const generatedAt = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const isHabitacional = contractType === "habitacional";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {agencyName ? <Text style={styles.agencyName}>{agencyName}</Text> : null}
            {agencyAddress ? <Text style={styles.agencyDetail}>{agencyAddress}</Text> : null}
            {cuit ? <Text style={styles.agencyDetail}>CUIT: {cuit}</Text> : null}
            {!agencyName && !agencyAddress && !cuit ? (
              <Text style={styles.agencyDetail}>—</Text>
            ) : null}
          </View>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        {/* ── Disclaimer (mandatory — HEADLINE-3) ─────────────────────────── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {"Este documento es un modelo orientativo generado automáticamente. Se recomienda su revisión " +
              "por un profesional del derecho antes de la firma. La inmobiliaria no asume responsabilidad " +
              "por el contenido legal del presente modelo."}
          </Text>
        </View>

        {/* ── Title ───────────────────────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>CONTRATO DE LOCACIÓN</Text>
          <Text style={styles.subtitle}>Destino: {contractTypeLabel}</Text>
        </View>

        {/* ── Cláusula PRIMERA — PARTES ──────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>PRIMERA — PARTES</Text>
          <Text style={styles.clauseText}>
            {"LOCADOR: "}{dash(locador.name)}
            {locador.dni ? `, DNI ${locador.dni}` : ""}
            {locador.address ? `, con domicilio en ${locador.address}` : ""}.
          </Text>
          <Text style={styles.clauseText}>
            {"LOCATARIO: "}{dash(locatario.name)}
            {locatario.dni ? `, DNI ${locatario.dni}` : ""}
            {locatario.address ? `, con domicilio en ${locatario.address}` : ""}.
          </Text>
          {garantes.length > 0 && garantes.map((g, i) => (
            <Text key={i} style={styles.clauseText}>
              {"GARANTE"}{garantes.length > 1 ? ` ${i + 1}` : ""}{": "}{dash(g.name)}
              {g.dni ? `, DNI ${g.dni}` : ""}
              {g.address ? `, con domicilio en ${g.address}` : ""}.
            </Text>
          ))}
        </View>

        {/* ── Cláusula SEGUNDA — OBJETO ──────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>SEGUNDA — OBJETO</Text>
          <Text style={styles.clauseText}>
            El LOCADOR da en locación al LOCATARIO el inmueble ubicado en {dash(propertyAddress)},
            {propertyTypeLabel ? ` tipo ${propertyTypeLabel}` : ""}
            {rooms ? `, ${rooms} ambiente${Number(rooms) !== 1 ? "s" : ""}` : ""}
            {sqm ? `, ${sqm} m²` : ""}.
          </Text>
          {inventoryDescription ? (
            <Text style={styles.clauseDetail}>Inventario: {inventoryDescription}</Text>
          ) : null}
        </View>

        {/* ── Cláusula TERCERA — PLAZO ───────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>TERCERA — PLAZO</Text>
          <Text style={styles.clauseText}>
            La locación tendrá una duración de {durationMonths} meses, con inicio el {startDate} y
            vencimiento el {endDate}.
          </Text>
          <Text style={styles.clauseDetail}>{legalMinNote}</Text>
        </View>

        {/* ── Cláusula CUARTA — CANON LOCATIVO ──────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>CUARTA — CANON LOCATIVO</Text>
          <Text style={styles.clauseText}>
            El canon locativo mensual se fija en {rentAmount}. El ajuste se realizará según índice{" "}
            {adjustmentIndexLabel} con periodicidad de {adjustmentPeriodMonths} mes
            {adjustmentPeriodMonths !== 1 ? "es" : ""}. El pago se efectuará entre el día 1 y el
            día 10 de cada mes.
          </Text>
        </View>

        {/* ── Cláusula QUINTA — DEPÓSITO EN GARANTÍA ────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>QUINTA — DEPÓSITO EN GARANTÍA</Text>
          <Text style={styles.clauseText}>
            El LOCATARIO entrega en concepto de depósito en garantía la suma de {depositAmount}.
          </Text>
          {isHabitacional && (
            <Text style={styles.clauseDetail}>{DEPOSITO_NOTE_HABITACIONAL}</Text>
          )}
        </View>

        {/* ── Cláusula SEXTA — SERVICIOS Y EXPENSAS ─────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>SEXTA — SERVICIOS Y EXPENSAS</Text>
          <Text style={styles.clauseText}>
            Los servicios públicos, expensas y tasas municipales correspondientes al inmueble serán
            abonados por el {expensesPaidByLabel}.
          </Text>
        </View>

        {/* ── Cláusula SÉPTIMA — OBLIGACIONES Y USO (conditional) ───────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>
            {isHabitacional ? "SÉPTIMA — DESTINO Y USO" : "SÉPTIMA — DESTINO Y USO"}
          </Text>
          <Text style={styles.clauseText}>
            {isHabitacional ? SEPTIMA_HABITACIONAL : SEPTIMA_COMERCIAL}
          </Text>
        </View>

        {/* ── Cláusula OCTAVA — RESCISIÓN ANTICIPADA (conditional) ──────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>OCTAVA — RESCISIÓN ANTICIPADA</Text>
          <Text style={styles.clauseText}>
            {isHabitacional ? OCTAVA_HABITACIONAL : OCTAVA_COMERCIAL}
          </Text>
        </View>

        {/* ── Cláusula NOVENA — CONSERVACIÓN Y DEVOLUCIÓN (shared) ──────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>NOVENA — CONSERVACIÓN Y DEVOLUCIÓN</Text>
          <Text style={styles.clauseText}>{NOVENA}</Text>
        </View>

        {/* ── Cláusula DÉCIMA — FUERO COMPETENTE (shared) ───────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMA — JURISDICCIÓN</Text>
          <Text style={styles.clauseText}>{DECIMA}</Text>
        </View>

        {/* ── Signature block (wrap={false} — no page split) ────────────── */}
        <View style={styles.signatureBlock} wrap={false}>
          <Text style={styles.signatureIntro}>
            En {blank(signingCity)}, a los {blank(signingDate)}.
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureLine}>
              <View style={styles.signatureBar} />
              <Text style={styles.signatureLabel}>Locador</Text>
            </View>
            <View style={styles.signatureLine}>
              <View style={styles.signatureBar} />
              <Text style={styles.signatureLabel}>Locatario</Text>
            </View>
            <View style={styles.signatureLine}>
              <View style={styles.signatureBar} />
              <Text style={styles.signatureLabel}>Garante</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generado por {agName || "—"} — {generatedAt}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
