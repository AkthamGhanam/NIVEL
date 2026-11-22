import type { Metadata } from "next";

import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LevelBadge } from "@/components/ui/tag";
import { formatUsd } from "@/lib/format";
import { REFERENCE_BAND_NOTICE } from "@/lib/legal-copy";
import { levelTable, RATING_RULES } from "@/lib/level-table";

export const metadata: Metadata = { title: "Cómo se calcula tu nivel" };

/** En el teléfono, cada nivel es una tarjeta: nada se sale de la pantalla. */
function LevelCards() {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {levelTable().map((row) => (
        <li key={row.level} className="rounded-card border-[1.5px] border-line p-4">
          <LevelBadge level={row.level} />
          <p className="mt-2 text-ink">{row.requirement}</p>
          <p className="mt-2 text-sm text-muted">
            Referencia al mes:{" "}
            <span className="font-semibold text-ink tabular-nums">
              {formatUsd(row.band.min)} a {formatUsd(row.band.max)}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** En pantallas anchas, la misma información en una tabla. */
function LevelTable() {
  return (
    <div className="hidden rounded-card border-[1.5px] border-line md:block">
      <table className="w-full border-collapse text-left text-[0.9375rem]">
        <caption className="sr-only">
          Niveles de NIVEL, su requisito y la referencia de mercado al mes
        </caption>
        <thead>
          <tr className="eyebrow border-b-[1.5px] border-line text-muted">
            <th scope="col" className="px-4 py-3">
              Nivel
            </th>
            <th scope="col" className="px-4 py-3">
              Requisito
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Referencia al mes
            </th>
          </tr>
        </thead>
        <tbody>
          {levelTable().map((row) => (
            <tr key={row.level} className="border-b border-line-2 last:border-b-0">
              <th scope="row" className="px-4 py-3 align-top font-normal whitespace-nowrap">
                <LevelBadge level={row.level} />
              </th>
              <td className="px-4 py-3 align-top text-ink">{row.requirement}</td>
              <td className="px-4 py-3 text-right align-top font-semibold whitespace-nowrap tabular-nums">
                {formatUsd(row.band.min)} a {formatUsd(row.band.max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LevelsPage() {
  return (
    <LegalPage
      title="Cómo se calcula tu nivel"
      lead="Tu nivel sale de hechos que se pueden comprobar. La fórmula es pública y es la misma para todas las personas."
    >
      <LegalSection title="Los cinco niveles">
        <LevelCards />
        <LevelTable />
        <p className="text-sm text-muted">{REFERENCE_BAND_NOTICE}</p>
      </LegalSection>

      <LegalSection title="Qué cuenta como hecho">
        <LegalList
          items={[
            "Un trabajo confirmado es un trabajo con asistencia registrada y con el pago confirmado por ti y por la empresa.",
            "La prueba práctica la evalúa un taller aliado. Se aprueba con 3 de 4 criterios.",
            "La constancia la emite la academia cuando terminas el curso.",
            "Un incidente solo cuenta si una persona del equipo de NIVEL lo verificó.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Las calificaciones">
        <LegalList items={RATING_RULES} />
      </LegalSection>

      <LegalSection title="Si no estás de acuerdo">
        <p>
          En «Mis datos» ves todo lo que guardamos de ti, incluidas las calificaciones que recibiste. Si algo
          está mal, puedes corregirlo o enviarnos un reporte. Una persona lo revisa en menos de 24 horas.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
