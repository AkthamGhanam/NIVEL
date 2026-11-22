import type { Metadata } from "next";
import Link from "next/link";

import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { formatRate, formatUsd } from "@/lib/format";
import { LEGAL_COST_DISCLAIMER } from "@/lib/legal-cost";
import { NOT_EMPLOYER_NOTICE, REPLACEMENT_WARNING, SEARCH_GUARANTEE_NOTICE } from "@/lib/legal-copy";
import type { Level } from "@/lib/level";
import { ACADEMY_COMMISSION_RATE, HIRING_FEE_USD, IVA_RATE, PLANS } from "@/lib/pricing";

export const metadata: Metadata = { title: "Términos de uso" };

const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

function FeeTable() {
  return (
    <div className="overflow-x-auto rounded-card border-[1.5px] border-line">
      <table className="w-full border-collapse text-left text-[0.9375rem]">
        <caption className="sr-only">Tarifa por contratación según el nivel del trabajador, sin IVA</caption>
        <thead>
          <tr className="eyebrow border-b-[1.5px] border-line text-muted">
            <th scope="col" className="px-4 py-3">
              Nivel del trabajador
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Tarifa por contratación
            </th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((level) => (
            <tr key={level} className="border-b border-line-2 last:border-b-0">
              <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                Nivel {level}
              </th>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {formatUsd(HIRING_FEE_USD[level])} más IVA
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotEmployer() {
  return (
    <LegalSection title="NIVEL no es el patrono">
      <p className="font-semibold text-ink">{NOT_EMPLOYER_NOTICE}</p>
      <p>
        La app registra hechos: quién aceptó un trabajo, a qué hora marcó entrada y salida, y qué pago se
        registró. No da órdenes, no sanciona y no decide por ninguna de las dos partes.
      </p>
    </LegalSection>
  );
}

function ForWorkers() {
  return (
    <LegalSection title="Para trabajadores">
      <LegalList
        items={[
          "Usar NIVEL no te cuesta nada.",
          "Solo pueden registrarse personas mayores de 18 años.",
          <>
            Tu nivel se calcula con una{" "}
            <Link href="/legal/niveles" className="font-semibold text-brand underline">
              fórmula pública
            </Link>{" "}
            a partir de hechos que se pueden comprobar.
          </>,
          "El pago de tu trabajo va directo de la empresa a ti. NIVEL solo lo registra y genera el recibo.",
        ]}
      />
    </LegalSection>
  );
}

function ForCompanies() {
  const iva = formatRate(IVA_RATE);
  return (
    <LegalSection title="Para empresas">
      <p>
        La tarifa se genera cuando el trabajador acepta. Si nadie acepta, no se cobra. Todo precio es más IVA
        ({iva}) y se paga en bolívares, por Pago Móvil o transferencia, con factura digital.
      </p>
      <FeeTable />
      <LegalList
        items={[
          `Plan Obra: ${formatUsd(PLANS.obra.monthlyUsd)} al mes más IVA, con ${PLANS.obra.includedHires} contrataciones incluidas. Cada contratación extra cuesta ${formatUsd(PLANS.obra.extraHireUsd)} más IVA.`,
          `Plan Empresa: ${formatUsd(PLANS.empresa.monthlyUsd)} al mes más IVA.`,
          SEARCH_GUARANTEE_NOTICE,
          `El costo legal que muestra la app es una ayuda para planificar. ${LEGAL_COST_DISCLAIMER}`,
        ]}
      />
    </LegalSection>
  );
}

function ForAcademies() {
  return (
    <LegalSection title="Para academias">
      <LegalList
        items={[
          `NIVEL cobra a la academia una comisión de ${formatRate(ACADEMY_COMMISSION_RATE)} del precio del curso, más IVA.`,
          "El curso se paga directo a la academia. Las cuotas, si las hay, las ofrece la academia y no NIVEL.",
          "La constancia la emite la academia. Dice el nombre, el curso, la fecha y la academia, y nunca la cédula.",
        ]}
      />
    </LegalSection>
  );
}

function RatingsAndReports() {
  return (
    <LegalSection title="Calificaciones y reportes">
      <LegalList
        items={[
          "Las calificaciones son privadas. Una empresa nunca ve las calificaciones que otra empresa le dio a un trabajador.",
          "Cada parte ve la calificación de la otra cuando ambas calificaron, o a los 7 días.",
          "Todo reporte lo revisa una persona en menos de 24 horas. Ningún reporte produce una sanción automática.",
          "Quien reporta queda anónimo frente a la empresa, y su nivel no cambia por reportar.",
        ]}
      />
    </LegalSection>
  );
}

function DemoNotice() {
  return (
    <LegalSection title="Esta es una demo">
      <p>
        NIVEL se presenta en el Hackathon ValenValley 2026. Los nombres, las empresas y las cifras son de
        ejemplo. Los códigos por SMS, las facturas y los pagos son simulados.
      </p>
    </LegalSection>
  );
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos de uso"
      lead="NIVEL conecta a trabajadores de oficios con empresas y academias de Carabobo. Aquí está, en corto, cómo funciona."
    >
      <NotEmployer />
      <ForWorkers />
      <ForCompanies />
      <LegalSection title="Reemplazos">
        <p>{REPLACEMENT_WARNING}</p>
      </LegalSection>
      <ForAcademies />
      <RatingsAndReports />
      <DemoNotice />
    </LegalPage>
  );
}
