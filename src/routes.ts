export type Route =
  | { kind: "gallery" }
  | { kind: "login" }
  | { kind: "mind-public"; slug: string }
  | { kind: "mind-op"; slug: string }
  | { kind: "mind-note"; slug: string; noteId: string }
  | { kind: "op-new" }
  | { kind: "op-directory" }
  | { kind: "op-directory-chat" }
  | { kind: "mind-action"; slug: string; action: "queue" | "force" | "talk" | "pause" | "resume" }
  | { kind: "unknown" };

export function matchRoute(pathname: string): Route {
  if (pathname === "/") return { kind: "gallery" };
  if (pathname === "/login") return { kind: "login" };
  if (pathname === "/op/new") return { kind: "op-new" };
  if (pathname === "/op/directory") return { kind: "op-directory" };
  if (pathname === "/op/directory/chat") return { kind: "op-directory-chat" };

  const noteMatch = /^\/minds\/([^/]+)\/notes\/([^/]+)$/.exec(pathname);
  if (noteMatch) {
    return {
      kind: "mind-note",
      slug: decodeURIComponent(noteMatch[1]),
      noteId: decodeURIComponent(noteMatch[2]),
    };
  }

  const mindMatch = /^\/minds\/([^/]+)(\/op)?$/.exec(pathname);
  if (mindMatch) {
    const slug = decodeURIComponent(mindMatch[1]);
    return mindMatch[2]
      ? { kind: "mind-op", slug }
      : { kind: "mind-public", slug };
  }

  const actionMatch = /^\/op\/minds\/([^/]+)\/(queue|force|talk|pause|resume)$/.exec(pathname);
  if (actionMatch) {
    return {
      kind: "mind-action",
      slug: decodeURIComponent(actionMatch[1]),
      action: actionMatch[2] as "queue" | "force" | "talk" | "pause" | "resume",
    };
  }

  return { kind: "unknown" };
}
