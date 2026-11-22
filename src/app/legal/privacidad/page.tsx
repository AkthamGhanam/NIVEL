import type { Metadata } from "next";

import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacidad" };

function WhatWeKeep() {
  return (
    <LegalSection title="Qué guardamos">
      <LegalList
        items={[
          "Tu perfil: nombre, teléfono, oficio, experiencia, técnicas y zona.",
          "Tu historial: trabajos, hora de entrada y salida, pagos registrados, cursos, constancias y prueba práctica.",
          "Las calificaciones privadas que recibes y las que das.",
          "Los reportes que envías, que son confidenciales.",
        ]}
      />
    </LegalSection>
  );
}

function Permissions() {
  return (
    <LegalSection title="Te pedimos cada permiso por separado">
      <p>Ninguno viene activado. Puedes retirar cualquiera cuando quieras desde «Mis datos».</p>
      <LegalList
        items={[
          "Voz: para registrarte y hablar con Nivi. El audio lo procesa ElevenLabs, nuestro proveedor de voz, para transcribirlo y responderte. Para que Nivi sepa con quién habla, le pasamos tu nombre de pila, tu oficio, tu nivel y tu zona; nunca tu teléfono ni tus calificaciones.",
          "Selfie: solo para comprobar que eres tú.",
          "Ubicación: solo en el momento en que marcas entrada o salida. Se compara con el punto de la obra y no se guarda. La empresa ve la hora, por ejemplo «Llegó 7:02 a. m.», y si la llegada se verificó en la obra; nunca un mapa en vivo.",
          "Avisos: para enterarte de ofertas y pagos.",
          "Telegram: es opcional y lo conectas tú desde la app. Guardamos solo el identificador de tu chat para enviarte avisos; los mensajes pasan por Telegram. Al desconectarlo o borrar tu cuenta, ese vínculo se borra.",
          "Compartir perfil: para que las empresas te encuentren. Si lo retiras, sales de las búsquedas al instante.",
        ]}
      />
    </LegalSection>
  );
}

function WhatCompaniesSee() {
  return (
    <LegalSection title="Qué ve una empresa de ti">
      <LegalList
        items={[
          "Ve tu nombre corto, tu nivel, tus trabajos confirmados, tu prueba práctica y tus constancias.",
          "No ve tu foto, tu edad ni tu sexo antes de invitarte.",
          "Nunca ve las calificaciones que te dieron otras empresas.",
          "Si apagas «Abierto a trabajar», dejas de aparecer en las búsquedas.",
        ]}
      />
    </LegalSection>
  );
}

function ForCompanies() {
  return (
    <LegalSection title="Si eres empresa">
      <LegalList
        items={[
          "Guardamos el nombre, el RIF y la zona de tu empresa, tus solicitudes, las contrataciones y los pagos que registras.",
          "Si fijas la obra con tu ubicación, guardamos ese punto como dirección de la obra, para verificar las llegadas. No seguimos tu teléfono.",
          "Solo ves los datos de tus propias contrataciones.",
        ]}
      />
    </LegalSection>
  );
}

function YourRights() {
  return (
    <LegalSection title="Tus derechos">
      <p>En «Mis datos» puedes, sin pedirle permiso a nadie:</p>
      <LegalList
        items={[
          "Ver todo lo que guardamos de ti.",
          "Descargarlo en un archivo.",
          "Corregir tu nombre, tu zona, tus técnicas y tu disponibilidad.",
          "Borrar tu cuenta.",
        ]}
      />
      <p>
        Estos derechos salen del artículo 28 de la Constitución: saber qué datos tuyos tenemos, para qué los
        usamos, y pedir que se corrijan o se destruyan. Si algo no puedes hacerlo tú desde la app, escríbenos
        desde «Ayuda» y una persona del equipo te responde.
      </p>
      <p>
        Al borrar tu cuenta se borra tu perfil y tu historial. Si ya trabajaste con contratos, tu nombre queda
        solo en los recibos de pago ya emitidos, porque la empresa está obligada por ley a conservarlos.
      </p>
    </LegalSection>
  );
}

function AdultsOnly() {
  return (
    <LegalSection title="Solo personas adultas">
      <p>
        NIVEL es solo para mayores de 18 años. Si una persona menor intenta registrarse, no se crea ningún
        perfil.
      </p>
    </LegalSection>
  );
}

function Security() {
  return (
    <LegalSection title="Seguridad">
      <LegalList
        items={[
          "La bitácora interna registra qué pasó y cuándo, pero no guarda nombres completos, teléfonos ni lo que dijiste.",
          "Los códigos de firma no se guardan en claro.",
          "No vendemos tus datos ni los usamos para publicidad.",
          "Tu nivel nunca usa tu edad, tu sexo, un embarazo, una discapacidad, tu religión, tu afiliación sindical o política, ni los reclamos que hagas.",
        ]}
      />
    </LegalSection>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacidad"
      lead="Tus datos son tuyos. Guardamos lo necesario para que consigas trabajo y para que tu nivel se pueda comprobar."
    >
      <WhatWeKeep />
      <Permissions />
      <WhatCompaniesSee />
      <ForCompanies />
      <YourRights />
      <AdultsOnly />
      <Security />
    </LegalPage>
  );
}
