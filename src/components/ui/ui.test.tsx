// Pruebas de ui.
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BytesLogo, DemoFooter, NivelMark } from "@/components/brand/brand";
import { hiringFee } from "@/lib/pricing";

import { Avatar } from "./avatar";
import { Button, ButtonLink } from "./button";
import { Card } from "./card";
import { LoadingText, NotEmployerNotice, Notice } from "./notice";
import { PhoneFrame } from "./phone-frame";
import { PriceBreakdown } from "./price";
import { Progress } from "./progress";
import { LevelRings, SeatRing } from "./rings";
import { LevelBadge, Tag } from "./tag";
import { VoiceOrb } from "./voice-orb";

const html = (element: ReactElement) => renderToStaticMarkup(element);

describe("botones", () => {
  it("miden al menos 48 px, no envían formularios por accidente y se pueden deshabilitar", () => {
    const markup = html(<Button disabled>Firmar</Button>);

    expect(markup).toContain('type="button"');
    expect(markup).toContain("min-h-13");
    expect(markup).toContain("disabled");
    expect(html(<Button type="submit">Enviar</Button>)).toContain('type="submit"');
  });

  it("cada variante tiene su aspecto, y el enlace con forma de botón navega de verdad", () => {
    expect(html(<Button variant="danger">Borrar</Button>)).toContain("text-danger");
    expect(html(<Button block>Aceptar</Button>)).toContain("w-full");
    expect(html(<ButtonLink href="/legal/niveles">Niveles</ButtonLink>)).toMatch(
      /<a [^>]*href="\/legal\/niveles"/,
    );
  });
});

describe("estados", () => {
  it("la insignia dice el nivel con su nombre público", () => {
    expect(html(<LevelBadge level={3} />)).toContain("Nivel 3 · Probado");
    expect(html(<LevelBadge level={3} short />)).not.toContain("Probado");
    expect(html(<Tag tone="alert">Rechazó</Tag>)).toContain("text-danger");
    expect(html(<Tag>Enviada</Tag>)).toContain("bg-line-2");
  });

  it("el avatar son iniciales decorativas, nunca una foto", () => {
    const markup = html(<Avatar name="Carlos Rodríguez" />);

    expect(markup).toContain(">CR<");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("<img");
  });

  it("la barra de avance anuncia su valor y se mantiene entre 0 y 100", () => {
    expect(html(<Progress value={2 / 3} label="Avance del curso" />)).toContain('aria-valuenow="67"');
    expect(html(<Progress value={7} label="Avance" />)).toContain('aria-valuenow="100"');
    expect(html(<Progress value={-1} label="Avance" />)).toContain('aria-valuenow="0"');
    expect(html(<Progress value={0.5} label="Avance del curso" />)).toContain(
      'aria-label="Avance del curso"',
    );
  });

  it("la tarjeta elegida se distingue por el borde verde", () => {
    expect(html(<Card selected>x</Card>)).toContain("border-brand");
    expect(html(<Card>x</Card>)).toContain("border-line");
  });
});

describe("avisos", () => {
  it("el aviso de que NIVEL no es el patrono usa el texto fijo de la revisión legal", () => {
    expect(html(<NotEmployerNotice />)).toContain(
      "Contrato directo empresa–trabajador. NIVEL es la plataforma, no el patrono.",
    );
  });

  it("un aviso urgente se anuncia de inmediato; la carga se anuncia con cortesía y con palabras", () => {
    expect(html(<Notice urgent>Falló</Notice>)).toContain('role="alert"');
    expect(html(<Notice title="Garantía">Texto</Notice>)).toContain('role="note"');
    expect(html(<LoadingText>Nivi está buscando soldadores…</LoadingText>)).toMatch(
      /role="status".*Nivi está buscando/,
    );
  });

  it("el precio muestra la base, el IVA aparte, el total y cómo se paga", () => {
    const markup = html(<PriceBreakdown label="Tarifa de NIVEL" price={hiringFee(3)} totalBs={1740} />);

    expect(markup).toContain("$30");
    expect(markup).toContain("IVA 16 %");
    expect(markup).toContain("$4,80");
    expect(markup).toContain("$34,80");
    expect(markup).toContain("Bs. 1.740,00 (tasa de ejemplo)");
    expect(markup).toContain("Pago Móvil o transferencia");
    expect(html(<PriceBreakdown label="Tarifa" price={hiringFee(1)} />)).not.toContain("tasa de ejemplo");
  });
});

