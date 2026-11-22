import { create } from "qrcode";

/**
 * Código QR como un trazo de SVG. Se dibuja en la propia página: el enlace
 * no se manda a ningún servicio externo y no hacen falta estilos en línea.
 */

export interface QrDrawing {
  /** Lado del código en módulos, incluida la zona de silencio. */
  readonly size: number;
  /** Trazo con un cuadrado de 1 × 1 por cada módulo oscuro. */
  readonly path: string;
}

/** Margen en blanco que los lectores necesitan alrededor del código. */
const QUIET_ZONE = 4;

export function qrDrawing(text: string): QrDrawing {
  const { modules } = create(text, { errorCorrectionLevel: "M" });
  const squares: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) squares.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return { size: modules.size + QUIET_ZONE * 2, path: squares.join("") };
}
