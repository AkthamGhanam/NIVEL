import { describe, expect, it, vi } from "vitest";

import { createEventFeed, type FeedEvent, type FetchPage } from "./event-feed";

const event = (n: number): FeedEvent => ({
  id: `ev-${n}`,
  ts: `2026-11-22T12:00:${String(n).padStart(2, "0")}.000Z`,
});
const signal = new AbortController().signal;

/** Servidor de mentira: devuelve, por páginas, lo posterior a `since`. */
function server(all: FeedEvent[], pageSize: number) {
  return vi.fn<FetchPage<FeedEvent>>(async (since) =>
    all.filter((item) => since === undefined || item.ts > since).slice(0, pageSize),
  );
}

describe("bitácora acumulada", () => {
  it("la primera consulta trae todo y las siguientes piden solo lo posterior al último evento", async () => {
    const all = [event(1), event(2)];
    const fetchPage = server(all, 100);
    const feed = createEventFeed(fetchPage);

    expect(await feed.load(signal)).toEqual([event(1), event(2)]);
    all.push(event(3));
    expect(await feed.load(signal)).toEqual([event(1), event(2), event(3)]);
    expect(fetchPage.mock.calls.map(([since]) => since)).toEqual([undefined, event(2).ts]);
  });

  it("si una página llega llena sigue pidiendo, hasta el tope de páginas", async () => {
    const all = Array.from({ length: 7 }, (_, index) => event(index + 1));
    const fetchPage = server(all, 2);
    const feed = createEventFeed(fetchPage, { pageSize: 2, maxPages: 3 });

    expect(await feed.load(signal)).toHaveLength(6);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(await feed.load(signal)).toHaveLength(7);
  });

  it("no repite un evento que el servidor devuelve dos veces y conserva solo los más recientes", async () => {
    const fetchPage = vi
      .fn<FetchPage<FeedEvent>>()
      .mockResolvedValueOnce([event(1), event(2)])
      .mockResolvedValueOnce([event(2), event(3), event(4)]);
    const feed = createEventFeed(fetchPage, { keep: 3 });

    await feed.load(signal);
    expect((await feed.load(signal)).map((item) => item.id)).toEqual(["ev-2", "ev-3", "ev-4"]);
  });

  it("al reiniciar la demo olvida lo visto, y una respuesta que venía en camino no lo revive", async () => {
    let release: (events: FeedEvent[]) => void = () => undefined;
    const fetchPage = vi
      .fn<FetchPage<FeedEvent>>()
      .mockResolvedValueOnce([event(1)])
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
      .mockResolvedValueOnce([event(9)]);
    const feed = createEventFeed(fetchPage);

    await feed.load(signal);
    const late = feed.load(signal);
    feed.clear();
    release([event(2)]);

    expect(await late).toEqual([]);
    expect(await feed.load(signal)).toEqual([event(9)]);
    expect(fetchPage.mock.calls.at(-1)?.[0]).toBeUndefined();
  });
});
