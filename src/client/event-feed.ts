/**
 * Bitácora que se va acumulando: cada consulta pide solo lo posterior al
 * último evento visto y lo suma a lo que ya había. No depende de React ni de
 * la red: recibe la función que trae una página.
 */

export interface FeedEvent {
  readonly id: string;
  /** Instante del evento, ISO 8601. Sirve de cursor para la siguiente consulta. */
  readonly ts: string;
}

export type FetchPage<E extends FeedEvent> = (since: string | undefined, signal: AbortSignal) => Promise<E[]>;

export interface EventFeedOptions {
  /** Tamaño de página del servidor: una página llena significa que puede haber más. */
  readonly pageSize?: number;
  /** Cuántos eventos se conservan en memoria (los más recientes). */
  readonly keep?: number;
  /** Tope de páginas por consulta, para no encadenar peticiones sin fin. */
  readonly maxPages?: number;
}

export interface EventFeed<E extends FeedEvent> {
  /** Trae lo nuevo y devuelve toda la bitácora conocida, de la más antigua a la más reciente. */
  readonly load: (signal: AbortSignal) => Promise<E[]>;
  /** Olvida lo visto: tras reiniciar la demo la bitácora empieza de cero. */
  readonly clear: () => void;
}

export function createEventFeed<E extends FeedEvent>(
  fetchPage: FetchPage<E>,
  { pageSize = 100, keep = 200, maxPages = 5 }: EventFeedOptions = {},
): EventFeed<E> {
  let seen: E[] = [];
  // Cambia con cada `clear`: una respuesta que venía en camino no revive lo borrado.
  let generation = 0;

  return {
    async load(signal) {
      const mine = generation;
      let known = seen;
      for (let page = 0; page < maxPages; page += 1) {
        const fresh = await fetchPage(known.at(-1)?.ts, signal);
        const ids = new Set(known.map((event) => event.id));
        known = [...known, ...fresh.filter((event) => !ids.has(event.id))].slice(-keep);
        if (fresh.length < pageSize) break;
      }
      if (mine === generation) seen = known;
      return seen;
    },
    clear() {
      generation += 1;
      seen = [];
    },
  };
}
