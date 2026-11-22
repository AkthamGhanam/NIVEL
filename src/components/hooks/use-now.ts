"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 1000;

const subscribe = (listener: () => void) => {
  const timer = setInterval(listener, TICK_MS);
  return () => clearInterval(timer);
};
const wholeSeconds = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;
/** En el servidor no hay "ahora" que valga: se parte de cero y el navegador pone la hora. */
const serverSnapshot = () => 0;

/** La hora actual, al segundo. La pantalla se repinta una vez por segundo mientras alguien la usa. */
export function useNow(): Date {
  return new Date(useSyncExternalStore(subscribe, wholeSeconds, serverSnapshot));
}