describe("voz y marco", () => {
  it("el orbe siempre dice con palabras en qué está Nivi", () => {
    expect(html(<VoiceOrb state="idle" />)).toContain("Toca para hablar con Nivi");
    expect(html(<VoiceOrb state="thinking" />)).toContain("Nivi está pensando…");
    expect(html(<VoiceOrb state="speaking" size="md" />)).toContain("Nivi está hablando");
  });

  it("los anillos solo laten mientras escucha o habla", () => {
    expect(html(<VoiceOrb state="listening" />)).toContain("animate-orb-ring");
    expect(html(<VoiceOrb state="idle" />)).not.toContain("animate-orb-ring");
  });

  it("el marco de teléfono y la marca tienen nombre accesible", () => {
    expect(html(<PhoneFrame label="App del trabajador">contenido</PhoneFrame>)).toContain(
      'aria-label="App del trabajador"',
    );
    expect(html(<BytesLogo />)).toContain('alt="Bytes Technology"');
    expect(html(<NivelMark tone="white" />)).toContain("NIVEL");
    expect(html(<DemoFooter />)).toContain("Versión demo · datos de ejemplo");
  });
});

describe("anillos", () => {
  it("enciende un anillo por nivel alcanzado y deja punteado el siguiente", () => {
    const markup = html(<LevelRings level={2}>2</LevelRings>);

    expect(markup.match(/data-ring="reached"/g)).toHaveLength(2);
    expect(markup.match(/data-ring="next"/g)).toHaveLength(1);
    expect(markup).toContain('aria-hidden="true"');
  });

  it("en el nivel 5 todos los anillos están encendidos y no hay siguiente", () => {
    const markup = html(<LevelRings level={5} />);

    expect(markup.match(/data-ring="reached"/g)).toHaveLength(5);
    expect(markup).not.toContain('data-ring="next"');
  });

  it("parte el anillo en un tramo por puesto y enciende los ocupados", () => {
    const markup = html(<SeatRing filled={2} total={3} label="Cuadrilla 2 de 3" />);

    expect(markup.match(/data-seat="filled"/g)).toHaveLength(2);
    expect(markup.match(/data-seat="open"/g)).toHaveLength(1);
    expect(markup).toMatch(/role="progressbar"[^>]*aria-label="Cuadrilla 2 de 3"/);
    expect(markup).toContain('aria-valuenow="67"');
  });

  it("no se sale de sus límites con datos raros", () => {
    const over = html(<SeatRing filled={9} total={3} label="x" />);
    const empty = html(<SeatRing filled={-1} total={0} />);

    expect(over.match(/data-seat="filled"/g)).toHaveLength(3);
    expect(over).toContain('aria-valuenow="100"');
    expect(empty.match(/data-seat=/g)).toHaveLength(1);
    expect(empty).not.toContain("progressbar");
  });
});

describe("política de seguridad de contenido", () => {
  it("ningún componente usa estilos en línea, que la CSP bloquea", () => {
    const everything = html(
      <>
        <Button>a</Button>
        <Card selected>b</Card>
        <Tag tone="ok">c</Tag>
        <Avatar name="Ana Pérez" size="lg" tone="ink" />
        <Progress value={0.4} label="Avance" />
        <Notice tone="pending">d</Notice>
        <VoiceOrb state="listening" />
        <PhoneFrame label="e">f</PhoneFrame>
        <PriceBreakdown label="g" price={hiringFee(2)} />
        <NivelMark />
        <LevelRings level={3} />
        <SeatRing filled={1} total={4} label="h" />
      </>,
    );

    expect(everything).not.toMatch(/\sstyle="/);
  });
});
