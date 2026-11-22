import { api } from "@/server/http/live";

export const GET = api.me.profile;
export const PATCH = api.me.correct;
export const DELETE = api.me.remove;
