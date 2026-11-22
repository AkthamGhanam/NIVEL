/**
 * Guiones de las lecciones en audio, con el tono de Nivi: cercano, claro y corto.
 * El audio se pregenera con TTS en la fase 5 (`scripts/generate-audio.ts`).
 */

interface LessonSeed {
  readonly id: string;
  readonly courseId: string;
  readonly order: number;
  readonly title: string;
  readonly script: string;
  readonly durationS: number;
}

export const LESSONS: readonly LessonSeed[] = [
  {
    id: "le-seguridad-1",
    courseId: "cu-seguridad",
    order: 1,
    title: "Tu equipo de protección personal",
    durationS: 75,
    script:
      "Hola, soy Nivi. Antes de encender el arco, revisa tu equipo de protección. Primero, la careta: el vidrio debe ser filtro diez o más para soldadura de arco, sin rayas ni fisuras. Segundo, los guantes de cuero largos, secos y sin huecos; un guante mojado conduce la corriente. Tercero, la braga o chaqueta de cuero o algodón grueso, nunca tela sintética, porque se derrite con las chispas. Cuarto, botas de seguridad cerradas y con el pantalón por fuera, para que no entren gotas de metal. Y quinto, lentes claros debajo de la careta para cuando piques la escoria. Si te falta algo de esto, pídelo antes de empezar. Tu vista y tus manos son tu herramienta de trabajo.",
  },
  {
    id: "le-seguridad-2",
    courseId: "cu-seguridad",
    order: 2,
    title: "Orden y limpieza antes de soldar",
    durationS: 70,
    script:
      "Soy Nivi otra vez. La mayoría de los incendios en obra empiezan por una chispa que cayó donde no debía. Antes de soldar, mira a tu alrededor diez metros a la redonda. Retira cartón, trapos con grasa, pintura, tíner y bombonas. Lo que no puedas mover, cúbrelo con una manta ignífuga o una lámina de metal. Ten un extintor de polvo químico a la mano, a menos de cinco pasos, y revisa que la aguja esté en la zona verde. Revisa también los cables de la máquina: sin empates pelados y lejos de charcos. Cuando termines, quédate treinta minutos vigilando el área, porque una brasa puede prender después. Un área limpia es un trabajo seguro.",
  },
  {
    id: "le-seguridad-3",
    courseId: "cu-seguridad",
    order: 3,
    title: "Ventilación y humos",
    durationS: 65,
    script:
      "Hola, aquí Nivi. El humo de la soldadura no es solo molesto: lleva partículas de metal que dañan los pulmones con el tiempo. Trabaja siempre con aire que circule. Si estás al aire libre, ponte de modo que el viento se lleve el humo hacia un lado, no hacia tu cara. En un taller cerrado, usa extractor o al menos un ventilador que saque el humo. Ten más cuidado con el material galvanizado o pintado, porque suelta gases tóxicos: lija la zona antes de soldar. Y nunca sueldes dentro de un tanque o espacio cerrado sin permiso, ventilación forzada y un compañero afuera. Si te mareas o te duele la cabeza, detente y sal a respirar.",
  },
  {
    id: "le-smaw-1",
    courseId: "cu-smaw",
    order: 1,
    title: "Electrodos E6011 y E7018: cuándo usar cada uno",
    durationS: 80,
    script:
      "Soy Nivi. Hoy hablamos de los dos electrodos que más vas a usar en estructuras. El seis mil once penetra profundo y aguanta superficies con óxido, pintura o algo de suciedad. Sirve en todas las posiciones y es el indicado para el pase de raíz y para punteo. Deja un cordón áspero y salpica bastante. El siete mil dieciocho es de bajo hidrógeno: da una soldadura más resistente y un cordón liso, y es el que piden para uniones que cargan peso, como vigas y columnas. Pero es delicado con la humedad: guárdalo en horno o en su termo, y no lo uses si estuvo al aire toda la noche. Regla práctica: raíz con seis mil once, relleno y acabado con siete mil dieciocho.",
  },
  {
    id: "le-smaw-2",
    courseId: "cu-smaw",
    order: 2,
    title: "Posición y longitud de arco",
    durationS: 75,
    script:
      "Hola, soy Nivi. Un buen cordón depende de tres cosas: ángulo, distancia y velocidad. Inclina el electrodo entre diez y veinte grados en la dirección en que avanzas. Mantén el arco corto: la distancia entre la punta y la pieza debe ser más o menos el grosor del alma del electrodo. Si lo alejas, el arco suena como fritura fuerte, salpica y deja poros. Si lo pegas demasiado, se queda adherido. Un arco correcto suena parejo, como tocino friéndose suave. Avanza a una velocidad constante, de modo que el cordón quede del doble del ancho del electrodo. En vertical, sube en zigzag corto y haz una pausa breve en cada orilla para que no quede socavado. Practica en retazos antes de ir a la pieza.",
  },
];
