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

function WhereMoneyGoes() {
  return (
    <LegalSection title="A dónde va el dinero">
      <LegalList
        items={[
          "El salario va directo de la empresa al trabajador. Nunca pasa por NIVEL ni NIVEL lo retiene.",
          "El costo legal estimado (utilidades, vacaciones, prestaciones y aportes) no es un cobro de NIVEL: es lo que la ley le exige a la empresa como patrono. Una parte la recibe el trabajador y otra va a la seguridad social.",
          "Lo único que cobra NIVEL a la empresa es la tarifa por contratación o su plan, más IVA. El IVA se entrega al SENIAT: no es ingreso de NIVEL.",
          "Por cada pago de salario la empresa emite un recibo al trabajador (LOTTT, art. 106). Por cada tarifa, NIVEL emite una factura a la empresa.",
        ]}
      />
    </LegalSection>
  );
}

function FairOffers() {
  return (
    <LegalSection title="Ofertas en regla">
      <LegalList
        items={[
          "Solo publican empresas registradas con su RIF. La verificación la hace el equipo de NIVEL.",
          "Ninguna oferta puede pedir edad, sexo, nacionalidad, religión, estado civil, embarazo, discapacidad ni «buena presencia». La app bloquea esos requisitos.",
          "Está prohibido pedirle dinero a una persona por darle trabajo.",
          "El tipo de contrato lo acuerdan la empresa y el trabajador: por obra determinada, por tiempo determinado o servicio independiente, según corresponda a la relación real.",
          "El contrato se firma en la app con un código de un solo uso. Queda registro de la fecha y la hora de la firma.",
          "Por ahora NIVEL solo admite trabajos dentro de Venezuela.",
        ]}
      />
    </LegalSection>
  );
}

function Channels() {
  return (
    <LegalSection title="Nivi y Telegram">
      <LegalList
        items={[
          "Nivi actúa solo por la persona que abrió la sesión. Nadie puede pedirle que actúe por otra cuenta, y antes de guardar, aceptar o invitar repite el dato y espera tu confirmación.",
          "Conectar Telegram es opcional. Lo que hagas desde el chat (aceptar una oferta, pedir personal) vale igual que en la app y sigue las mismas reglas.",
          "Puedes desconectar Telegram cuando quieras desde la app.",
        ]}
      />
    </LegalSection>
  );
}

const LEGAL_BASES: readonly string[] = [
  "LOTTT, arts. 47 a 49 y 53: NIVEL no suministra personal ni dirige el trabajo; el patrono es la empresa.",
  "LOTTT, arts. 62 a 64 y 87: tipos de contrato y estabilidad.",
  "LOTTT, art. 106: recibo de cada pago de salario.",
  "LOTTT, arts. 131, 142, 190 y 192: utilidades, prestaciones, vacaciones y bono vacacional, que la app estima.",
  "Decreto 5.070 de inamovilidad, vigente hasta el 31/12/2026: NIVEL no retira a nadie de una obra.",
  "Constitución, arts. 21, 28 y 60, y sentencia 1318/2011 del TSJ: igualdad, acceso y corrección de los datos propios, y privacidad.",
  "LOPCYMAT, art. 53: derecho a reportar condiciones inseguras sin represalias.",
  "LOPNNA, art. 96: NIVEL es solo para mayores de 18 años.",
  "Ley de Mensajes de Datos y Firmas Electrónicas: validez de la firma en la app.",
  "Providencias del SENIAT sobre facturación digital e IVA: precios más IVA, en bolívares.",
  "Ley de Protección de las Pensiones y aportes al IVSS, FAOV e INCES: parte del costo legal estimado.",
];

function LegalBases() {
  return (
    <LegalSection title="Bases legales">
      <p>Estas son las normas venezolanas con las que se diseñó cada función de NIVEL:</p>
      <LegalList items={LEGAL_BASES} />
      <p>
        Este resumen no es asesoría legal. Antes del lanzamiento, un abogado laboral venezolano debe revisar
        estos términos, la política de privacidad y los contratos.
      </p>
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
          "Es una constancia de habilidad verificada, no un título oficial.",
          "Cada nivel se puede alcanzar sin pagar un curso: los cursos ayudan, pero no son requisito para recibir ofertas.",
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
      <WhereMoneyGoes />
      <FairOffers />
      <LegalSection title="Reemplazos">
        <p>{REPLACEMENT_WARNING}</p>
      </LegalSection>
      <ForAcademies />
      <RatingsAndReports />
      <Channels />
      <LegalBases />
      <DemoNotice />
    </LegalPage>
  );
}
